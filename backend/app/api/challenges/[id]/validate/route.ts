import { ok, route, readJson } from "@/lib/http";
import { validateSchema } from "@/lib/validation/schemas";
import { requireActor, supabaseServer } from "@/lib/supabase/server";
import { rescoreChallenge } from "@/lib/services/scoring";
import { appendLedger } from "@/lib/services/ledger";

/**
 * POST /api/challenges/:id/validate - field verification and community signals.
 *
 * A volunteer files a `field` verification with a photo, which moves the
 * challenge up the confidence ladder. Verified locals can also say a problem is
 * still there, has improved, is inaccurate, affects more people than recorded,
 * or that the proposed solution will not work here.
 *
 * An `inaccurate` flag pulls confidence down a rung until somebody checks. Low
 * confidence is labelled, never hidden.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireActor();
    const body = await readJson(request, validateSchema);
    const supabase = await supabaseServer();

    const { error } = await supabase.from("verifications").insert({
      challenge_id: id,
      by_user: actor.id,
      kind: body.kind,
      evidence_url: body.evidence_url ?? null,
      note: body.note ?? null,
    });
    if (error) throw error;

    await appendLedger(supabase, {
      entity: "challenge",
      entityId: id,
      action: `validated_${body.kind}`,
      actor: actor.id,
      actorRole: actor.role,
      payload: { note: body.note, evidence_url: body.evidence_url },
    });

    const scored = await rescoreChallenge(supabase, id);
    return ok({
      kind: body.kind,
      confidence: scored.confidence,
      priority: scored.priority,
      why_critical: scored.whyCritical,
    });
  },
);
