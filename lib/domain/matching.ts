/**
 * Formula 4 of 5: capability matching.
 *
 *   40 x capability fit   (embedding similarity: the need against the profile)
 * + 20 x availability     (capacity now, semester load, stock)
 * + 15 x proximity        (distance decay, inside the response radius)
 * + 15 x resource fit     (how much of the open gap they can cover)
 * + 10 x partner-type     university: track record and declared interest
 *                         company:    CSR focus and operating district
 *                         NGO:        local presence and response time
 *
 * Resource-first is the rule that makes this deployable rather than
 * theoretical: registry items already inside the radius are listed before
 * anybody proposes building something new. See nearby_resources() in
 * supabase/migrations/0005_functions.sql.
 *
 * Every recommendation carries its reasons, and a coordinator can override the
 * ranking. The override is written to the ledger.
 */

import type { OrgType, ScoreBreakdown, ScoreFactor } from "./types";

export interface MatchWeights {
  capability_fit: number;
  availability: number;
  proximity: number;
  resource_fit: number;
  partner_type: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  capability_fit: 40,
  availability: 20,
  proximity: 15,
  resource_fit: 15,
  partner_type: 10,
};

export interface MatchCandidate {
  org_id: string;
  name: string;
  type: OrgType;
  district: string | null;
  expertise: string[];
  csr_focus: string[];
  verified: boolean;
  distance_km: number | null;
  within_radius: boolean;
  /** Cosine similarity of the org profile against the challenge brief, 0-1. */
  capability_similarity: number | null;
  /** Free capacity across the capabilities this challenge needs, 0-1. */
  availability: number;
  /** Share of the open resource gap this partner could cover, 0-1. */
  resource_coverage: number;
  /** Challenges this org has already taken to DEPLOYED or IMPACT_VERIFIED. */
  track_record: number;
  /** Typical hours from accepting a task to being on site. */
  response_hours: number | null;
  /** True when the challenge's district is one this org already operates in. */
  operates_here: boolean;
}

export interface MatchContext {
  /** Capability keywords the compiled brief asked for. */
  neededCapabilities: string[];
  challengeDistrict: string | null;
  challengeCategory: string;
}

/** Distance decay: full marks on the doorstep, near zero past 120 km. */
const DISTANCE_HALF_LIFE_KM = 35;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Keyword overlap between what the challenge needs and what the org lists.
 * This is the deterministic fallback for capability fit, used whenever there is
 * no embedding, which is exactly the H9 checkpoint state.
 */
export function keywordCapabilityFit(needed: string[], expertise: string[]): number {
  if (!needed.length || !expertise.length) return 0;
  const haystack = expertise.map((e) => e.toLowerCase());
  let hits = 0;
  for (const need of needed) {
    const n = need.toLowerCase();
    if (haystack.some((e) => e.includes(n) || n.includes(e))) hits++;
  }
  return clamp01(hits / needed.length);
}

export function scoreMatch(
  candidate: MatchCandidate,
  ctx: MatchContext,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
  weightsVersion = "default",
): ScoreBreakdown {
  // Prefer the embedding, fall back to keyword overlap, and say which was used.
  const usedEmbedding = candidate.capability_similarity != null;
  const capabilityRaw = usedEmbedding
    ? clamp01(candidate.capability_similarity!)
    : keywordCapabilityFit(ctx.neededCapabilities, candidate.expertise);

  const availabilityRaw = clamp01(candidate.availability);

  const proximityRaw =
    candidate.distance_km == null
      ? 0.3 // unknown location is not the same as far away, but it cannot score full marks
      : clamp01(Math.exp(-candidate.distance_km / DISTANCE_HALF_LIFE_KM));

  const resourceRaw = clamp01(candidate.resource_coverage);

  // The partner-type bonus asks a different question of each kind of partner.
  let partnerRaw = 0;
  let partnerReason = "";
  switch (candidate.type) {
    case "univ": {
      const record = clamp01(candidate.track_record / 3);
      const interest = candidate.expertise.some((e) =>
        e.toLowerCase().includes(ctx.challengeCategory.split("_")[0]),
      )
        ? 1
        : 0;
      partnerRaw = clamp01(record * 0.6 + interest * 0.4);
      partnerReason = `University: ${candidate.track_record} challenge(s) already taken to deployment${interest ? ", and a declared interest in this area" : ""}.`;
      break;
    }
    case "company": {
      const csr = candidate.csr_focus.some(
        (f) =>
          f.toLowerCase().includes(ctx.challengeCategory.split("_")[0]) ||
          f.toLowerCase().includes("disaster"),
      )
        ? 1
        : 0;
      partnerRaw = clamp01(csr * 0.6 + (candidate.operates_here ? 0.4 : 0));
      partnerReason = `Company: ${csr ? "CSR focus matches this category" : "CSR focus does not name this category"}${candidate.operates_here ? `, and it already operates in ${ctx.challengeDistrict}` : ""}.`;
      break;
    }
    case "ngo":
    case "volunteers": {
      const presence = candidate.operates_here ? 1 : candidate.within_radius ? 0.6 : 0.2;
      const speed =
        candidate.response_hours == null ? 0.4 : clamp01(1 - candidate.response_hours / 48);
      partnerRaw = clamp01(presence * 0.6 + speed * 0.4);
      partnerReason = `NGO or volunteer group: ${candidate.operates_here ? "local presence in this district" : "operates nearby"}${candidate.response_hours != null ? `, typically on site within ${candidate.response_hours} hours` : ""}.`;
      break;
    }
    case "govt": {
      partnerRaw = candidate.operates_here ? 0.8 : 0.3;
      partnerReason = candidate.operates_here
        ? "Government body with jurisdiction here."
        : "Government body, outside this district.";
      break;
    }
  }

  const factors: ScoreFactor[] = [
    {
      key: "capability_fit",
      label: "Capability fit",
      raw: capabilityRaw,
      max: weights.capability_fit,
      points: capabilityRaw * weights.capability_fit,
      reason: usedEmbedding
        ? `Profile matches the compiled brief at ${Math.round(capabilityRaw * 100)}% (embedding similarity).`
        : `Covers ${Math.round(capabilityRaw * 100)}% of the requested capabilities by keyword: ${ctx.neededCapabilities.join(", ")}.`,
    },
    {
      key: "availability",
      label: "Availability",
      raw: availabilityRaw,
      max: weights.availability,
      points: availabilityRaw * weights.availability,
      reason: `${Math.round(availabilityRaw * 100)}% of the needed capacity is free right now.`,
    },
    {
      key: "proximity",
      label: "Proximity",
      raw: proximityRaw,
      max: weights.proximity,
      points: proximityRaw * weights.proximity,
      reason:
        candidate.distance_km == null
          ? "No location on file for this organisation."
          : `${candidate.distance_km.toFixed(1)} km away${candidate.within_radius ? ", inside its stated response radius" : ", outside its stated response radius"}.`,
    },
    {
      key: "resource_fit",
      label: "Resource fit",
      raw: resourceRaw,
      max: weights.resource_fit,
      points: resourceRaw * weights.resource_fit,
      reason:
        resourceRaw > 0
          ? `Could cover about ${Math.round(resourceRaw * 100)}% of the open resource gap.`
          : "Holds none of the resources still needed.",
    },
    {
      key: "partner_type",
      label: "Partner type",
      raw: partnerRaw,
      max: weights.partner_type,
      points: partnerRaw * weights.partner_type,
      reason: partnerReason,
    },
  ].map((f) => ({ ...f, points: Math.round(f.points * 10) / 10 }));

  const total = Math.round(
    Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0))),
  );

  return { total, factors, weightsVersion };
}

/** The short reason list the UI shows next to each recommendation. */
export function matchReasons(breakdown: ScoreBreakdown, limit = 3): string[] {
  return [...breakdown.factors]
    .filter((f) => f.max > 0 && f.points / f.max >= 0.4)
    .sort((a, b) => b.points / b.max - a.points / a.max)
    .slice(0, limit)
    .map((f) => f.reason);
}

// ---------------------------------------------------------------------------
// Skill-gap team builder
// ---------------------------------------------------------------------------

/**
 * Turns the capabilities a brief asks for into the seats a student team needs,
 * then reports which seats nobody has filled. The demo forms 2 ECE, 1 CSE,
 * 1 civil and a mentor.
 */
const CAPABILITY_TO_SEAT: Record<string, string> = {
  electronics: "ECE",
  sensors: "ECE",
  siren: "ECE",
  embedded: "ECE",
  telemetry: "ECE",
  software: "CSE",
  app: "CSE",
  data: "CSE",
  mapping: "CSE",
  civil: "Civil",
  shelter: "Civil",
  construction: "Civil",
  structural: "Civil",
  water_testing: "Environmental Science",
  water_quality: "Environmental Science",
  environment: "Environmental Science",
  agriculture: "Agriculture Extension",
  extension: "Agriculture Extension",
  health: "Public Health",
  logistics: "Logistics",
  training: "Community Outreach",
};

export interface TeamSeat {
  seat: string;
  count: number;
  reason: string;
}

export function buildTeamPlan(neededCapabilities: string[]): TeamSeat[] {
  const tally = new Map<string, string[]>();
  for (const cap of neededCapabilities) {
    const key = Object.keys(CAPABILITY_TO_SEAT).find((k) => cap.toLowerCase().includes(k));
    const seat = key ? CAPABILITY_TO_SEAT[key] : "Generalist";
    tally.set(seat, [...(tally.get(seat) ?? []), cap]);
  }

  const seats: TeamSeat[] = [...tally.entries()].map(([seat, caps]) => ({
    seat,
    // Two students on the discipline carrying the most of the work, one elsewhere.
    count: caps.length >= 2 ? 2 : 1,
    reason: `Needed for: ${caps.join(", ")}.`,
  }));

  // Every student team gets a faculty mentor. NEP 2020 credit depends on it.
  seats.push({ seat: "Mentor", count: 1, reason: "Faculty mentor, required for credit-bearing project work." });
  return seats;
}
