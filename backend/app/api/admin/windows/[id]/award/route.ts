import { ok, fail, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { closeWindow, getWindow } from "@/lib/services/proposals";
import { resolveChallengeId } from "@/lib/services/projects";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/admin/windows/[id]/award - close a proposal window now.
 *
 * The same close the clock would do, early: anything still being analysed is
 * scored first, the highest viable proposal wins, the others are told, and
 * delivery stages are drawn from the winning document. With nothing viable the
 * window reopens instead. Ledgered as a manual close.
 */
export const POST = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("admin", "coordinator");
  const { id } = await ctx.params;
  const supabase = supabaseAdmin();
  const challengeId = await resolveChallengeId(supabase, id);

  const win = await getWindow(supabase, challengeId);
  if (!win) return fail(404, "No proposal has been submitted for this problem, so there is no window to close.", "no_window");
  if (win.state !== "open") {
    return fail(409, `This window is already ${win.state}.`, "not_open");
  }

  const outcome = await closeWindow(supabase, challengeId, {
    actorId: actor.id,
    actorRole: actor.role,
    manual: true,
  });
  return ok(outcome);
});
