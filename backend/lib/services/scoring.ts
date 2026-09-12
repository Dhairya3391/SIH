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
      hazardExposure: hazard.value,
      resourceGap: gap,
      hazardIsDistrictEstimate: hazard.isDistrictEstimate,
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

/**
 * Hazard exposure for a challenge, and whether it had to be estimated.
 *
 * A report filed without GPS - the common case on the web form - leaves geom
 * null, so there is no point to test against the hazard layer. Rather than
 * score a genuinely dangerous place at zero, fall back to the highest
 * intensity among the mapped cells covering its district. The caller passes
 * the flag through so the breakdown says which it was.
 */
async function hazardExposure(
  supabase: SupabaseClient,
  challengeId: string,
): Promise<{ value: number; isDistrictEstimate: boolean }> {
  const { data } = await supabase
    .from("challenges")
    .select("region_id, district, geom")
    .eq("id", challengeId)
    .single();
  if (!data) return { value: 0, isDistrictEstimate: false };

  const point = extractPoint(data.geom);

  if (point) {
    const { data: exposure } = await supabase.rpc("hazard_exposure", {
      p_region: data.region_id,
      p_lng: point.lng,
      p_lat: point.lat,
    });
    if (typeof exposure === "number" && exposure > 0) {
      return { value: exposure, isDistrictEstimate: false };
    }
  }

  if (!data.district) return { value: 0, isDistrictEstimate: false };

  const { data: cells } = await supabase
    .from("hazard_cells")
    .select("intensity")
    .eq("region_id", data.region_id)
    .eq("district", data.district);

  const peak = (cells ?? []).reduce(
    (max, c) => Math.max(max, Number((c as { intensity: number }).intensity ?? 0)),
    0,
  );
  return { value: peak, isDistrictEstimate: peak > 0 };
}


/**
 * Share of the stated need that is still unpledged, 1 when nothing is covered.
 *
 * This reads challenge_gap() and sums in code rather than calling
 * challenge_gap_fraction(). That SQL function returns 0 - not 1 - for a
 * challenge with no needs listed, because Postgres `least()` ignores NULLs:
 * with no rows, `least(NULL, 1)` is 1 and `1 - 1` is 0, so its `coalesce(.., 1)`
 * never fires. The effect was that every brand-new challenge scored zero on
 * resource gap, which is the exact opposite of the intent. The SQL is fixed in
 * migration 0009; this does not depend on that migration having been applied.
 */
async function gapFraction(supabase: SupabaseClient, challengeId: string): Promise<number> {
  const { data, error } = await supabase.rpc("challenge_gap", { p_challenge: challengeId });
  if (error) {
    console.warn("[scoring] challenge_gap failed, assuming nothing is pledged:", error.message);
    return 1;
  }

  const rows = (data ?? []) as Array<{ qty_needed: number | null; qty_pledged: number | null }>;
  const needed = rows.reduce((sum, r) => sum + Number(r.qty_needed ?? 0), 0);
  // Nothing listed yet means nothing is covered yet.
  if (needed <= 0) return 1;

  const pledged = rows.reduce((sum, r) => sum + Number(r.qty_pledged ?? 0), 0);
  return Math.min(Math.max(1 - pledged / needed, 0), 1);
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
/**
 * PostgREST hands a `geometry` column back as EWKB hex, not GeoJSON - that is
 * what `select geom` returns, which is the query hazardExposure() runs. The
 * previous version only understood GeoJSON, so every lookup silently returned
 * null and every challenge scored zero on hazard exposure. Both shapes are
 * handled now, and an unrecognised one is logged instead of swallowed.
 */
export function extractPoint(geom: unknown): { lat: number; lng: number } | null {
  if (!geom) return null;

  // GeoJSON object, e.g. from ST_AsGeoJSON or a PostgREST GeoJSON response.
  if (typeof geom === "object" && geom !== null && "coordinates" in geom) {
    const coords = (geom as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: Number(coords[0]), lat: Number(coords[1]) };
    }
  }

  if (typeof geom === "string") {
    const text = geom.trim();

    // GeoJSON that arrived as a string.
    if (text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text) as { coordinates?: number[] };
        if (parsed.coordinates?.length) {
          return { lng: parsed.coordinates[0], lat: parsed.coordinates[1] };
        }
      } catch {
        // fall through to the hex reader
      }
    }

    const point = readEwkbPoint(text);
    if (point) return point;
  }

  console.warn("[scoring] could not read a point out of geom:", typeof geom);
  return null;
}

/**
 * Reads a POINT out of PostGIS EWKB hex, e.g.
 *   0101000020E6100000 5839B4C876225540 41F163CC5D0B3740
 *   ^^ byte order      ^^ x (lng)         ^^ y (lat)
 * Byte 0 is the endianness, the next 4 the geometry type (with PostGIS's SRID
 * flag 0x20000000), then the 4-byte SRID when that flag is set, then two
 * little- or big-endian float64s. Anything that is not a point is refused
 * rather than guessed at.
 */
function readEwkbPoint(hex: string): { lat: number; lng: number } | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 42) return null;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const typeWord = view.getUint32(1, littleEndian);
  const hasSrid = (typeWord & 0x20000000) !== 0;
  // Low 16 bits carry the geometry type; 1 is POINT.
  if ((typeWord & 0xffff) !== 1) return null;

  let offset = 5 + (hasSrid ? 4 : 0);
  if (offset + 16 > bytes.length) return null;

  const lng = view.getFloat64(offset, littleEndian);
  offset += 8;
  const lat = view.getFloat64(offset, littleEndian);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

