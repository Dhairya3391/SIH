import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/contributions/mine - what this organisation has given, and what
 * happened to it.
 *
 * Includes CLOSED projects on purpose. A company that funded something is
 * entitled to see how it finished, and a project leaving the main list must
 * not take its funders' record of it away.
 */
export const GET = route(async () => {
  const actor = await requireRole("industry", "university", "admin");
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
    return ok({ contributions: [], projects: [], totals: { money: 0, lines: 0, delivered: 0 } });
  }

  const needIds = [...new Set(pledges.map((p) => p.need_id as string))];
  const { data: needs } = await supabase
    .from("resource_needs")
    .select("id, challenge_id, item, unit, kind, qty_needed")
    .in("id", needIds);
  const needById = new Map((needs ?? []).map((n) => [n.id as string, n]));

  const challengeIds = [...new Set((needs ?? []).map((n) => n.challenge_id as string))];
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, ref, title, district, status, priority, closed_at, people_est")
    .in("id", challengeIds);
  const challengeById = new Map((challenges ?? []).map((c) => [c.id as string, c]));

  // Stages, so a contributor can see the work their material unblocked.
  const { data: stages } = await supabase
    .from("progress_stages")
    .select("id, challenge_id, seq, title, status, expected_days, completed_at")
    .in("challenge_id", challengeIds.length > 0 ? challengeIds : ["none"])
    .order("seq");
  const { data: updates } = await supabase
    .from("progress_updates")
    .select("id, challenge_id, note, photo_paths, created_at")
    .in("challenge_id", challengeIds.length > 0 ? challengeIds : ["none"])
    .order("created_at", { ascending: false });

  const contributions = pledges.map((p) => {
    const need = needById.get(p.need_id as string);
    const challenge = need ? challengeById.get(need.challenge_id as string) : null;
    const state = ((p.state as string) ?? (p.status as string) ?? "offered").toString();
    return {
      id: p.id as string,
      qty: Number(p.qty ?? 0),
      kind: p.kind as string,
      state,
      note: p.note as string | null,
      expected_delivery_date: p.expected_delivery_date as string | null,
      dispatched_at: p.dispatched_at as string | null,
      received_at: p.received_at as string | null,
      receipt_note: p.receipt_note as string | null,
      created_at: p.created_at as string,
      // What the college is still waiting on, in plain terms.
      awaiting: state === "dispatched" ? "college confirmation" : state === "offered" || state === "committed" ? "dispatch" : null,
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
            closed: Boolean(challenge.closed_at),
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
    const latest = (updates ?? []).find((u) => u.challenge_id === cid) ?? null;
    return {
      id: cid,
      ref: c.ref as string,
      title: c.title as string,
      district: c.district as string,
      status: c.status as string,
      closed: Boolean(c.closed_at),
      my_contributions: mine.length,
      my_money: mine.filter((m) => m.kind === "money").reduce((s, m) => s + m.qty, 0),
      stages_total: cStages.length,
      stages_done: done,
      progress_pct: cStages.length > 0 ? Math.round((done / cStages.length) * 100) : null,
      latest_update: latest
        ? { note: latest.note, at: latest.created_at, photos: latest.photo_paths }
        : null,
      days_since_update: latest
        ? Math.floor((Date.now() - new Date(latest.created_at as string).getTime()) / 86_400_000)
        : null,
    };
  });

  return ok({
    contributions,
    projects: projects.sort((a, b) => Number(a.closed) - Number(b.closed)),
    totals: {
      money: contributions.filter((c) => c.kind === "money").reduce((s, c) => s + c.qty, 0),
      lines: contributions.length,
      delivered: contributions.filter((c) => c.state === "received").length,
      awaiting_dispatch: contributions.filter((c) => c.awaiting === "dispatch").length,
      awaiting_confirmation: contributions.filter((c) => c.awaiting === "college confirmation")
        .length,
    },
  });
});
