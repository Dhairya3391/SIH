import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computePriority,
  explainPriority,
  DEFAULT_PRIORITY_WEIGHTS,
  type PriorityWeights,
} from "@/lib/domain/priority";
import { computeConfidence } from "@/lib/domain/confidence";
import type { VulnerabilityTag } from "@/lib/domain/types";

/**
 * Recomputes a challenge's priority and confidence from whatever the database
 * currently says, and writes both back with the full breakdown.
 *
 * It runs after anything that could move either number: a new report joins the
 * cluster, a volunteer verifies it, a pledge closes part of the gap, Crisis
 * Mode switches on. Both scores are therefore always live, and the breakdown
 * shown to a coordinator is always the one that produced the number on screen.
 */

/** Admin-editable weights, with the code defaults as the safety net. */
export async function loadPriorityWeights(
  supabase: SupabaseClient,
): Promise<{ weights: PriorityWeights; version: string }> {
  const { data } = await supabase
    .from("scoring_weights")
    .select("weights, updated_at")
    .eq("id", "priority")
    .maybeSingle();

  if (!data?.weights) return { weights: DEFAULT_PRIORITY_WEIGHTS, version: "code-default" };
  return {
    weights: { ...DEFAULT_PRIORITY_WEIGHTS, ...(data.weights as Partial<PriorityWeights>) },
    version: `db:${data.updated_at}`,
  };
}

export interface RescoreResult {
  priority: number;
  confidence: string;
  whyCritical: string;
  breakdown: unknown;
}

export async function rescoreChallenge(
  supabase: SupabaseClient,
  challengeId: string,
): Promise<RescoreResult> {
  const { data: challenge, error } = await supabase
    .from("challenges")
    .select(
      "id, region_id, district, severity, people_est, status, mode, crisis_id, brief, reporter_count, geom, created_at",
    )
    .eq("id", challengeId)
    .single();
  if (error) throw error;

  const brief = (challenge.brief ?? {}) as Record<string, unknown>;
  const vulnerable = (Array.isArray(brief.vulnerable) ? brief.vulnerable : []) as VulnerabilityTag[];
  const urgency = typeof brief.urgency === "number" ? brief.urgency : 3;

  // --- inputs that need their own queries ---------------------------------
  const [hazard, gap, verifications, recurrence, assignments] = await Promise.all([
    hazardExposure(supabase, challengeId),
    gapFraction(supabase, challengeId),
    loadVerifications(supabase, challengeId),
    recurrenceCount(supabase, challenge.region_id, challenge.district, brief.category as string),
    activeAssignments(supabase, challengeId),
  ]);

  const { weights, version } = await loadPriorityWeights(supabase);

  const breakdown = computePriority(
    {
      severity: challenge.severity ?? 3,
      urgency,
      peopleAffected: challenge.people_est ?? 0,
      vulnerable,
      hazardExposure: hazard,
      resourceGap: gap,
      recurrenceCount: recurrence,
      uniqueReporters: challenge.reporter_count ?? 1,
      crisisMode: challenge.mode === "crisis",
      hoursToDeadline: typeof brief.hours_to_deadline === "number" ? brief.hours_to_deadline : null,
    },
    weights,
    version,
  );

  const confidence = computeConfidence({
    uniqueReporters: challenge.reporter_count ?? 1,
    hasFieldVerification: verifications.field > 0,
    coordinatorApproved: [
      "VERIFIED", "OPEN", "TEAM_FORMED", "SOLUTION_PROPOSED",
      "PILOT", "DEPLOYED", "IMPACT_VERIFIED", "NEEDS_FOLLOW_UP",
    ].includes(challenge.status),
    resolvedWithEvidence: challenge.status === "IMPACT_VERIFIED",
    openInaccurateFlags: verifications.inaccurate,
    fromUnknownSmsOnly: verifications.smsOnly,
  });

  const whyCritical = explainPriority(breakdown, {
    district: challenge.district,
    peopleAffected: challenge.people_est ?? 0,
    hasPartner: assignments > 0,
  });

  const { error: updateError } = await supabase
    .from("challenges")
    .update({
      priority: breakdown.total,
      score_breakdown: breakdown as unknown as Record<string, unknown>,
      confidence: confidence.level,
      why_critical: whyCritical,
    })
    .eq("id", challengeId);
  if (updateError) throw updateError;

  return {
    priority: breakdown.total,
    confidence: confidence.level,
    whyCritical,
    breakdown,
  };
}

async function hazardExposure(supabase: SupabaseClient, challengeId: string): Promise<number> {
  const { data } = await supabase
    .from("challenges")
    .select("region_id, geom")
    .eq("id", challengeId)
    .single();
  if (!data) return 0;

  // geom comes back as GeoJSON through PostgREST; pull the point out of it.
  const point = extractPoint(data.geom);
  if (!point) return 0;

  const { data: exposure } = await supabase.rpc("hazard_exposure", {
    p_region: data.region_id,
    p_lng: point.lng,
    p_lat: point.lat,
  });
  return typeof exposure === "number" ? exposure : 0;
}

async function gapFraction(supabase: SupabaseClient, challengeId: string): Promise<number> {
  const { data } = await supabase.rpc("challenge_gap_fraction", { p_challenge: challengeId });
  return typeof data === "number" ? data : 1;
}

async function loadVerifications(supabase: SupabaseClient, challengeId: string) {
  const { data } = await supabase
    .from("verifications")
    .select("kind")
    .eq("challenge_id", challengeId);

  const rows = data ?? [];
  return {
    field: rows.filter((r) => r.kind === "field").length,
    inaccurate: rows.filter((r) => r.kind === "inaccurate").length,
    smsOnly: await isSmsOnly(supabase, challengeId),
  };
}

/** True when every report in the cluster arrived as SMS from an unknown number. */
async function isSmsOnly(supabase: SupabaseClient, challengeId: string): Promise<boolean> {
  const { data } = await supabase
    .from("reports")
    .select("channel, reporter_id")
    .eq("cluster_id", challengeId);
  const rows = data ?? [];
  if (!rows.length) return false;
  return rows.every((r) => r.channel === "sms" && !r.reporter_id);
}

/** How often this kind of problem has already been reported in this district. */
async function recurrenceCount(
  supabase: SupabaseClient,
  regionId: string,
  district: string | null,
  category: string | undefined,
): Promise<number> {
  if (!district || !category) return 0;
  const { count } = await supabase
    .from("challenges")
    .select("id", { count: "exact", head: true })
    .eq("region_id", regionId)
    .eq("district", district)
    .eq("category", category)
    .in("status", ["DEPLOYED", "IMPACT_VERIFIED", "NEEDS_FOLLOW_UP"]);
  return count ?? 0;
}

async function activeAssignments(supabase: SupabaseClient, challengeId: string): Promise<number> {
  const { count } = await supabase
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId)
    .is("released_at", null);
  return count ?? 0;
}

/** PostGIS geography arrives as GeoJSON or as WKB hex, depending on the query. */
export function extractPoint(geom: unknown): { lat: number; lng: number } | null {
  if (!geom) return null;
  if (typeof geom === "object" && geom !== null && "coordinates" in geom) {
    const coords = (geom as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: Number(coords[0]), lat: Number(coords[1]) };
    }
  }
  if (typeof geom === "string") {
    try {
      const parsed = JSON.parse(geom) as { coordinates?: number[] };
      if (parsed.coordinates?.length) {
        return { lng: parsed.coordinates[0], lat: parsed.coordinates[1] };
      }
    } catch {
      // Not GeoJSON. WKB hex is only produced by queries we do not use here.
    }
  }
  return null;
}
