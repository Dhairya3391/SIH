import { ok, fail, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/organizations/:id - the organisation profile.
 *
 * Expertise, resources with their locations, response radius, past challenges
 * completed, and whether an admin has verified the account. An unverified
 * organisation can browse but cannot adopt a challenge or pledge anything.
 */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const supabase = await supabaseServer();

    const { data: org, error } = await supabase
      .from("organizations")
      .select("id, region_id, type, name, district, response_radius_km, expertise, csr_focus, csr_budget, about, verified, is_simulated, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!org) return fail(404, "No such organisation.", "not_found");

    const [capabilities, resources, assignments, pledges] = await Promise.all([
      supabase
        .from("org_capabilities")
        .select("capability, capacity, available_from, note")
        .eq("org_id", id),
      supabase
        .from("resources")
        .select("id, type, label, quantity, unit, availability, updated_at")
        .eq("org_id", id),
      supabase
        .from("assignments")
        .select("challenge_id, role, accepted_at, released_at, challenges(ref, title, status, district, priority)")
        .eq("org_id", id)
        .order("accepted_at", { ascending: false })
        .limit(25),
      supabase
        .from("pledges")
        .select("qty, kind, status, created_at, resource_needs(item, unit, challenge_id)")
        .eq("org_id", id)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    const assignmentRows = assignments.data ?? [];
    const completed = assignmentRows.filter((a) => {
      const challenge = a.challenges as unknown as { status?: string } | null;
      return challenge?.status === "DEPLOYED" || challenge?.status === "IMPACT_VERIFIED";
    }).length;

    return ok({
      organization: org,
      capabilities: capabilities.data ?? [],
      resources: resources.data ?? [],
      assignments: assignmentRows,
      pledges: pledges.data ?? [],
      stats: {
        challenges_taken: assignmentRows.length,
        challenges_completed: completed,
        resources_listed: (resources.data ?? []).length,
        pledges_made: (pledges.data ?? []).length,
      },
      /** Shown as a plain sentence, not just a greyed-out button. */
      can_act: org.verified,
    });
  },
);
