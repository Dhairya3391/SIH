import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/admin/metrics - the system owner's readout.
 *
 * Counts, ages, funding delivered against pledged, SLA attainment, and the
 * projects that have gone quiet. Everything here is computed from the record,
 * and anything the record cannot answer returns null rather than a number the
 * console would then present as real.
 */
export const GET = route(async () => {
  await requireRole("admin");
  const supabase = supabaseAdmin();

  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, ref, status, severity, priority, district, created_at, verified_at, closed_at");

  const rows = challenges ?? [];
  const now = Date.now();
  const open = rows.filter((c) => !c.closed_at);
  const severe = open.filter((c) => (c.priority as number) >= 75);
  const solved = rows.filter((c) => c.status === "IMPACT_VERIFIED" || c.status === "DEPLOYED");

  const ageDays = (iso: string | null) =>
    iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : null;

  const byStatus: Record<string, number> = {};
  const byDistrict: Record<string, number> = {};
  for (const c of rows) {
    byStatus[c.status as string] = (byStatus[c.status as string] ?? 0) + 1;
    byDistrict[c.district as string] = (byDistrict[c.district as string] ?? 0) + 1;
  }

  // Verification lead time, from the rows that actually have both timestamps.
  const leadTimes = rows
    .filter((c) => c.verified_at && c.created_at)
    .map(
      (c) =>
        (new Date(c.verified_at as string).getTime() -
          new Date(c.created_at as string).getTime()) /
        3_600_000,
    )
    .filter((h) => h >= 0)
    .sort((a, b) => a - b);
  const medianVerifyHours =
    leadTimes.length > 0 ? Math.round(leadTimes[Math.floor(leadTimes.length / 2)] * 10) / 10 : null;

  // Funding and materials: pledged versus actually received.
  const { data: pledges } = await supabase.from("pledges").select("qty, kind, state, status");
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

  // SLA attainment, only where the migration has produced timings.
  const { data: timings } = await supabase
    .from("challenge_timings")
    .select("stage_key, hours, met_sla");
  const slaByStage: Record<string, { n: number; met: number; median_hours: number | null }> = {};
  const bucket: Record<string, number[]> = {};
  for (const t of timings ?? []) {
    const k = t.stage_key as string;
    slaByStage[k] = slaByStage[k] ?? { n: 0, met: 0, median_hours: null };
    slaByStage[k].n += 1;
    if (t.met_sla) slaByStage[k].met += 1;
    bucket[k] = bucket[k] ?? [];
    if (typeof t.hours === "number") bucket[k].push(t.hours);
  }
  for (const k of Object.keys(slaByStage)) {
    const xs = (bucket[k] ?? []).sort((a, b) => a - b);
    slaByStage[k].median_hours =
      xs.length > 0 ? Math.round(xs[Math.floor(xs.length / 2)] * 10) / 10 : null;
  }

  // Quiet projects: an award with no recent progress update.
  const { data: updates } = await supabase
    .from("progress_updates")
    .select("challenge_id, created_at")
    .order("created_at", { ascending: false });
  const lastUpdate = new Map<string, string>();
  for (const u of updates ?? []) {
    const k = u.challenge_id as string;
    if (!lastUpdate.has(k)) lastUpdate.set(k, u.created_at as string);
  }

  const { data: windows } = await supabase
    .from("proposal_windows")
    .select("challenge_id, state, awarded_proposal_id, closed_at");
  const quiet = (windows ?? [])
    .filter((w) => w.state === "awarded")
    .map((w) => {
      const cid = w.challenge_id as string;
      const last = lastUpdate.get(cid) ?? (w.closed_at as string | null);
      return {
        challenge_id: cid,
        ref: rows.find((c) => c.id === cid)?.ref ?? null,
        last_update_at: last,
        days_since: ageDays(last),
      };
    })
    .filter((q) => (q.days_since ?? 0) >= 7)
    .sort((a, b) => (b.days_since ?? 0) - (a.days_since ?? 0));

  const competition = {
    windows_open: (windows ?? []).filter((w) => w.state === "open").length,
    windows_awarded: (windows ?? []).filter((w) => w.state === "awarded").length,
    windows_reopened: (windows ?? []).filter((w) => w.state === "reopened").length,
  };

  return ok({
    totals: {
      challenges: rows.length,
      open: open.length,
      severe_open: severe.length,
      solved: solved.length,
    },
    by_status: byStatus,
    by_district: byDistrict,
    severe_open_ages_days: severe
      .map((c) => ageDays(c.created_at as string))
      .filter((d): d is number => d !== null)
      .sort((a, b) => b - a),
    median_verification_hours: medianVerifyHours,
    funding: {
      money_pledged: moneyPledged,
      money_received: moneyReceived,
      material_lines: materialLines,
      material_lines_received: materialReceived,
      currency: "INR",
    },
    sla: slaByStage,
    quiet_projects: quiet,
    competition,
  });
});
