import { ok, route, readJson } from "@/lib/http";
import { requirementsSchema } from "@/lib/validation/schemas";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishRequirements, resolveChallengeId } from "@/lib/services/projects";

/**
 * POST /api/college/projects/[id]/requirements - publish what the project needs.
 *
 * A funding amount in rupees and a list of materials with quantities, usually
 * pre-filled from the college's own proposal. Funding lines go to NGOs, material
 * lines to companies, and each can be covered in parts. Sending a line that is
 * already listed edits it, as long as nobody has pledged against it.
 */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("university", "admin");
  const { id } = await ctx.params;
  const body = await readJson(request, requirementsSchema);
  const supabase = supabaseAdmin();
  const challengeId = await resolveChallengeId(supabase, id);
  return ok(await publishRequirements(supabase, actor, challengeId, body), { status: 201 });
});
