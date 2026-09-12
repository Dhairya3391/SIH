import { ok, fail, route, readJson } from "@/lib/http";
import { transitionSchema } from "@/lib/validation/schemas";
import { requireActor, supabaseServer } from "@/lib/supabase/server";
import { transition } from "@/lib/services/lifecycle";

/**
 * POST /api/challenges/:id/transition - the general lifecycle move.
 *
 * Used for the transitions that have no dedicated endpoint, including the
 * crisis fast path (OPEN straight to DEPLOYED, because delivering drinking
 * water cannot wait for proposals) and CLOSED_NOT_ACTIONABLE.
 *
 * Closing something as not actionable needs a written reason of at least ten
 * characters, it is logged, and the reporter is told why. AI never reaches this
 * state: only a human can set it.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireActor();
    const body = await readJson(request, transitionSchema);
    const supabase = await supabaseServer();

    if (body.to === "CLOSED_NOT_ACTIONABLE" && (!body.reason || body.reason.trim().length < 10)) {
      return fail(
        422,
        "Closing something as not actionable needs a written reason. The reporter is told what it says.",
        "reason_required",
      );
    }

    const result = await transition(supabase, {
      challengeId: id,
      to: body.to,
      actorId: actor.id,
      actorRole: actor.role,
      reason: body.reason,
    });

    return ok(result);
  },
);
