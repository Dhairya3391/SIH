import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgContacts } from "@/lib/services/contacts";
import { formatAmount } from "@/lib/services/swarm";
import { fileUrl } from "@/lib/storage";

/**
 * GET /api/contributions/mine - what this organisation has given, and what
 * happened to it.
 *
 * Includes CLOSED projects on purpose. A problem that is fully funded leaves
 * the needs board, and one that is delivered leaves every main list - but a
 * company or NGO that paid for it is entitled to keep tracking it: the stages,
 * the college's progress updates and photos, and who to ask.
 */
export const GET = route(async () => {
  const actor = await requireRole("industry", "ngo", "university", "admin");
  if (!actor.orgId) return ok({ contributions: [], projects: [], totals: null });

  const supabase = supabaseAdmin();

  const { data: pledges, error } = await supabase
    .from("pledges")
    .select(
      "id, need_id, qty, kind, state, status, note, expected_delivery_date, dispatched_at, received_at, receipt_note, created_at",
    )
    .eq("org_id", actor.orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!pledges || pledges.length === 0) {
    return ok({
      contributions: [],
      projects: [],
      totals: { money: 0, lines: 0, delivered: 0, awaiting_dispatch: 0, awaiting_confirmation: 0 },
    });
  }

  const needIds = [...new Set(pledges.map((p) => p.need_id as string))];
  const { data: needs } = await supabase
    .from("resource_needs")
    .select("id, challenge_id, item, unit, kind, qty_needed")
    .in("id", needIds);
  const needById = new Map((needs ?? []).map((n) => [n.id as string, n]));

  const challengeIds = [...new Set((needs ?? []).map((n) => n.challenge_id as string))];
  const safeIds = challengeIds.length > 0 ? challengeIds : ["00000000-0000-0000-0000-000000000000"];
  const [{ data: challenges }, { data: stages }, { data: updates }, { data: winners }, { data: threads }] =
    await Promise.all([
      supabase
        .from("challenges")
        .select("id, ref, title, district, status, priority, closed_at, deployed_at, people_est")
        .in("id", safeIds),
      supabase
        .from("progress_stages")
        .select("id, challenge_id, seq, title, status, expected_days, started_at, completed_at")
        .in("challenge_id", safeIds)
        .order("seq"),
      supabase
        .from("progress_updates")
        .select("id, challenge_id, note, photo_paths, created_at")
        .in("challenge_id", safeIds)
        .order("created_at", { ascending: false }),
      supabase.from("proposals").select("challenge_id, org_id").eq("state", "winner").in("challenge_id", safeIds),
      supabase
        .from("threads")
        .select("id, challenge_id")
        .eq("contributor_org_id", actor.orgId)
        .in("challenge_id", safeIds),
    ]);
  const challengeById = new Map((challenges ?? []).map((c) => [c.id as string, c]));
  const collegeFor = new Map((winners ?? []).map((w) => [w.challenge_id as string, w.org_id as string]));
  const contacts = await orgContacts(supabase, (winners ?? []).map((w) => w.org_id as string));
  const threadFor = new Map((threads ?? []).map((t) => [t.challenge_id as string, t.id as string]));

  const isClosed = (c: Record<string, unknown> | undefined) =>
    Boolean(c && (c.closed_at || ["DEPLOYED", "IMPACT_VERIFIED", "CLOSED_NOT_ACTIONABLE"].includes(c.status as string)));

  const contributions = pledges.map((p) => {
    const need = needById.get(p.need_id as string);
    const challenge = need ? challengeById.get(need.challenge_id as string) : undefined;
    const state = ((p.state as string) ?? (p.status as string) ?? "offered").toString();
    return {
      id: p.id as string,
      qty: Number(p.qty ?? 0),
      kind: p.kind as string,
      amount: formatAmount(Number(p.qty ?? 0), (need?.unit as string) ?? null, p.kind as string),
      state,
      note: p.note as string | null,
      expected_delivery_date: p.expected_delivery_date as string | null,
      dispatched_at: p.dispatched_at as string | null,
      received_at: p.received_at as string | null,
      receipt_note: p.receipt_note as string | null,
      created_at: p.created_at as string,
      // What the other side is still waiting for, in plain terms.
      awaiting:
        state === "dispatched"
          ? "college confirmation"
          : state === "offered" || state === "committed"
            ? "dispatch"
            : null,
      can_dispatch: state === "offered" || state === "committed",
      can_withdraw: state === "offered" || state === "committed",
      need: need
        ? { id: need.id, item: need.item, unit: need.unit, qty_needed: Number(need.qty_needed ?? 0) }
        : null,
      challenge: challenge
        ? {
            id: challenge.id,
            ref: challenge.ref,
            title: challenge.title,
            district: challenge.district,
            status: challenge.status,
            priority: challenge.priority,
            closed: isClosed(challenge),
            people_est: challenge.people_est,
          }
        : null,
    };
  });

  const projects = [...challengeById.values()].map((c) => {
    const cid = c.id as string;
    const mine = contributions.filter((x) => x.challenge?.id === cid);
    const cStages = (stages ?? []).filter((s) => s.challenge_id === cid);
    const done = cStages.filter((s) => s.status === "done").length;
    const cUpdates = (updates ?? []).filter((u) => u.challenge_id === cid);
    const latest = cUpdates[0] ?? null;
    const college = collegeFor.get(cid);
    return {
      id: cid,
      ref: c.ref as string,
      title: c.title as string,
      district: c.district as string,
      status: c.status as string,
      closed: isClosed(c),
      college: college ? (contacts.get(college) ?? null) : null,
      thread_id: threadFor.get(cid) ?? null,
      my_contributions: mine.length,
      my_money: mine.filter((m) => m.kind === "money").reduce((s, m) => s + m.qty, 0),
      stages_total: cStages.length,
      stages_done: done,
      progress_pct: cStages.length > 0 ? Math.round((done / cStages.length) * 100) : null,
      stages: cStages.map((s) => ({
        id: s.id as string,
        seq: s.seq as number,
        title: s.title as string,
        status: s.status as string,
        started_at: (s.started_at as string) ?? null,
        completed_at: (s.completed_at as string) ?? null,
      })),
      latest_update: latest
        ? {
            note: latest.note,
            at: latest.created_at,
            photos: ((latest.photo_paths as string[]) ?? []).map((p) => fileUrl(p)),
          }
        : null,
      recent_updates: cUpdates.slice(0, 3).map((u) => ({
        note: u.note as string,
        at: u.created_at as string,
        photos: ((u.photo_paths as string[]) ?? []).map((p) => fileUrl(p)),
      })),
      days_since_update: latest
        ? Math.floor((Date.now() - new Date(latest.created_at as string).getTime()) / 86_400_000)
        : null,
    };
  });

  return ok({
    contributions,
    projects: projects.sort((a, b) => Number(a.closed) - Number(b.closed)),
    totals: {
      money: contributions.filter((c) => c.kind === "money" && c.state !== "withdrawn").reduce((s, c) => s + c.qty, 0),
      lines: contributions.filter((c) => c.state !== "withdrawn").length,
      delivered: contributions.filter((c) => c.state === "received").length,
      awaiting_dispatch: contributions.filter((c) => c.awaiting === "dispatch").length,
      awaiting_confirmation: contributions.filter((c) => c.awaiting === "college confirmation").length,
    },
  });
});
