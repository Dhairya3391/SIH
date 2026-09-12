import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { compile, type TraceStep } from "@/lib/ai/compiler";
import { toPgVector } from "@/lib/ai/embeddings";
import { decideDedup, DEDUP_THRESHOLDS, type DedupCandidate } from "@/lib/domain/dedup";
import { appendLedger } from "./ledger";
import { rescoreChallenge } from "./scoring";
import { notifyReporter } from "./notify";
import type { SubmitReportInput } from "@/lib/validation/schemas";
import type { VulnerabilityTag } from "@/lib/domain/types";

/**
 * The intake pipeline. Every channel ends up here.
 *
 * The citizen PWA, the SMS gateway, a volunteer reporting on someone's behalf,
 * and later IVR or WhatsApp all call this same function. That is what makes
 * adding a channel a matter of writing an adapter rather than a rewrite.
 *
 *   save the report -> compile -> embed -> look for duplicates
 *     -> join a cluster, or open a new challenge
 *     -> recount, rescore, write the ledger, tell the reporter
 */

export interface IntakeInput extends Omit<SubmitReportInput, "photo_urls" | "vulnerable"> {
  photo_urls: string[];
  vulnerable: VulnerabilityTag[];
  channel: "web" | "sms" | "volunteer" | "ivr";
  reporter_id?: string | null;
  phone_hash?: string | null;
  audio?: File | null;
  is_simulated?: boolean;
}

export interface IntakeResult {
  reportId: string;
  challengeId: string;
  challengeRef: string | null;
  /** "merge" means this report joined an existing cluster. */
  decision: "merge" | "review" | "new";
  dedupReason: string;
  candidates: DedupCandidate[];
  trace: TraceStep[];
  priority: number;
  confidence: string;
  degraded: boolean;
  /** Why a voice note produced no transcript, when one was sent. */
  transcriptionFailure?: "not_configured" | "failed" | null;
  /** True when the same client_id had already been filed. */
  duplicateSubmission: boolean;
}

export async function intakeReport(
  supabase: SupabaseClient,
  input: IntakeInput,
): Promise<IntakeResult> {
  // --- idempotency --------------------------------------------------------
  // An offline queue retries until it succeeds. The server has to be able to
  // absorb that without counting the same problem five times.
  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from("reports")
    .select("id, cluster_id")
    .eq("region_id", input.region_id)
    .eq("client_id", input.client_id)
    .maybeSingle();

  if (existing) {
    let challenge: { id: string; ref: string | null; priority: number; confidence: string } | null = null;
    if (existing.cluster_id) {
      const { data: c } = await admin
        .from("challenges")
        .select("id, ref, priority, confidence")
        .eq("id", existing.cluster_id)
        .single();
      challenge = c;
    }
    return {
      reportId: existing.id,
      challengeId: existing.cluster_id ?? "",
      challengeRef: challenge?.ref ?? null,
      decision: "merge",
      dedupReason: "This report had already been received, so nothing was duplicated.",
      candidates: [],
      trace: [],
      priority: challenge?.priority ?? 0,
      confidence: challenge?.confidence ?? "unverified",
      degraded: false,
      transcriptionFailure: null,
      duplicateSubmission: true,
    };
  }

  const geom = pointOrNull(input.lat, input.lng);

  // --- 1. save the report first ------------------------------------------
  // Before anything that can fail. A citizen's report is never lost because a
  // model was slow.
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      client_id: input.client_id,
      region_id: input.region_id,
      reporter_id: input.reporter_id ?? null,
      channel: input.channel,
      sms_code: input.sms_code ?? null,
      phone_hash: input.phone_hash ?? null,
      original_text: input.text ?? null,
      lang: input.lang,
      audio_url: input.audio_url ?? null,
      photo_urls: input.photo_urls,
      geom,
      location_source: input.location_source,
      district: input.district ?? null,
      village: input.village ?? null,
      people_est: input.people_est ?? null,
      urgency: input.urgency ?? null,
      vulnerable: input.vulnerable,
      consent: input.consent,
      is_simulated: input.is_simulated ?? false,
      created_at: input.captured_at ?? undefined,
    })
    .select("id")
    .single();
  if (reportError) throw reportError;

  // --- 2 and 3. compile and embed ----------------------------------------
  const compiled = await compile({
    text: input.text,
    audio: input.audio,
    languageHint: input.lang,
    peopleEst: input.people_est,
    urgency: input.urgency,
    vulnerable: input.vulnerable,
    district: input.district,
    village: input.village,
    channel: input.channel,
  });

  const embeddingLiteral = toPgVector(compiled.embedding);

  await supabase
    .from("reports")
    .update({
      translated_text: compiled.brief.translated_text,
      extracted: compiled.brief as unknown as Record<string, unknown>,
      embedding: embeddingLiteral,
      district: input.district ?? compiled.brief.district,
      village: input.village ?? compiled.brief.village,
      processed_at: new Date().toISOString(),
    })
    .eq("id", report.id);

  // --- 4. look for duplicates --------------------------------------------
  const { data: rawCandidates } = await supabase.rpc("dedup_candidates", {
    p_region: input.region_id,
    p_embedding: embeddingLiteral,
    p_lng: input.lng ?? null,
    p_lat: input.lat ?? null,
    p_max_km: 5,
    p_max_days: DEDUP_THRESHOLDS.maxAgeDays,
    p_limit: 10,
  });

  const candidates = await withDistricts(
    supabase,
    (rawCandidates ?? []) as DedupCandidate[],
    input.district ?? compiled.brief.district ?? null,
    compiled.brief.category ?? null,
  );
  const dedup = decideDedup(candidates, DEDUP_THRESHOLDS, {
    lexicalEmbedding: compiled.embeddingSource === "local",
  });

  let challengeId: string;
  let challengeRef: string | null = null;

  if (dedup.decision === "merge" && dedup.match) {
    // --- join the existing cluster ---------------------------------------
    challengeId = dedup.match.challenge_id;
    challengeRef = dedup.match.ref;

    await supabase
      .from("reports")
      .update({ cluster_id: challengeId, dedup_similarity: dedup.match.similarity })
      .eq("id", report.id);

    // The merged brief should reflect every report, not only the newest one,
    // so a cluster that has grown meaningfully is recompiled.
    await maybeRecompileCluster(supabase, challengeId, input.region_id);

    await appendLedger(supabase, {
      entity: "challenge",
      entityId: challengeId,
      action: "report_merged",
      actor: input.reporter_id ?? null,
      regionId: input.region_id,
      payload: {
        report_id: report.id,
        similarity: dedup.match.similarity,
        distance_km: dedup.match.distance_km,
        channel: input.channel,
        reason: dedup.reason,
      },
    });
  } else {
    // --- open a new challenge --------------------------------------------
    const crisis = await activeCrisisFor(supabase, input.region_id, input.district ?? compiled.brief.district);

    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .insert({
        region_id: input.region_id,
        title: compiled.brief.title,
        brief: compiled.brief as unknown as Record<string, unknown>,
        category: compiled.brief.category,
        dm_phase: compiled.brief.dm_phase,
        district: compiled.brief.district,
        block: null,
        geom,
        people_est: compiled.brief.people_est,
        severity: compiled.brief.severity,
        severity_source: compiled.brief.source === "ai" ? "ai" : "rules",
        // REFINED, not REPORTED: the Compiler has drafted a brief, and the
        // human check comes next. The AI draft always precedes the approval.
        status: "REFINED",
        confidence: "unverified",
        mode: crisis ? "crisis" : "peace",
        crisis_id: crisis?.id ?? null,
        capabilities: compiled.brief.capabilities,
        hazard_tags: compiled.brief.hazard_tags,
        sdg_tags: compiled.brief.sdg_tags,
        sendai_tags: compiled.brief.sendai_tags,
        ai_uncertainties: compiled.brief.uncertainties,
        embedding: embeddingLiteral,
        is_simulated: input.is_simulated ?? false,
        refined_at: new Date().toISOString(),
      })
      .select("id, ref")
      .single();
    if (challengeError) throw challengeError;

    challengeId = challenge.id;
    challengeRef = challenge.ref;

    await supabase.from("reports").update({ cluster_id: challengeId }).eq("id", report.id);

    await appendLedger(supabase, {
      entity: "challenge",
      entityId: challengeId,
      action: "compiled",
      actor: input.reporter_id ?? null,
      regionId: input.region_id,
      payload: {
        report_id: report.id,
        source: compiled.brief.source,
        decision: dedup.decision,
        reason: dedup.reason,
        // A "review" decision is a coordinator's call, so record what we saw.
        possible_duplicate_of: dedup.decision === "review" ? dedup.match?.ref : undefined,
        trace: compiled.trace,
      },
    });
  }

  // --- 5. recount, rescore ------------------------------------------------
  await supabase.rpc("recount_cluster", { p_challenge: challengeId });
  const scored = await rescoreChallenge(supabase, challengeId);

  // --- 6. tell the reporter, in their own language -----------------------
  await notifyReporter(supabase, {
    userId: input.reporter_id ?? null,
    phoneHash: input.phone_hash ?? null,
    lang: input.lang,
    template: dedup.decision === "merge" ? "report_merged" : "report_received",
    payload: { challenge_id: challengeId, challenge_ref: challengeRef },
  });

  return {
    reportId: report.id,
    challengeId,
    challengeRef,
    decision: dedup.decision,
    dedupReason: dedup.reason,
    candidates: dedup.candidates,
    trace: compiled.trace,
    priority: scored.priority,
    confidence: scored.confidence,
    degraded: compiled.degraded,
    transcriptionFailure: compiled.transcriptionFailure,
    duplicateSubmission: false,
  };
}

/**
 * Recompiles a cluster's brief once it has grown enough for the old wording to
 * be misleading. Doing it on every single report would be slow and would burn
 * tokens for no gain, so it runs at 3, 5, 10, 20, 30 reports and so on.
 */
async function maybeRecompileCluster(
  supabase: SupabaseClient,
  challengeId: string,
  regionId: string,
): Promise<void> {
  const { count } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("cluster_id", challengeId);

  const n = count ?? 0;
  const milestones = [3, 5, 10, 20, 30, 50];
  if (!milestones.includes(n)) return;

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, status, district, brief")
    .eq("id", challengeId)
    .single();

  // Once a coordinator has approved the brief, the wording is theirs. Do not
  // quietly rewrite an approved challenge underneath them.
  if (!challenge || challenge.status !== "REFINED") return;

  const { data: reports } = await supabase
    .from("reports")
    .select("translated_text, original_text")
    .eq("cluster_id", challengeId)
    .limit(30);

  const texts = (reports ?? [])
    .map((r) => r.translated_text || r.original_text)
    .filter((t): t is string => Boolean(t));
  if (texts.length < 2) return;

  const recompiled = await compile({
    text: texts[0],
    siblingTexts: texts.slice(1),
    district: challenge.district,
  });

  await supabase
    .from("challenges")
    .update({
      title: recompiled.brief.title,
      brief: recompiled.brief as unknown as Record<string, unknown>,
      capabilities: recompiled.brief.capabilities,
      ai_uncertainties: recompiled.brief.uncertainties,
      people_est: recompiled.brief.people_est,
      embedding: toPgVector(recompiled.embedding),
    })
    .eq("id", challengeId);

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: challengeId,
    action: "brief_recompiled",
    regionId,
    payload: { report_count: n, source: recompiled.brief.source },
  });
}

/**
 * Marks each merge candidate as in the same district or not.
 *
 * Only consulted when a side has no GPS - the usual case on the web form, which
 * sends a district rather than a point. Without it, two reports of "no drinking
 * water" from opposite ends of the state would merge on wording alone.
 */
async function withDistricts(
  supabase: SupabaseClient,
  candidates: DedupCandidate[],
  district: string | null,
  category: string | null = null,
): Promise<DedupCandidate[]> {
  if (!candidates.length) return candidates;
  const { data } = await supabase
    .from("challenges")
    .select("id, district, category")
    .in("id", candidates.map((c) => c.challenge_id));
  const clean = (v: unknown) => ((v as string | null) ?? "").trim().toLowerCase() || null;
  const theirs = new Map((data ?? []).map((r) => [r.id as string, { district: clean(r.district), category: clean(r.category) }]));
  const mine = clean(district);
  const myCategory = clean(category);
  return candidates.map((c) => {
    const other = theirs.get(c.challenge_id);
    return {
      ...c,
      same_district: mine && other?.district ? mine === other.district : null,
      same_category: myCategory && other?.category ? myCategory === other.category : null,
    };
  });
}

/** Is a crisis running for this district right now? */
export async function activeCrisisFor(
  supabase: SupabaseClient,
  regionId: string,
  district: string | null | undefined,
): Promise<{ id: string; is_drill: boolean } | null> {
  if (!district) return null;
  const { data } = await supabase
    .from("crisis_events")
    .select("id, districts, is_drill")
    .eq("region_id", regionId)
    .is("ended_at", null);

  const match = (data ?? []).find((c) =>
    (c.districts as string[]).some((d) => d.toLowerCase() === district.toLowerCase()),
  );
  return match ? { id: match.id, is_drill: match.is_drill } : null;
}

/** EWKT, which is what a geography column accepts on insert. */
export function pointOrNull(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `SRID=4326;POINT(${lng} ${lat})`;
}
