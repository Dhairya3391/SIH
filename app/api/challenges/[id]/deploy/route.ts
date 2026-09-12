import { ok, route, readJson } from "@/lib/http";
import { deploySchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { closeWithEvidence } from "@/lib/services/lifecycle";

/**
 * POST /api/challenges/:id/deploy - evidence-based closure.
 *
 * "It cannot be closed with a button. It closes with evidence." Concretely: a
 * completion note, at least one photo or document, a beneficiary count, and a
 * field volunteer or coordinator confirming it. If any of those is missing this
 * returns 422 listing every one of them, rather than failing one at a time.
 *
 * The impact record is written here too: people served, time to match, time to
 * resolution and remaining need. Those are the numbers the ledger keeps.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireRole("coordinator", "admin");
    const body = await readJson(request, deploySchema);
    const supabase = await supabaseServer();

    const result = await closeWithEvidence(supabase, {
      challengeId: id,
      actorId: actor.id,
      actorRole: actor.role,
      completionNote: body.completion_note,
      peopleServed: body.people_served,
      vulnerableServed: body.vulnerable_served,
      remainingNeed: body.remaining_need,
      followUpHours: body.follow_up_hours,
    });

    const { data: impact } = await supabase
      .from("impact_records")
      .select("*")
      .eq("challenge_id", id)
      .single();

    return ok({
      status: body.follow_up_hours ? "NEEDS_FOLLOW_UP" : result.to,
      impact,
      /** The community still has to confirm the fix before it reaches IMPACT_VERIFIED. */
      awaiting_community_confirmation: true,
    });
  },
);
