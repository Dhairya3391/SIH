import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { corroborate, hazardKey, isProof, type Citation } from "@/lib/ai/corroborate";
import { AWAITING_VERIFICATION, UNVERIFIED_CONFIDENCE } from "@/lib/domain/types";
import { JHARKHAND_DISTRICTS, RAJKOT_AREAS } from "@/lib/seed/data";
import { extractPoint, rescoreChallenge } from "./scoring";
import { appendLedger } from "./ledger";
import { notifyReporters } from "./notify";

/**
 * The AI verification step between a citizen's report and the verifier's desk.
 *
 *   1. Decide whether this is a disaster-type event that outside records could
 *      confirm at all. A missing teacher is not in the weather archive.
 *   2. If it is: fetch the weather for that place and time, search the news and
 *      the open web, and reach a verdict with citations.
 *   3. Proof found -> verified on the spot, the sources recorded against it,
 *      and the problem opens to colleges.
 *      No proof     -> it stays unverified and waits for a human verifier, with
 *      everything that was found shown beside the citizen's words.
 *
 * Every provider call is kept in external_checks and every decision in the
 * ledger, so "the AI verified this" is always inspectable.
 */

const CENTROIDS = new Map(
  [...JHARKHAND_DISTRICTS, ...RAJKOT_AREAS].map((d) => [d.name.toLowerCase(), { lat: d.lat, lng: d.lng }]),
);

const DISASTER_WORDS = [
  "flood", "lightning", "thunder", "storm", "cyclone", "heatwave", "heat wave", "drought",
  "fire", "landslide", "subsidence", "earthquake", "cloudburst", "hailstorm", "cold wave",
  "बाढ़", "वज्रपात", "ठनका", "आंधी", "तूफान", "सूखा", "आग", "भूस्खलन", "लू",
];

export interface DisasterCheck {
  disaster: boolean;
  hazard: string | null;
  reason: string;
}

export function classifyDisaster(c: {
  category?: string | null;
  hazard_tags?: string[] | null;
  title?: string | null;
  brief?: Record<string, unknown> | null;
}): DisasterCheck {
  const tags = (c.hazard_tags ?? []).filter(Boolean);
  if (tags.length) {
    return { disaster: true, hazard: tags[0], reason: `The compiler tagged it as ${tags.join(", ")}.` };
  }
  const text = [c.title, c.brief?.problem, c.brief?.translated_text]
    .filter((x): x is string => typeof x === "string")
    .join(" ")
    .toLowerCase();
  const word = DISASTER_WORDS.find((w) => text.includes(w.toLowerCase()));
  if (word) {
    const key = hazardKey(word);
    return { disaster: true, hazard: key === "other" ? word : key, reason: `The report describes ${word}.` };
  }
  if (c.category === "disaster_safety") {
    return { disaster: true, hazard: null, reason: "The compiler filed it under disaster and safety." };
  }
  return {
    disaster: false,
    hazard: null,
    reason: `Filed under ${String(c.category ?? "an everyday category").replace(/_/g, " ")}, which weather, news and web records cannot confirm, so it goes straight to a verifier.`,
  };
}

export interface CorroborationOutcome {
  challenge_id: string;
  ref: string | null;
  ran: boolean;
  disaster: DisasterCheck;
  verdict: string | null;
  confidence: number | null;
  reasoning: string | null;
  citations: Citation[];
  providers: Array<{ provider: string; passages: number; error: string | null; ms: number }>;
  method: string | null;
  model: string | null;
  all_providers_failed: boolean;
  /** Verified on the strength of this check. */
  auto_verified: boolean;
  /** Still unverified before this ran, so a verdict could have verified it. */
  eligible: boolean;
  status: string;
  confidence_level: string;
}

export async function runCorroboration(
  supabase: SupabaseClient,
  challengeId: string,
  opts: { trigger: "intake" | "merge" | "manual"; actorId?: string | null; force?: boolean },
): Promise<CorroborationOutcome> {
  const { data: challenge, error } = await supabase
    .from("challenges")
    .select("id, ref, region_id, title, district, block, category, hazard_tags, brief, geom, confidence, status, created_at")
    .eq("id", challengeId)
    .single();
  if (error) throw error;

  const disaster = classifyDisaster({
    category: challenge.category as string,
    hazard_tags: challenge.hazard_tags as string[],
    title: challenge.title as string,
    brief: challenge.brief as Record<string, unknown>,
  });
  const eligible =
    AWAITING_VERIFICATION.includes(challenge.status) && UNVERIFIED_CONFIDENCE.includes(challenge.confidence);

  const base: CorroborationOutcome = {
    challenge_id: challenge.id as string,
    ref: (challenge.ref as string) ?? null,
    ran: false,
    disaster,
    verdict: null,
    confidence: null,
    reasoning: null,
    citations: [],
    providers: [],
    method: null,
    model: null,
    all_providers_failed: false,
    auto_verified: false,
    eligible,
    status: challenge.status as string,
    confidence_level: challenge.confidence as string,
  };

  // Not something outside records can confirm: straight to a person.
  if (!disaster.disaster && !opts.force) {
    if (opts.trigger === "intake") {
      await appendLedger(supabase, {
        entity: "challenge",
        entityId: challenge.id as string,
        action: "sent_to_verifier",
        regionId: challenge.region_id as string,
        payload: { reason: disaster.reason },
      });
    }
    return { ...base, reasoning: disaster.reason };
  }

  // Where: the report's own GPS, or else the district centre, labelled as such.
  let point = extractPoint(challenge.geom);
  let isDistrictEstimate = false;
  if (!point && challenge.district) {
    const centre = CENTROIDS.get(String(challenge.district).toLowerCase());
    if (centre) {
      point = centre;
      isDistrictEstimate = true;
    }
  }

  // When: the first report in the cluster, which is closest to the event.
  const { data: first } = await supabase
    .from("reports")
    .select("created_at")
    .eq("cluster_id", challenge.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const when = new Date((first?.created_at as string) ?? (challenge.created_at as string));

  const brief = (challenge.brief ?? {}) as { problem?: string; translated_text?: string };
  const reportText = [brief.translated_text, brief.problem, challenge.title]
    .filter((x): x is string => Boolean(x))
    .join("\n")
    .slice(0, 2000);

  const { count: priorChecks } = await supabase
    .from("external_checks")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challenge.id);

  const result = await corroborate({
    reportText,
    district: (challenge.district as string) ?? "",
    hazard: disaster.hazard,
    when,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    placeLabel: [challenge.block, challenge.district].filter(Boolean).join(", ") || "the reported place",
    isDistrictEstimate,
  });

  // One row per provider, raw response kept so the check is auditable.
  const rows = result.providers.map((p) => {
    const cited = result.citations.filter((c) => c.provider === p.provider);
    return {
      challenge_id: challenge.id,
      provider: p.provider,
      query_sent: p.query.slice(0, 2000),
      raw_response: p.raw ?? null,
      verdict: cited.length ? result.verdict : p.passages.length === 0 ? "inconclusive" : result.verdict === "contradicts" && p.provider === "weather" ? "contradicts" : "inconclusive",
      confidence: cited.length ? result.confidence : 0,
      citations: cited,
      reasoning: result.reasoning,
      model: result.model,
      provider_error: p.error,
      ms: p.ms,
    };
  });
  if (rows.length) {
    const { error: checkError } = await supabase.from("external_checks").insert(rows);
    if (checkError) console.error("[corroboration] could not record checks", checkError.message);
  }

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: challenge.id as string,
    action: "external_check",
    actor: opts.actorId ?? null,
    regionId: challenge.region_id as string,
    payload: {
      trigger: opts.trigger,
      hazard: disaster.hazard,
      verdict: result.verdict,
      confidence: result.confidence,
      method: result.method,
      model: result.model,
      citations: result.citations.length,
      providers: result.providers.map((p) => ({ provider: p.provider, passages: p.passages.length, error: p.error })),
    },
  });

  if (!priorChecks) {
    await supabase.rpc("record_timing", {
      p_challenge: challenge.id,
      p_stage: "to_corroboration",
      p_started: challenge.created_at,
      p_ended: new Date().toISOString(),
    });
  }

  let autoVerified = false;
  if (eligible && isProof(result)) {
    const now = new Date().toISOString();
    // Guarded on the status it was in, so a verifier acting at the same moment wins.
    const { data: moved } = await supabase
      .from("challenges")
      .update({ status: "VERIFIED", verified_at: now, confidence: "externally_corroborated" })
      .eq("id", challenge.id)
      .in("status", AWAITING_VERIFICATION)
      .select("id");

    if (moved && moved.length > 0) {
      autoVerified = true;
      const sources = [...new Set(result.citations.map((c) => c.url))];

      await supabase.from("verifications").insert({
        challenge_id: challenge.id,
        by_user: null,
        kind: "still_exists",
        method: "ai_external",
        source_urls: sources,
        evidence_url: sources[0] ?? null,
        note: `Verified automatically from ${sources.length} independent source${sources.length === 1 ? "" : "s"} (${result.method === "ai" ? `model ${result.model}` : "published rules"}, confidence ${Math.round(result.confidence * 100)}%). ${result.reasoning}`.slice(0, 2000),
      });

      await appendLedger(supabase, {
        entity: "challenge",
        entityId: challenge.id as string,
        action: "ai_verified",
        regionId: challenge.region_id as string,
        payload: {
          confidence: result.confidence,
          method: result.method,
          model: result.model,
          reasoning: result.reasoning,
          sources: result.citations.map((c) => ({
            provider: c.provider,
            url: c.url,
            title: c.title,
            publisher: c.publisher,
            published_at: c.published_at,
          })),
        },
      });

      await rescoreChallenge(supabase, challenge.id as string);
      await supabase.rpc("record_timing", {
        p_challenge: challenge.id,
        p_stage: "to_verification",
        p_started: challenge.created_at,
        p_ended: now,
      });
      await notifyReporters(supabase, challenge.id as string, "verified", {
        ref: challenge.ref,
        method: "independent sources",
      });
    }
  }

  const { data: after } = await supabase
    .from("challenges")
    .select("status, confidence")
    .eq("id", challenge.id)
    .single();

  return {
    ...base,
    ran: true,
    verdict: result.verdict,
    confidence: result.confidence,
    reasoning: result.reasoning,
    citations: result.citations,
    providers: result.providers.map((p) => ({
      provider: p.provider,
      passages: p.passages.length,
      error: p.error,
      ms: p.ms,
    })),
    method: result.method,
    model: result.model,
    all_providers_failed: result.allProvidersFailed,
    auto_verified: autoVerified,
    status: (after?.status as string) ?? base.status,
    confidence_level: (after?.confidence as string) ?? base.confidence_level,
  };
}

/**
 * Whether a report that just arrived should trigger a check. A brand-new
 * challenge always gets one if it is disaster-type; a report merging into one
 * that is still unverified re-runs it at most every six hours, because new
 * reports can carry the detail the first search lacked.
 */
export async function shouldCorroborateAfterIntake(
  supabase: SupabaseClient,
  challengeId: string,
  decision: "merge" | "review" | "new",
): Promise<{ run: boolean; disaster: DisasterCheck; reason: string }> {
  const { data: c } = await supabase
    .from("challenges")
    .select("category, hazard_tags, title, brief, status, confidence")
    .eq("id", challengeId)
    .maybeSingle();
  if (!c) return { run: false, disaster: { disaster: false, hazard: null, reason: "" }, reason: "challenge not found" };

  const disaster = classifyDisaster({
    category: c.category as string,
    hazard_tags: c.hazard_tags as string[],
    title: c.title as string,
    brief: c.brief as Record<string, unknown>,
  });

  const awaiting =
    AWAITING_VERIFICATION.includes(c.status) && UNVERIFIED_CONFIDENCE.includes(c.confidence);
  if (!awaiting) return { run: false, disaster, reason: "already verified" };
  if (decision !== "merge") return { run: true, disaster, reason: disaster.reason };

  if (!disaster.disaster) return { run: false, disaster, reason: disaster.reason };
  const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const { count } = await supabase
    .from("external_checks")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId)
    .gte("checked_at", since);
  return count
    ? { run: false, disaster, reason: "checked within the last six hours" }
    : { run: true, disaster, reason: "a new report joined an unverified problem" };
}
