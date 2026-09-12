import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadProject, resolveChallengeId } from "@/lib/services/projects";

/**
 * GET /api/college/projects/[id] - one project, by id or ref.
 *
 * The college's workspace: requirements, contributions awaiting receipt,
 * delivery stages and progress updates. Companies and NGOs read the same page
 * to decide whether to fund it and to follow what their contribution did - but
 * other contributors' contact details are only shown to the college and staff.
 */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("university", "industry", "ngo", "coordinator", "admin");
  const { id } = await ctx.params;
  const supabase = supabaseAdmin();

  const challengeId = await resolveChallengeId(supabase, id);
  const project = await loadProject(supabase, challengeId, actor);

  const privileged = project.viewer.is_college || actor.role === "coordinator" || actor.role === "admin";
  if (!privileged) {
    for (const need of project.needs) {
      for (const pledge of need.pledges) {
        if (pledge.org && pledge.org.id !== actor.orgId) {
          pledge.org = { ...pledge.org, contact_email: null, contact_person: null };
        }
      }
    }
    project.threads = project.threads.filter((t) => t.contributor?.id === actor.orgId);
  }

  return ok(project);
});
