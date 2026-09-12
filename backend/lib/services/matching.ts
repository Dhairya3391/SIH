import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  scoreMatch,
  matchReasons,
  buildTeamPlan,
  DEFAULT_MATCH_WEIGHTS,
  type MatchCandidate,
  type MatchWeights,
} from "@/lib/domain/matching";
import { appendLedger } from "./ledger";

/**
 * Resource-first matching.
 *
 * The order matters and it is the argument we make on stage: before anybody
 * proposes building something new, list what is already inside the radius. A
 * siren sitting in a supplier's stock in Ranchi beats a siren someone has to
 * design. Only then do we rank who could build or fund the rest.
 */

export interface NearbyResource {
  resource_id: string;
  org_id: string;
  org_name: string;
  org_type: string;
  type: string;
  label: string | null;
  quantity: number;
  unit: string;
  availability: string;
  distance_km: number;
}

export async function nearbyResources(
  supabase: SupabaseClient,
  challengeId: string,
  radiusKm = 30,
): Promise<NearbyResource[]> {
  const { data, error } = await supabase.rpc("nearby_resources", {
    p_challenge: challengeId,
    p_radius_km: radiusKm,
  });
  if (error) throw error;
  return (data ?? []) as NearbyResource[];
}

export interface ScoredMatch {
  org_id: string;
  name: string;
  type: string;
  district: string | null;
  distance_km: number | null;
  score: number;
  reasons: string[];
  breakdown: unknown;
  verified: boolean;
}

async function loadWeights(
  supabase: SupabaseClient,
): Promise<{ weights: MatchWeights; version: string }> {
  const { data } = await supabase
    .from("scoring_weights")
    .select("weights, updated_at")
    .eq("id", "match")
    .maybeSingle();
  if (!data?.weights) return { weights: DEFAULT_MATCH_WEIGHTS, version: "code-default" };
  return {
    weights: { ...DEFAULT_MATCH_WEIGHTS, ...(data.weights as Partial<MatchWeights>) },
    version: `db:${data.updated_at}`,
  };
}

export async function computeMatches(
  supabase: SupabaseClient,
  challengeId: string,
  limit = 10,
): Promise<ScoredMatch[]> {
  const { data: challenge, error } = await supabase
    .from("challenges")
    .select("id, region_id, district, category, capabilities, brief")
    .eq("id", challengeId)
    .single();
  if (error) throw error;

  const { data: rawCandidates } = await supabase.rpc("nearby_organizations", {
    p_challenge: challengeId,
    p_limit: 60,
  });
  const candidates = (rawCandidates ?? []) as Array<{
    org_id: string;
    name: string;
    type: MatchCandidate["type"];
    district: string | null;
    expertise: string[];
    csr_focus: string[];
    verified: boolean;
    distance_km: number | null;
    within_radius: boolean;
    capability_similarity: number | null;
  }>;
  if (!candidates.length) return [];

  const orgIds = candidates.map((c) => c.org_id);
  const [capacities, trackRecords, openNeeds, resourceHoldings] = await Promise.all([
    loadCapacities(supabase, orgIds),
    loadTrackRecords(supabase, orgIds),
    loadOpenNeeds(supabase, challengeId),
    loadResourceHoldings(supabase, orgIds, challenge.region_id),
  ]);

  const needed = (challenge.capabilities ?? []) as string[];
  const { weights, version } = await loadWeights(supabase);

  const scored = candidates.map((c) => {
    const caps = capacities.get(c.org_id) ?? new Map<string, number>();

    // Availability: what share of the capabilities this challenge asked for
    // does this organisation have free capacity in right now?
    const availability = needed.length
      ? needed.filter((n) =>
          [...caps.entries()].some(([cap, capacity]) => capacity > 0 && capabilityMatches(n, cap)),
        ).length / needed.length
      : caps.size > 0
        ? 0.5
        : 0;

    // Resource fit: how much of the still-open gap could they cover from stock?
    const holdings = resourceHoldings.get(c.org_id) ?? [];
    const coverage = openNeeds.length
      ? Math.min(
          1,
          openNeeds.reduce((sum, need) => {
            const held = holdings
              .filter((h) => capabilityMatches(need.item, h.type) || capabilityMatches(need.capability ?? "", h.type))
              .reduce((q, h) => q + h.quantity, 0);
            return sum + Math.min(held / Math.max(need.qty_open, 1), 1);
          }, 0) / openNeeds.length,
        )
      : 0;

    const candidate: MatchCandidate = {
      org_id: c.org_id,
      name: c.name,
      type: c.type,
      district: c.district,
      expertise: c.expertise ?? [],
      csr_focus: c.csr_focus ?? [],
      verified: c.verified,
      distance_km: c.distance_km,
      within_radius: c.within_radius,
      capability_similarity: c.capability_similarity,
      availability,
      resource_coverage: coverage,
      track_record: trackRecords.get(c.org_id) ?? 0,
      response_hours: null,
      operates_here:
        Boolean(challenge.district) &&
        c.district?.toLowerCase() === String(challenge.district).toLowerCase(),
    };

    const breakdown = scoreMatch(
      candidate,
      {
        neededCapabilities: needed,
        challengeDistrict: challenge.district,
        challengeCategory: challenge.category,
      },
      weights,
      version,
    );

    return {
      org_id: c.org_id,
      name: c.name,
      type: c.type,
      district: c.district,
      distance_km: c.distance_km,
      score: breakdown.total,
      reasons: matchReasons(breakdown),
      breakdown,
      verified: c.verified,
    } satisfies ScoredMatch;
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  // Cache the recommendations so the coordinator screen is instant and the
  // reasons a partner saw are the reasons that were actually shown.
  if (top.length) {
    await supabase.from("matches").upsert(
      top.map((m) => ({
        challenge_id: challengeId,
        org_id: m.org_id,
        score: m.score,
        reasons: m.reasons,
        status: "suggested" as const,
      })),
      { onConflict: "challenge_id,org_id" },
    );
  }

  return top;
}

/** Loose match: "water_testing" should meet "water testing" and "Water Testing". */
function capabilityMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  return na.includes(nb) || nb.includes(na);
}

async function loadCapacities(supabase: SupabaseClient, orgIds: string[]) {
  const { data } = await supabase
    .from("org_capabilities")
    .select("org_id, capability, capacity")
    .in("org_id", orgIds);

  const map = new Map<string, Map<string, number>>();
  for (const row of data ?? []) {
    if (!map.has(row.org_id)) map.set(row.org_id, new Map());
    map.get(row.org_id)!.set(row.capability, row.capacity);
  }
  return map;
}

async function loadTrackRecords(supabase: SupabaseClient, orgIds: string[]) {
  const { data } = await supabase
    .from("assignments")
    .select("org_id, challenges!inner(status)")
    .in("org_id", orgIds)
    .in("challenges.status", ["DEPLOYED", "IMPACT_VERIFIED"]);

  const map = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ org_id: string }>) {
    map.set(row.org_id, (map.get(row.org_id) ?? 0) + 1);
  }
  return map;
}

async function loadOpenNeeds(supabase: SupabaseClient, challengeId: string) {
  const { data } = await supabase.rpc("challenge_gap", { p_challenge: challengeId });
  const needs = (data ?? []) as Array<{ item: string; qty_open: number; need_id: string }>;
  const { data: meta } = await supabase
    .from("resource_needs")
    .select("id, capability")
    .eq("challenge_id", challengeId);
  const capabilityById = new Map((meta ?? []).map((m) => [m.id, m.capability as string | null]));

  return needs
    .filter((n) => n.qty_open > 0)
    .map((n) => ({ ...n, capability: capabilityById.get(n.need_id) ?? null }));
}

async function loadResourceHoldings(
  supabase: SupabaseClient,
  orgIds: string[],
  regionId: string,
) {
  const { data } = await supabase
    .from("resources")
    .select("org_id, type, quantity")
    .in("org_id", orgIds)
    .eq("region_id", regionId)
    .eq("availability", "available");

  const map = new Map<string, Array<{ type: string; quantity: number }>>();
  for (const row of data ?? []) {
    map.set(row.org_id, [...(map.get(row.org_id) ?? []), { type: row.type, quantity: row.quantity }]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Skill-gap team builder
// ---------------------------------------------------------------------------

export async function buildTeam(supabase: SupabaseClient, challengeId: string) {
  const { data: challenge, error } = await supabase
    .from("challenges")
    .select("id, capabilities, region_id")
    .eq("id", challengeId)
    .single();
  if (error) throw error;

  const plan = buildTeamPlan((challenge.capabilities ?? []) as string[]);

  const { data: existing } = await supabase
    .from("team_members")
    .select("seat, filled")
    .eq("challenge_id", challengeId);

  const filledBySeat = new Map<string, number>();
  for (const row of existing ?? []) {
    if (row.filled) filledBySeat.set(row.seat, (filledBySeat.get(row.seat) ?? 0) + 1);
  }

  const rows: Array<{ challenge_id: string; seat: string; filled: boolean }> = [];
  for (const seat of plan) {
    const already = filledBySeat.get(seat.seat) ?? 0;
    for (let i = already; i < seat.count; i++) {
      rows.push({ challenge_id: challengeId, seat: seat.seat, filled: false });
    }
  }
  if (rows.length) await supabase.from("team_members").insert(rows);

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: challengeId,
    action: "team_plan_built",
    regionId: challenge.region_id,
    payload: { seats: plan },
  });

  return {
    plan,
    gaps: plan.map((s) => ({
      seat: s.seat,
      needed: s.count,
      filled: filledBySeat.get(s.seat) ?? 0,
      reason: s.reason,
    })),
  };
}
