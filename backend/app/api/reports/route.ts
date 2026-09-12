import type { NextRequest } from "next/server";
import { ok, fail, route, readJson, rateLimit } from "@/lib/http";
import { submitReportSchema } from "@/lib/validation/schemas";
import { checkUpload } from "@/lib/validation/schemas";
import { supabaseServer, currentActor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { intakeReport } from "@/lib/services/intake";
import { traceTotalMs } from "@/lib/ai/compiler";
import { isSttEnabled, transcribe } from "@/lib/ai/stt";

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
/**
 * GET /api/reports - the reports this signed-in person filed, and where each
 * one landed.
 *
 * Deliberately scoped to reporter_id and nothing else. Anonymous reporters are
 * NOT served here: their client_id is a device-local token, and accepting it
 * as a lookup key would turn a guessable string into a way to read a
 * stranger's words. An anonymous reporter follows their report through the
 * challenge ref the POST already returned, which is public by design.
 */
export const GET = route(async (request: NextRequest) => {
  const actor = await currentActor();
  if (!actor) {
    return fail(
      401,
      "Sign in to see the reports filed from your account. A report filed without an account can still be followed through the reference number you were given.",
      "unauthenticated",
    );
  }

  const limit = Math.min(
    Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50,
    200,
  );

  const supabase = supabaseAdmin();

  const { data: reports, error } = await supabase
    .from("reports")
    .select(
      "id, client_id, channel, district, village, lang, original_text, translated_text, people_est, urgency, vulnerable, photo_urls, audio_url, cluster_id, dedup_similarity, created_at, processed_at",
    )
    .eq("reporter_id", actor.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  if (!reports || reports.length === 0) {
    return ok({ reports: [], challenges: [], count: 0 });
  }

  const clusterIds = [
    ...new Set(reports.map((r) => r.cluster_id as string | null).filter(Boolean) as string[]),
  ];

  const { data: challenges } = clusterIds.length
    ? await supabase
        .from("challenges")
        .select(
          "id, ref, title, district, category, status, confidence, priority, severity, people_est, report_count, verified_at, updated_at",
        )
        .in("id", clusterIds)
    : { data: [] as Record<string, unknown>[] };

  const byId = new Map((challenges ?? []).map((c) => [c.id as string, c]));

  return ok({
    reports: reports.map((r) => {
      const challenge = r.cluster_id ? byId.get(r.cluster_id as string) : null;
      return {
        id: r.id as string,
        client_id: r.client_id as string,
        channel: r.channel as string,
        district: r.district as string | null,
        village: r.village as string | null,
        lang: r.lang as string,
        original_text: r.original_text as string | null,
        translated_text: r.translated_text as string | null,
        people_est: r.people_est as number | null,
        urgency: r.urgency as number | null,
        vulnerable: (r.vulnerable ?? []) as string[],
        photo_count: ((r.photo_urls ?? []) as string[]).length,
        has_audio: Boolean(r.audio_url),
        created_at: r.created_at as string,
        /** Null while the compiler has not run yet - shown as "being read". */
        processed_at: r.processed_at as string | null,
        dedup_similarity: r.dedup_similarity as number | null,
        challenge: challenge
          ? {
              id: challenge.id as string,
              ref: challenge.ref as string,
              title: challenge.title as string,
              district: challenge.district as string | null,
              category: challenge.category as string,
              status: challenge.status as string,
              confidence: challenge.confidence as string,
              priority: challenge.priority as number,
              severity: challenge.severity as number,
              people_est: challenge.people_est as number,
              /** How many reports it took to build this one challenge. */
              report_count: challenge.report_count as number,
              verified_at: challenge.verified_at as string | null,
              updated_at: challenge.updated_at as string,
            }
          : null,
      };
    }),
    count: reports.length,
  });
});

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

  // An audio-only report is transcribed HERE, before anything is written.
  //
  // The pipeline would otherwise compile a content-free brief from the form
  // fields alone ("Unclassified local need in ..."), score it, and push it into
  // the ranked queue - junk a coordinator then has to clear. Doing it after
  // intake is no good either: the rows would already exist and refusing would
  // just orphan them. So transcribe first, refuse cleanly, write nothing.
  let transcribedText: string | null = null;
  if (audio && !String(input.text ?? "").trim()) {
    if (!isSttEnabled()) {
      return fail(
        503,
        "Speech to text is not configured, so the voice note cannot be turned into a report yet. Type a line describing what happened.",
        "stt_unavailable",
      );
    }
    let spoken: Awaited<ReturnType<typeof transcribe>>;
    try {
      spoken = await transcribe(audio, { languageHint: input.lang ?? undefined });
      transcribedText = (spoken.text ?? "").trim();
    } catch (err) {
      return fail(
        503,
        `That recording could not be transcribed - it may be too short, too quiet, or in an unsupported format. Try recording again, or type a line describing what happened. (${
          err instanceof Error ? err.message : "unknown error"
        })`,
        "transcription_failed",
      );
    }
    if (!transcribedText || spoken.likelyHallucination) {
      // Whisper fabricates text from silence rather than returning nothing, so
      // "empty" is not the only way a recording can carry no report. Filing
      // one of its canned disclaimers as a citizen's words would be a
      // fabricated record in their name.
      return fail(
        422,
        "No speech could be made out in that recording - it may have been too quiet, or the microphone may not have picked anything up. Try again closer to the microphone, or type a line instead.",
        "no_speech_detected",
      );
    }
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
    // Already transcribed above; passing the audio again would bill a second call.
    text: transcribedText ?? input.text,
    channel: actor?.role === "volunteer" ? "volunteer" : "web",
    reporter_id: actor?.id ?? null,
    audio: transcribedText ? null : audio,
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
