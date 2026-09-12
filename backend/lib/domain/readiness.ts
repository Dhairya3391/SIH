/**
 * Formula 5 of 5: the Solution Readiness Score.
 *
 * Each factor is rated 1-5 by a coordinator or faculty mentor. Cost, time and
 * local resources arrive pre-filled from the proposal and the registry, so the
 * human is confirming a number rather than inventing one.
 *
 *   20 x technical feasibility
 * + 15 x cost feasibility
 * + 15 x time to deploy
 * + 15 x local resource availability   (from the registry)
 * + 15 x safety
 * + 10 x community acceptance          (from community validation)
 * + 10 x scalability
 *
 * This is what turns idea collection into adoption, and it is the demo beat
 * that lands hardest: an impressive AI prediction system scores 48, a cheap
 * siren relay scores 84, and the one that can actually be deployed wins.
 *
 * A rating of r out of 5 earns r/5 of that factor's points, so the five whole
 * ratings map onto the whole-number sub-scores shown in the playbook.
 */

import type { ScoreBreakdown, ScoreFactor } from "./types";

export interface ReadinessWeights {
  technical: number;
  cost: number;
  time_to_deploy: number;
  local_resources: number;
  safety: number;
  community_acceptance: number;
  scalability: number;
}

export const DEFAULT_READINESS_WEIGHTS: ReadinessWeights = {
  technical: 20,
  cost: 15,
  time_to_deploy: 15,
  local_resources: 15,
  safety: 15,
  community_acceptance: 10,
  scalability: 10,
};

export type ReadinessFactorKey = keyof ReadinessWeights;

export const READINESS_LABELS: Record<ReadinessFactorKey, string> = {
  technical: "Technical feasibility",
  cost: "Cost feasibility",
  time_to_deploy: "Time to deploy",
  local_resources: "Local resource availability",
  safety: "Safety",
  community_acceptance: "Community acceptance",
  scalability: "Scalability",
};

/** Every rating is 1-5, from a coordinator or a faculty mentor. */
export type ReadinessRatings = Record<ReadinessFactorKey, number>;

export function computeReadiness(
  ratings: Partial<ReadinessRatings>,
  weights: ReadinessWeights = DEFAULT_READINESS_WEIGHTS,
  weightsVersion = "default",
): ScoreBreakdown {
  const factors: ScoreFactor[] = (Object.keys(weights) as ReadinessFactorKey[]).map((key) => {
    const rating = Math.max(0, Math.min(5, ratings[key] ?? 0));
    const raw = rating / 5;
    return {
      key,
      label: READINESS_LABELS[key],
      raw,
      max: weights[key],
      points: Math.round(raw * weights[key] * 10) / 10,
      reason: rating === 0 ? "Not yet rated." : `Rated ${rating}/5 by the reviewer.`,
    };
  });

  const total = Math.round(
    Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0))),
  );
  return { total, factors, weightsVersion };
}

/** Have all seven factors been rated? A pilot cannot be approved on a partial review. */
export function isFullyRated(ratings: Partial<ReadinessRatings>): boolean {
  return (Object.keys(DEFAULT_READINESS_WEIGHTS) as ReadinessFactorKey[]).every(
    (k) => typeof ratings[k] === "number" && ratings[k]! >= 1 && ratings[k]! <= 5,
  );
}

// ---------------------------------------------------------------------------
// Pre-fill: cost, time and local resources come from data, not from a guess
// ---------------------------------------------------------------------------

export interface PrefillInput {
  costEstimate: number | null;
  deployDays: number | null;
  /** Share of the proposal's material needs already sitting in the local registry, 0-1. */
  localResourceCoverage: number;
  /** `improved` and `still_exists` signals from verified locals on this challenge. */
  communitySignals: { positive: number; negative: number };
}

/**
 * Turns raw proposal numbers into suggested 1-5 ratings. A reviewer can change
 * any of them; what matters is that the starting point is a fact.
 *
 * The cost bands are rupee figures for a district-scale pilot, which is the
 * scale everything in this platform is built around.
 */
export function prefillRatings(input: PrefillInput): Partial<ReadinessRatings> {
  const out: Partial<ReadinessRatings> = {};

  if (input.costEstimate != null) {
    const c = input.costEstimate;
    out.cost = c <= 50_000 ? 5 : c <= 200_000 ? 4 : c <= 750_000 ? 3 : c <= 2_500_000 ? 2 : 1;
  }

  if (input.deployDays != null) {
    const d = input.deployDays;
    out.time_to_deploy = d <= 30 ? 5 : d <= 90 ? 4 : d <= 180 ? 3 : d <= 365 ? 2 : 1;
  }

  out.local_resources = Math.max(1, Math.ceil(input.localResourceCoverage * 5));

  const { positive, negative } = input.communitySignals;
  const totalSignals = positive + negative;
  out.community_acceptance =
    totalSignals === 0 ? 3 : Math.max(1, Math.round((positive / totalSignals) * 5));

  return out;
}

/** The sentence that explains why one proposal beat another. */
export function compareProposals(
  a: { title: string; breakdown: ScoreBreakdown },
  b: { title: string; breakdown: ScoreBreakdown },
): string {
  const [winner, loser] = a.breakdown.total >= b.breakdown.total ? [a, b] : [b, a];
  const gaps = winner.breakdown.factors
    .map((f, i) => ({ label: f.label, delta: f.points - loser.breakdown.factors[i].points }))
    .filter((g) => g.delta > 0)
    .sort((x, y) => y.delta - x.delta)
    .slice(0, 2)
    .map((g) => g.label.toLowerCase());

  return `${winner.title} scores ${winner.breakdown.total} against ${loser.breakdown.total}, mainly on ${gaps.join(" and ")}.`;
}
