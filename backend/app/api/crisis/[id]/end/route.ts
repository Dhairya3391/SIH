import { ok, route } from "@/lib/http";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { endCrisis, draftPreparednessFollowUps } from "@/lib/services/crisis";

/**
 * POST /api/crisis/:id/end - close the crisis or the drill.
 *
 * Closing it does one more thing: the platform drafts the preparedness work
 * that should happen before the next season, derived from what actually had to
 * be solved during the event. That is how a drone medicine corridor becomes a
 * planned project with time to get flight approvals, instead of something
 * improvised mid-flood.
 */
export const POST = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireRole("coordinator", "admin");
    const supabase = await supabaseServer();

    const { crisis, challengesReverted } = await endCrisis(supabase, id, actor.id);
    const drafted = await draftPreparednessFollowUps(supabase, id, actor.id);

    return ok({
      crisis,
      challenges_reverted: challengesReverted,
      preparedness_drafted: drafted,
    });
  },
);
