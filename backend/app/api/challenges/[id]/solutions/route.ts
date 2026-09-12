import { ok, route, readJson } from "@/lib/http";
import { solutionSchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { transition } from "@/lib/services/lifecycle";
import { appendLedger } from "@/lib/services/ledger";
import { prefillRatings } from "@/lib/domain/readiness";
import { challengeGap } from "@/lib/services/swarm";

/**
 * POST /api/challenges/:id/solutions - a student team submits a proposal.
 *
 * Cost, time to deploy and local resource availability come back pre-filled as
 * suggested 1-5 ratings, worked out from the numbers in the proposal and from
 * the resource registry. The reviewer then confirms a fact instead of inventing
 * a score.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireRole("university", "industry", "volunteer", "coordinator", "admin");
    const body = await readJson(request, solutionSchema);
    const supabase = await supabaseServer();

    const { data: solution, error } = await supabase
      .from("solutions")
      .insert({
        challenge_id: id,
        org_id: body.org_id ?? actor.orgId,
        submitted_by: actor.id,
        title: body.title,
        approach: body.approach,
        cost_estimate: body.cost_estimate ?? null,
        deploy_days: body.deploy_days ?? null,
        risks: body.risks ?? null,
        status: "submitted",
        is_simulated: false,
      })
      .select("id, title")
      .single();
    if (error) throw error;

    const gap = await challengeGap(supabase, id);
    const { data: signals } = await supabase
      .from("verifications")
      .select("kind")
      .eq("challenge_id", id);
    const rows = signals ?? [];

    const prefill = prefillRatings({
      costEstimate: body.cost_estimate ?? null,
      deployDays: body.deploy_days ?? null,
      localResourceCoverage: gap.needs.length ? gap.pctClosed / 100 : 0,
      communitySignals: {
        positive: rows.filter((r) => r.kind === "improved" || r.kind === "field").length,
        negative: rows.filter((r) => r.kind === "unsuitable" || r.kind === "inaccurate").length,
      },
    });

    await appendLedger(supabase, {
      entity: "solution",
      entityId: id,
      action: "solution_proposed",
      actor: actor.id,
      actorRole: actor.role,
      payload: { solution_id: solution.id, title: solution.title },
    });

    let status: string | null = null;
    try {
      status = (
        await transition(supabase, {
          challengeId: id,
          to: "SOLUTION_PROPOSED",
          actorId: actor.id,
          actorRole: actor.role,
        })
      ).to;
    } catch {
      status = null;
    }

    return ok(
      {
        solution_id: solution.id,
        status,
        /** Suggested ratings. A reviewer can change every one of them. */
        prefilled_ratings: prefill,
      },
      { status: 201 },
    );
  },
);
