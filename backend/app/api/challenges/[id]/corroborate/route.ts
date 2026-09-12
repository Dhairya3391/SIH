import { ok, fail, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { corroborate } from "@/lib/ai/corroborate";
import { extractPoint } from "@/lib/services/scoring";

/**
 * POST /api/challenges/[id]/corroborate - go and look for independent proof.
 *
 * Runs weather, news and web, writes one external_checks row per provider,
 * and raises confidence to `externally_corroborated` on a supporting verdict.
 *
 * It stops there, deliberately. Corroboration never reaches a human rung and
 * never makes a challenge visible to colleges: a model that cites a page which
 * does not confirm the event would otherwise launder a false verification into
 * an official record, and resources would move on it. A verifier still decides.
 *
 * A contradicting verdict is recorded as a flag for the verifier, not applied.
 * A villager can be right while the internet is silent - that is the whole
 * premise of Silent Zones.
 */
export const POST = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole("verifier", "volunteer", "coordinator", "admin");
  const { id } = await ctx.params;
  const supabase = supabaseAdmin();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, district, block, hazard_tags, brief, geom, confidence, created_at, region_id")
    .eq(isUuid ? "id" : "ref", isUuid ? id : id.toUpperCase())
    .maybeSingle();
  if (!challenge) return fail(404, "No such challenge.", "not_found");

  const brief = (challenge.brief ?? {}) as { problem?: string };
  const hazards = (challenge.hazard_tags ?? []) as string[];

  // A report with no GPS still gets checked, against the district centroid,
  // and the weather passage says so rather than implying point precision.
  let point = extractPoint(challenge.geom);
  let isDistrictEstimate = false;
  if (!point) {
    const { data: cells } = await supabase
      .from("hazard_cells")
      .select("intensity")
      .eq("region_id", challenge.region_id as string)
      .eq("district", challenge.district as string)
      .limit(1);
    if ((cells ?? []).length > 0) {
      // Jharkhand centroid as a last resort; the label makes the imprecision explicit.
      point = { lat: 23.6102, lng: 85.2799 };
      isDistrictEstimate = true;
    }
  }

  const result = await corroborate({
    reportText: brief.problem ?? "",
    district: (challenge.district as string) ?? "",
    hazard: hazards[0] ?? null,
    when: new Date(challenge.created_at as string),
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    placeLabel: `${challenge.block ?? challenge.district}`,
    isDistrictEstimate,
  });

  // One row per provider, raw response kept so the check is auditable.
  for (const p of result.providers) {
    await supabase.from("external_checks").insert({
      challenge_id: challenge.id,
      provider: p.provider,
      query_sent: p.query.slice(0, 2000),
      raw_response: p.raw ?? null,
      verdict:
        p.passages.length === 0
          ? "inconclusive"
          : result.citations.some((c) => c.provider === p.provider)
            ? result.verdict
            : "inconclusive",
      confidence: result.citations.some((c) => c.provider === p.provider) ? result.confidence : 0,
      citations: result.citations.filter((c) => c.provider === p.provider),
      reasoning: result.reasoning,
      model: result.model,
      provider_error: p.error,
      ms: p.ms,
    });
  }

  // Only "supports", with at least one real citation, moves confidence - and
  // only from unverified. It can never overwrite a human's judgement.
  let raised = false;
  if (
    result.verdict === "supports" &&
    result.citations.length > 0 &&
    challenge.confidence === "unverified"
  ) {
    await supabase
      .from("challenges")
      .update({ confidence: "externally_corroborated" })
      .eq("id", challenge.id);
    raised = true;
  }

  return ok({
    challenge_id: challenge.id,
    ref: challenge.ref,
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
    all_providers_failed: result.allProvidersFailed,
    confidence_raised: raised,
    still_needs_a_human: true,
  });
});
