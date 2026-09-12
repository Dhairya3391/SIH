import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { removeRequirement, resolveChallengeId } from "@/lib/services/projects";

/** DELETE /api/college/projects/[id]/requirements/[needId] - remove a line nobody has pledged against. */
export const DELETE = route(
  async (_request: Request, ctx: { params: Promise<{ id: string; needId: string }> }) => {
    const actor = await requireRole("university", "admin");
    const { id, needId } = await ctx.params;
    const supabase = supabaseAdmin();
    const challengeId = await resolveChallengeId(supabase, id);
    return ok(await removeRequirement(supabase, actor, challengeId, needId));
  },
);
