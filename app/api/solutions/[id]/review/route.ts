import { ok, route, readJson } from "@/lib/http";
import { reviewSchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { computeReadiness, isFullyRated, DEFAULT_READINESS_WEIGHTS } from "@/lib/domain/readiness";
import { appendLedger } from "@/lib/services/ledger";

/**
 * POST /api/solutions/:id/review - the Readiness Score.
 *
 * Seven factors, each rated 1-5 by a coordinator or a faculty mentor. This is
 * the demo beat that lands hardest: an impressive AI prediction system scores
 * 48, a cheap siren relay scores 84, and the one that can actually be deployed
 * gets the pilot.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireRole("coordinator", "admin");
    const body = await readJson(request, reviewSchema);
    const supabase = await supabaseServer();

    const { data: weightRow } = await supabase
      .from("scoring_weights")
      .select("weights, updated_at")
      .eq("id", "readiness")
      .maybeSingle();

    const weights = { ...DEFAULT_READINESS_WEIGHTS, ...((weightRow?.weights as object) ?? {}) };
    const breakdown = computeReadiness(
      body.ratings,
      weights,
      weightRow ? `db:${weightRow.updated_at}` : "code-default",
    );

    const { data: solution, error } = await supabase
      .from("solutions")
      .update({
        ratings: body.ratings,
        readiness: breakdown.total,
        readiness_notes: body.notes ?? null,
        status: "under_review",
        reviewed_by: actor.id,
      })
      .eq("id", id)
      .select("id, challenge_id, title")
      .single();
    if (error) throw error;

    await appendLedger(supabase, {
      entity: "solution",
      entityId: solution.challenge_id,
      action: "readiness_rated",
      actor: actor.id,
      actorRole: actor.role,
      payload: {
        solution_id: id,
        title: solution.title,
        readiness: breakdown.total,
        ratings: body.ratings,
      },
    });

    return ok({
      solution_id: id,
      readiness: breakdown.total,
      breakdown,
      complete: isFullyRated(body.ratings),
    });
  },
);
