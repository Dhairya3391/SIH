import { ok, route } from "@/lib/http";
import { requireActor, supabaseServer } from "@/lib/supabase/server";
import { availableActions } from "@/lib/services/lifecycle";

/**
 * GET /api/challenges/:id/actions - what this person can legally do next.
 *
 * Every screen has exactly one obvious next-action button. This says which one,
 * and lists what is still missing for the ones that are not ready.
 */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireActor();
    const supabase = await supabaseServer();
    return ok(await availableActions(supabase, id, actor.role));
  },
);
