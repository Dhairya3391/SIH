import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { priorityBand } from "@/lib/domain/types";
import { orgContacts } from "./contacts";

/**
 * The system owner's numbers, computed from the record.
 *
 * Anything the record cannot answer is null rather than a number the console
 * would present as real. Shared by the admin console and the AI assistant.
 */

const DAY = 86_400_000;
const daysSince = (iso: string | null | undefined) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)] * 10) / 10;
};

const AWAITING = ["REPORTED", "REFINED"];
const OPEN_TO_COLLEGES = ["VERIFIED", "OPEN", "TEAM_FORMED"];
const IN_DELIVERY = ["SOLUTION_PROPOSED", "PILOT"];
const SOLVED = ["DEPLOYED", "IMPACT_VERIFIED"];
const CLOSED = ["CLOSED_NOT_ACTIONABLE", "DUPLICATE"];

export async function adminMetrics(supabase: SupabaseClient) {
  const [{ data: challenges }, { data: verifs }, { data: proposals }, { data: pledges }, { data: windows }, { data: updates }, { data: timings }] =
    await Promise.all([
      supabase
        .from("challenges")
        .select("id, ref, title, status, severity, priority, district, confidence, created_at, verified_at, deployed_at, closed_at"),
      supabase.from("verifications").select("challenge_id, kind, method, created_at"),
      supabase.from("proposals").select("id, challenge_id, org_id, state, ai_verdict, ai_score, ai_rubric, submitted_at, scored_at"),
      supabase.from("pledges").select("qty, kind, state, status"),
      supabase.from("proposal_windows").select("challenge_id, state, opened_at, closes_at, closed_at, leader_score, awarded_proposal_id"),
      supabase.from("progress_updates").select("challenge_id, created_at").order("created_at", { ascending: true }),
      supabase.from("challenge_timings").select("stage_key, hours, met_sla"),
    ]);

  const rows = challenges ?? [];
  const byId = new Map(rows.map((c) => [c.id as string, c]));

  const byStatus: Record<string, number> = {};
  const byDistrict: Record<string, number> = {};
  for (const c of rows) {
    byStatus[c.status as string] = (byStatus[c.status as string] ?? 0) + 1;
    const d = (c.district as string) ?? "Unknown";
    byDistrict[d] = (byDistrict[d] ?? 0) + 1;
  }

  const isSevere = (c: Record<string, unknown>) => Number(c.priority ?? 0) >= 75;
  const open = rows.filter((c) => !SOLVED.includes(c.status as string) && !CLOSED.includes(c.status as string));
  const solved = rows.filter((c) => SOLVED.includes(c.status as string));

  // Severe problems still open, with how long since each was listed for colleges.
  const severeOpen = open
    .filter(isSevere)
    .map((c) => ({
      id: c.id as string,
      ref: c.ref as string,
      title: c.title as string,
      district: (c.district as string) ?? null,
      priority: c.priority as number,
      status: c.status as string,
      age_days: daysSince(c.created_at as string),
      listed_days: c.verified_at ? daysSince(c.verified_at as string) : null,
    }))
    .sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0));

  const solveDays = solved
    .map((c) => {
      const end = (c.deployed_at as string) ?? (c.closed_at as string);
      return end ? (new Date(end).getTime() - new Date(c.created_at as string).getTime()) / DAY : null;
    })
    .filter((d): d is number => d !== null && d >= 0);

  const solvedByBand: Record<string, number> = { critical: 0, high: 0, moderate: 0, long_term: 0 };
  for (const c of solved) solvedByBand[priorityBand(Number(c.priority ?? 0))] += 1;

  // How problems got verified: by the AI with sources, or by a person.
  const firstPositive = new Map<string, { method: string; at: string }>();
  let rejected = 0;
  for (const v of (verifs ?? []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (v.kind === "inaccurate") {
      rejected += 1;
      continue;
    }
    const positive = v.method === "ai_external" || v.method === "coordinator" || v.kind === "field";
    if (positive && !firstPositive.has(v.challenge_id as string)) {
      firstPositive.set(v.challenge_id as string, { method: v.method === "ai_external" ? "ai" : "human", at: v.created_at as string });
    }
  }
  const aiVerified = [...firstPositive.values()].filter((v) => v.method === "ai").length;
  const humanVerified = [...firstPositive.values()].filter((v) => v.method === "human").length;
  const verifyHours = rows
    .filter((c) => c.verified_at && c.created_at)
    .map((c) => (new Date(c.verified_at as string).getTime() - new Date(c.created_at as string).getTime()) / 3_600_000)
    .filter((h) => h > 0.001);

  const proposalRows = proposals ?? [];
  const proposalsSummary = {
    total: proposalRows.length,
    awaiting_score: proposalRows.filter((p) => p.state === "submitted" || p.state === "scoring").length,
    viable: proposalRows.filter((p) => p.ai_verdict === "viable").length,
    needs_changes: proposalRows.filter((p) => p.ai_verdict === "needs_changes").length,
    not_viable: proposalRows.filter((p) => p.ai_verdict === "not_viable").length,
    awarded: proposalRows.filter((p) => p.state === "winner").length,
    scored_by_rules: proposalRows.filter((p) => (p.ai_rubric as { source?: string } | null)?.source === "rules").length,
  };

  let moneyPledged = 0;
  let moneyReceived = 0;
  let materialLines = 0;
  let materialReceived = 0;
  for (const p of pledges ?? []) {
    const st = ((p.state as string) ?? (p.status as string) ?? "offered").toString();
    if (st === "withdrawn") continue;
    if (p.kind === "money") {
      moneyPledged += Number(p.qty ?? 0);
      if (st === "received" || st === "delivered") moneyReceived += Number(p.qty ?? 0);
    } else {
      materialLines += 1;
      if (st === "received" || st === "delivered") materialReceived += 1;
    }
  }

  // Projects in delivery and how regularly their college reports progress.
  const updatesBy = new Map<string, string[]>();
  for (const u of updates ?? []) {
    const k = u.challenge_id as string;
    if (!updatesBy.has(k)) updatesBy.set(k, []);
    updatesBy.get(k)!.push(u.created_at as string);
  }
  const awarded = (windows ?? []).filter((w) => w.state === "awarded");
  const winnerOrg = new Map(proposalRows.filter((p) => p.state === "winner").map((p) => [p.challenge_id as string, p.org_id as string]));
  const contacts = await orgContacts(supabase, [...winnerOrg.values()]);

  const delivery = awarded
    .map((w) => {
      const cid = w.challenge_id as string;
      const c = byId.get(cid);
      if (!c || !IN_DELIVERY.includes(c.status as string)) return null;
      const ups = updatesBy.get(cid) ?? [];
      const gaps = ups.slice(1).map((u, i) => (new Date(u).getTime() - new Date(ups[i]).getTime()) / DAY);
      const last = ups.at(-1) ?? (w.closed_at as string | null);
      return {
        id: cid,
        ref: c.ref as string,
        title: c.title as string,
        district: (c.district as string) ?? null,
        status: c.status as string,
        college: contacts.get(winnerOrg.get(cid) ?? "")?.name ?? null,
        updates: ups.length,
        average_gap_days: gaps.length ? Math.round((gaps.reduce((s, g) => s + g, 0) / gaps.length) * 10) / 10 : null,
        last_update_at: ups.at(-1) ?? null,
        days_since_update: daysSince(last),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const quiet = delivery
    .filter((d) => (d.days_since_update ?? 0) >= 7)
    .sort((a, b) => (b.days_since_update ?? 0) - (a.days_since_update ?? 0));
  const allGaps = delivery.map((d) => d.average_gap_days).filter((g): g is number => g !== null);

  const slaByStage: Record<string, { n: number; met: number; median_hours: number | null }> = {};
  const bucket: Record<string, number[]> = {};
  for (const t of timings ?? []) {
    const k = t.stage_key as string;
    slaByStage[k] = slaByStage[k] ?? { n: 0, met: 0, median_hours: null };
    slaByStage[k].n += 1;
    if (t.met_sla) slaByStage[k].met += 1;
    (bucket[k] = bucket[k] ?? []).push(Number(t.hours));
  }
  for (const k of Object.keys(slaByStage)) slaByStage[k].median_hours = median(bucket[k] ?? []);

  const openWindows = (windows ?? [])
    .filter((w) => w.state === "open")
    .map((w) => {
      const c = byId.get(w.challenge_id as string);
      const ps = proposalRows.filter((p) => p.challenge_id === w.challenge_id);
      return {
        challenge_id: w.challenge_id as string,
        ref: (c?.ref as string) ?? null,
        title: (c?.title as string) ?? null,
        district: (c?.district as string) ?? null,
        opened_at: w.opened_at as string,
        closes_at: w.closes_at as string,
        leader_score: (w.leader_score as number) ?? null,
        proposals: ps.length,
        viable: ps.filter((p) => p.ai_verdict === "viable").length,
        awaiting_score: ps.filter((p) => p.state === "submitted" || p.state === "scoring").length,
      };
    })
    .sort((a, b) => a.closes_at.localeCompare(b.closes_at));

  return {
    totals: {
      challenges: rows.length,
      open: open.length,
      awaiting_verification: rows.filter((c) => AWAITING.includes(c.status as string)).length,
      open_to_colleges: rows.filter((c) => OPEN_TO_COLLEGES.includes(c.status as string)).length,
      in_delivery: rows.filter((c) => IN_DELIVERY.includes(c.status as string)).length,
      solved: solved.length,
      closed_not_actionable: rows.filter((c) => c.status === "CLOSED_NOT_ACTIONABLE").length,
      severe_open: severeOpen.length,
      severe_solved: solved.filter(isSevere).length,
    },
    by_status: byStatus,
    by_district: byDistrict,
    severe_open: severeOpen.slice(0, 20),
    severe_open_ages_days: severeOpen.map((s) => s.age_days ?? 0),
    solved: {
      count: solved.length,
      by_band: solvedByBand,
      median_days_to_solve: median(solveDays),
    },
    verification: {
      ai_verified: aiVerified,
      human_verified: humanVerified,
      rejected,
      awaiting: rows.filter((c) => AWAITING.includes(c.status as string)).length,
      ai_share_pct: aiVerified + humanVerified > 0 ? Math.round((aiVerified / (aiVerified + humanVerified)) * 100) : null,
    },
    median_verification_hours: median(verifyHours),
    proposals: proposalsSummary,
    funding: {
      money_pledged: moneyPledged,
      money_received: moneyReceived,
      material_lines: materialLines,
      material_lines_received: materialReceived,
      currency: "INR",
    },
    sla: slaByStage,
    delivery,
    quiet_projects: quiet,
    cadence: {
      projects: delivery.length,
      average_gap_days: allGaps.length ? Math.round((allGaps.reduce((s, g) => s + g, 0) / allGaps.length) * 10) / 10 : null,
    },
    competition: {
      windows_open: (windows ?? []).filter((w) => w.state === "open").length,
      windows_awarded: awarded.length,
      windows_reopened: (windows ?? []).filter((w) => w.state === "reopened").length,
    },
    open_windows: openWindows,
  };
}
