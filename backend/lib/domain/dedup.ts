/**
 * Formula 3 of 5: deduplication and clustering.
 *
 *   same cluster if cosine >= 0.85 AND distance <= 2 km AND age <= 30 days
 *   0.75 - 0.85 is "possible duplicate", and a coordinator decides
 *
 * This is the difference between "47 reports of a blocked culvert" and one
 * challenge carrying "47 reporters, 12 photos, 3 villages". It is also real
 * engineering rather than a CRUD screen: embeddings plus a geo distance.
 */

export const DEDUP_THRESHOLDS = {
  mergeSimilarity: 0.85,
  reviewSimilarity: 0.75,
  maxDistanceKm: 2,
  maxAgeDays: 30,
} as const;

export type DedupDecision = "merge" | "review" | "new";

export interface DedupCandidate {
  challenge_id: string;
  ref: string | null;
  title: string;
  similarity: number;
  /** Null when either side has no coordinates; the district then decides the place. */
  distance_km: number | null;
  age_days: number;
  status: string;
  /**
   * Same district as the report. Only consulted when distance_km is null: a web
   * report names a district, not a point, and similar words from another
   * district are a different problem. Null when either district is unknown.
   */
  same_district?: boolean | null;
}

export interface DedupResult {
  decision: DedupDecision;
  match: DedupCandidate | null;
  /** Everything the coordinator should see when the decision is "review". */
  candidates: DedupCandidate[];
  reason: string;
}

/**
 * A report with no GPS is not automatically a new problem. Without coordinates
 * we still cluster on text within the same district, but demand a higher
 * similarity, because a district is far larger than the 2 km radius.
 */
const NO_LOCATION_MERGE_SIMILARITY = 0.9;

type Thresholds = typeof DEDUP_THRESHOLDS;

/** Positively the same place: within the radius, or the same district when there is no GPS. */
function samePlace(c: DedupCandidate, t: Thresholds): boolean {
  if (c.distance_km != null) return c.distance_km <= t.maxDistanceKm;
  return c.same_district === true;
}

/** Positively a different place. Unknown is neither. */
function differentPlace(c: DedupCandidate, t: Thresholds): boolean {
  if (c.distance_km != null) return c.distance_km > t.maxDistanceKm;
  return c.same_district === false;
}

export function decideDedup(
  candidates: DedupCandidate[],
  thresholds: Thresholds = DEDUP_THRESHOLDS,
): DedupResult {
  const usable = candidates
    .filter((c) => c.age_days <= thresholds.maxAgeDays)
    .sort((a, b) => b.similarity - a.similarity);

  if (!usable.length) {
    return { decision: "new", match: null, candidates: [], reason: "Nothing similar nearby in the last 30 days." };
  }

  const top = usable.slice(0, 5);
  const label = (c: DedupCandidate) => c.ref ?? c.title;

  // Merge only when the place is positively the same. The best textual match
  // in another district must not swallow a report that has its own match here.
  const merge = usable.find(
    (c) =>
      c.similarity >= (c.distance_km == null ? NO_LOCATION_MERGE_SIMILARITY : thresholds.mergeSimilarity) &&
      samePlace(c, thresholds),
  );
  if (merge) {
    return {
      decision: "merge",
      match: merge,
      candidates: top,
      reason:
        merge.distance_km == null
          ? `Text similarity ${merge.similarity.toFixed(2)} against ${label(merge)} in the same district. There was no GPS to measure distance, so the bar was raised to ${NO_LOCATION_MERGE_SIMILARITY}.`
          : `Similarity ${merge.similarity.toFixed(2)} and ${merge.distance_km.toFixed(1)} km from ${label(merge)}.`,
    };
  }

  // A likely match whose place cannot be compared goes to a person, not into a cluster.
  const review = usable.find(
    (c) => c.similarity >= thresholds.reviewSimilarity && !differentPlace(c, thresholds),
  );
  if (review) {
    return {
      decision: "review",
      match: review,
      candidates: top,
      reason:
        review.distance_km == null && review.same_district == null
          ? `Similarity ${review.similarity.toFixed(2)} to ${label(review)}, but the two places could not be compared, so a person decides whether this is the same problem.`
          : `Similarity ${review.similarity.toFixed(2)} to ${label(review)} is below the merge bar, so a person decides whether this is the same problem.`,
    };
  }

  const best = usable[0];
  return {
    decision: "new",
    match: null,
    candidates: top,
    reason: !differentPlace(best, thresholds)
      ? `Closest match is only ${best.similarity.toFixed(2)} similar, below the ${thresholds.reviewSimilarity} review threshold.`
      : best.distance_km != null
        ? `Closest match is ${best.distance_km.toFixed(1)} km away, beyond the ${thresholds.maxDistanceKm} km radius.`
        : `The closest match (${best.similarity.toFixed(2)}) is in a different district, so this is a separate problem.`,
  };
}

/** Cosine similarity, used by the local fallback when there is no vector index in play. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Embedding width mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
