import { ok, fail, route, readJson } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rescoreChallenge } from "@/lib/services/scoring";
import { appendLedger } from "@/lib/services/ledger";
import { notifyReporters } from "@/lib/services/notify";
import { isVerifiedConfidence } from "@/lib/domain/confidence";
import { OPEN_FOR_PROPOSALS, type ChallengeStatus } from "@/lib/domain/types";

const schema = z.object({
  /**
   * Links, or references a verifier actually has in the field: "Block office
   * register entry 14/09" is a source even though it is not a URL.
   */
  source_urls: z.array(z.string().trim().min(3).max(500)).max(10).default([]),
  /** Storage paths returned by POST /api/uploads. */
  photo_paths: z.array(z.string().trim().min(3).max(500)).max(10).default([]),
  note: z.string().trim().min(10, "Say what you checked, in a sentence.").max(2000),
  granted: z.enum(["field_verified", "coordinator_approved"]).default("field_verified"),
});

/** Past this point the problem is in delivery; re-verifying it would rewrite history. */
const PAST_VERIFICATION: ChallengeStatus[] = ["SOLUTION_PROPOSED", "PILOT", "DEPLOYED", "IMPACT_VERIFIED", "DUPLICATE"];

/**
 * POST /api/verify/[id]/confirm - a human confirms a report.
 *
 * Needs at least one source or photo. The problem becomes verified and opens
 * to colleges. A report that was rejected earlier can be confirmed later -
 * rejection is a recorded decision, not a deletion.
 */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("verifier", "volunteer", "coordinator", "admin");
  const { id } = await ctx.params;
  const body = await readJson(request, schema);

  if (body.source_urls.length === 0 && body.photo_paths.length === 0) {
    return fail(
      400,
      "A confirmation needs at least one source or one field photo. Verification without evidence is just an opinion with a timestamp.",
      "evidence_required",
    );
  }
  if (body.granted === "coordinator_approved" && actor.role !== "coordinator" && actor.role !== "admin") {
    return fail(
      403,
      "Only a coordinator can record a coordinator approval. Record this as field verified instead.",
      "forbidden",
    );
  }

  const supabase = supabaseAdmin();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, region_id, confidence, status, created_at, verified_at")
    .eq("id", id)
    .maybeSingle();
  if (!challenge) return fail(404, "No such challenge.", "not_found");
  if (PAST_VERIFICATION.includes(challenge.status as ChallengeStatus)) {
    return fail(409, "This problem has already moved past verification.", "past_verification");
  }

  const { error } = await supabase.from("verifications").insert({
    challenge_id: id,
    by_user: actor.id,
    kind: "field",
    method: body.granted === "coordinator_approved" ? "coordinator" : "field",
    source_urls: body.source_urls,
    photo_paths: body.photo_paths,
    note: body.note,
    evidence_url: body.source_urls.find((s) => /^https?:\/\//i.test(s)) ?? null,
  });
  if (error) throw error;

  const now = new Date().toISOString();
  const opensNow = ["REPORTED", "REFINED", "CLOSED_NOT_ACTIONABLE"].includes(challenge.status as string);
  const status = (opensNow ? "VERIFIED" : challenge.status) as ChallengeStatus;

  await supabase
    .from("challenges")
    .update({
      status,
      verified_at: challenge.verified_at ?? now,
      // A rejection overturned by this verification is no longer closed.
      ...(challenge.status === "CLOSED_NOT_ACTIONABLE" ? { closed_at: null } : {}),
    })
    .eq("id", id);

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: id,
    action: "human_verified",
    actor: actor.id,
    actorRole: actor.role,
    regionId: challenge.region_id as string,
    payload: {
      method: body.granted === "coordinator_approved" ? "coordinator" : "field",
      sources: body.source_urls,
      photos: body.photo_paths.length,
      note: body.note,
      previous_status: challenge.status,
    },
  });

  const scored = await rescoreChallenge(supabase, id);

  if (opensNow) {
    await supabase.rpc("record_timing", {
      p_challenge: id,
      p_stage: "to_verification",
      p_started: challenge.created_at,
      p_ended: now,
    });
    await notifyReporters(supabase, id, "verified", { ref: challenge.ref, method: "a verifier" });
  }

  return ok(
    {
      challenge_id: id,
      ref: challenge.ref,
      confidence: scored.confidence,
      status,
      priority: scored.priority,
      now_visible_to_colleges: isVerifiedConfidence(scored.confidence) && OPEN_FOR_PROPOSALS.includes(status),
      sources_recorded: body.source_urls.length,
      photos_recorded: body.photo_paths.length,
    },
    { status: 201 },
  );
});
