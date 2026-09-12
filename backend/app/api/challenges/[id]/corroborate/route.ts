import { ok, fail, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runCorroboration } from "@/lib/services/corroboration";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/challenges/[id]/corroborate - look for independent proof again.
 *
 * The same check that runs automatically when a report arrives, run on demand
 * by a verifier - for example after a news story breaks a day later. It runs
 * weather, news and web, records one external_checks row per provider, and
 * when the proof is real it verifies the problem with those sources attached,
 * exactly as the automatic check would.
 *
 * A contradicting verdict is recorded as a flag for the verifier, never
 * applied: a villager can be right while the internet is silent.
 */
export const POST = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("verifier", "volunteer", "coordinator", "admin");
  const { id } = await ctx.params;
  const supabase = supabaseAdmin();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id")
    .eq(isUuid ? "id" : "ref", isUuid ? id : id.toUpperCase())
    .maybeSingle();
  if (!challenge) return fail(404, "No such challenge.", "not_found");

  // A verifier asking explicitly gets the search even for a non-disaster report.
  const outcome = await runCorroboration(supabase, challenge.id as string, {
    trigger: "manual",
    actorId: actor.id,
    force: true,
  });

  return ok({
    ...outcome,
    still_needs_a_human: !outcome.auto_verified,
  });
});
