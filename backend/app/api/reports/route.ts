import type { NextRequest } from "next/server";
import { ok, fail, route, readJson, rateLimit } from "@/lib/http";
import { submitReportSchema } from "@/lib/validation/schemas";
import { checkUpload } from "@/lib/validation/schemas";
import { supabaseServer, currentActor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { intakeReport } from "@/lib/services/intake";
import { traceTotalMs } from "@/lib/ai/compiler";
import { isSttEnabled } from "@/lib/ai/stt";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/reports - the citizen intake endpoint.
 *
 * Accepts JSON, or multipart when a voice note comes with it. Anonymous
 * reporting is allowed on purpose: someone reporting an unsafe school should
 * not have to create an account first.
 *
 * Idempotent on client_id, so the offline queue can retry as often as it likes.
 */
export const POST = route(async (request: NextRequest) => {
  const actor = await currentActor();
  const contentType = request.headers.get("content-type") ?? "";

  let payload: Record<string, unknown>;
  let audio: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const json = form.get("payload");
    if (typeof json !== "string") {
      return fail(400, "Expected a `payload` field carrying the report JSON.", "validation");
    }
    payload = JSON.parse(json) as Record<string, unknown>;

    const file = form.get("audio");
    if (file instanceof File && file.size > 0) {
      const problem = checkUpload(file, "audio");
      if (problem) return fail(400, problem, "upload");
      audio = file;
    }
  } else {
    payload = (await request.json()) as Record<string, unknown>;
  }

  const input = submitReportSchema.parse(payload);

  // A voice note with no transcriber is the one case worth refusing outright.
  // The pipeline would otherwise compile a content-free brief from the form
  // fields alone ("Unclassified local need in ..."), score it, and push it into
  // the ranked queue - junk that a coordinator then has to clear. Say so
  // instead. Once GROQ_API_KEY is set this branch never runs.
  if (audio && !String(input.text ?? "").trim() && !isSttEnabled()) {
    return fail(
      503,
      "Speech to text is not configured, so the voice note cannot be turned into a report yet. Type a line describing what happened, or try again once transcription is back.",
      "stt_unavailable",
    );
  }

  // Rate limit per account, or per IP for anonymous reports. A speed bump, not
  // a defence: the real limit for SMS is per number, enforced on that route.
  const limitKey = actor?.id ?? request.headers.get("x-forwarded-for") ?? "anon";
  if (!rateLimit(`report:${limitKey}`, 20, 60_000)) {
    return fail(429, "Too many reports from here in the last minute. Please wait.", "rate_limit");
  }

  // The intake pipeline compiles, embeds, merges clusters, and updates challenges.
  // These internal pipeline steps run via the service role, while reporter_id is attributed
  // to the authenticated actor.
  const supabase = supabaseAdmin();

  const result = await intakeReport(supabase, {
    ...input,
    channel: actor?.role === "volunteer" ? "volunteer" : "web",
    reporter_id: actor?.id ?? null,
    audio,
    photo_urls: input.photo_urls,
    vulnerable: input.vulnerable,
  });

  return ok({
    report_id: result.reportId,
    challenge_id: result.challengeId,
    challenge_ref: result.challengeRef,
    decision: result.decision,
    dedup_reason: result.dedupReason,
    possible_duplicates: result.decision === "review" ? result.candidates : [],
    priority: result.priority,
    confidence: result.confidence,
    trace: result.trace,
    trace_total_ms: traceTotalMs(result.trace),
    /** True when any AI step fell back to deterministic code. */
    degraded: result.degraded,
    already_received: result.duplicateSubmission,
  }, { status: result.duplicateSubmission ? 200 : 201 });
});
