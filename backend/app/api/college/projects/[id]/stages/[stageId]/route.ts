import { ok, route, readJson } from "@/lib/http";
import { stageUpdateSchema } from "@/lib/validation/schemas";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveChallengeId, updateStage } from "@/lib/services/projects";

/**
 * POST /api/college/projects/[id]/stages/[stageId] - move a delivery stage.
 *
 * Starting a stage, finishing it or marking it blocked writes a progress
 * update too, so the admin console's time-between-updates includes it. The
 * last stage done marks the work complete and asks the reporters to confirm.
 */
export const POST = route(
  async (request: Request, ctx: { params: Promise<{ id: string; stageId: string }> }) => {
    const actor = await requireRole("university", "admin");
    const { id, stageId } = await ctx.params;
    const body = await readJson(request, stageUpdateSchema);
    const supabase = supabaseAdmin();
    const challengeId = await resolveChallengeId(supabase, id);
    return ok(await updateStage(supabase, actor, challengeId, stageId, body));
  },
);
