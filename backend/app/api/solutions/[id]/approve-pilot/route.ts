import { ok, fail, route, readJson } from "@/lib/http";
import { approvePilotSchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { isFullyRated } from "@/lib/domain/readiness";
import { transition } from "@/lib/services/lifecycle";
import { createNeedsAndAlert } from "@/lib/services/swarm";

/**
 * POST /api/solutions/:id/approve-pilot - the readiest proposal gets a pilot.
 *
 * Approving creates the resource needs and fires the capability-match alerts,
 * which is the moment the Resource Swarm starts. A pilot cannot be approved on
 * a half-finished review: all seven readiness factors have to be rated first.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireRole("coordinator", "admin");
    const body = await readJson(request, approvePilotSchema);
    const supabase = await supabaseServer();

    const { data: solution, error } = await supabase
      .from("solutions")
      .select("id, challenge_id, title, ratings, readiness")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!solution) return fail(404, "No such proposal.", "not_found");

    if (!isFullyRated((solution.ratings ?? {}) as Record<string, number>)) {
      return fail(
        422,
        "Rate all seven readiness factors before approving this for a pilot.",
        "incomplete_review",
      );
    }

    await supabase.from("solutions").update({ status: "approved_for_pilot" }).eq("id", id);

    // Exactly one proposal per challenge gets the pilot.
    await supabase
      .from("solutions")
      .update({ status: "rejected" })
      .eq("challenge_id", solution.challenge_id)
      .neq("id", id)
      .in("status", ["submitted", "under_review"]);

    const needs = await createNeedsAndAlert(supabase, {
      challengeId: solution.challenge_id,
      solutionId: id,
      actorId: actor.id,
      needs: body.needs,
    });

    const moved = await transition(supabase, {
      challengeId: solution.challenge_id,
      to: "PILOT",
      actorId: actor.id,
      actorRole: actor.role,
      reason: `Pilot approved for ${solution.title} at readiness ${solution.readiness}.`,
    });

    return ok({
      solution_id: id,
      challenge_id: solution.challenge_id,
      status: moved.to,
      readiness: solution.readiness,
      needs,
    });
  },
);
