import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opportunisticTick } from "@/lib/services/tick";

/**
 * GET /api/admin/windows - proposal windows, open ones first.
 *
 * Each with its closing time, how many proposals are in, how many the AI found
 * viable, how many are still being analysed, and the leading score - what an
 * administrator needs before closing one early.
 */
export const GET = route(async () => {
  await requireRole("admin", "coordinator");
  const supabase = supabaseAdmin();
  await opportunisticTick(supabase);

  const { data: windows, error } = await supabase
    .from("proposal_windows")
    .select("challenge_id, state, opened_at, closes_at, closed_at, window_days, leader_score, reopen_count, awarded_proposal_id")
    .order("closes_at", { ascending: true });
  if (error) throw error;

  const ids = (windows ?? []).map((w) => w.challenge_id as string);
  const [{ data: challenges }, { data: proposals }] = ids.length
    ? await Promise.all([
        supabase.from("challenges").select("id, ref, title, district, priority, status").in("id", ids),
        supabase.from("proposals").select("challenge_id, state, ai_verdict").in("challenge_id", ids),
      ])
    : [{ data: [] as Record<string, unknown>[] }, { data: [] as Record<string, unknown>[] }];
  const byId = new Map((challenges ?? []).map((c) => [c.id as string, c]));

  const rows = (windows ?? []).map((w) => {
    const c = byId.get(w.challenge_id as string);
    const ps = (proposals ?? []).filter((p) => p.challenge_id === w.challenge_id);
    return {
      ...w,
      ref: (c?.ref as string) ?? null,
      title: (c?.title as string) ?? null,
      district: (c?.district as string) ?? null,
      priority: (c?.priority as number) ?? null,
      challenge_status: (c?.status as string) ?? null,
      proposals: ps.length,
      viable: ps.filter((p) => p.ai_verdict === "viable").length,
      awaiting_score: ps.filter((p) => p.state === "submitted" || p.state === "scoring").length,
    };
  });

  const order = (s: string) => (s === "open" ? 0 : s === "reopened" ? 1 : 2);
  rows.sort((a, b) => order(a.state as string) - order(b.state as string));
  return ok({ windows: rows, count: rows.length });
});
