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

/**
 * Bars for JharSetu's own dedup model (ml/dedup), which lives in its own vector
 * space and scores lower than Gemini for the same pair. Calibrated on
 * hand-written pairs that are not the test set; measured on the frozen test set
 * at 85% precision and 73% recall. See ml/RESULTS.md.
 */
export const TRAINED_DEDUP = {
  merge: 0.47,
  review: 0.4,
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
  /**
   * Same category as the report's compiled brief. Consulted only when the
   * embedding is the local hashing vectoriser, whose scores measure shared
   * words rather than meaning. Null when either category is unknown.
   */
  same_category?: boolean | null;
}

export interface DedupOptions {
  /**
   * The embedding came from the local hashing vectoriser. Two reports of the
   * same flood in different words score around 0.4 there, so similarity alone
   * never reaches the merge bar; the compiled category and the distance decide.
   */
  lexicalEmbedding?: boolean;
}

/** Local-vectoriser fallback: same category this close and this recent is the same problem. */
export const LEXICAL_FALLBACK = {
  mergeDistanceKm: 1,
  mergeMaxAgeDays: 7,
  reviewSimilarityFloor: 0.25,
} as const;

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

/**
 * Numbers, not the literal types of DEDUP_THRESHOLDS: our own dedup model
 * scores in a different range and passes its own bars (TRAINED_DEDUP).
 */
type Thresholds = { -readonly [K in keyof typeof DEDUP_THRESHOLDS]: number };

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
  options: DedupOptions = {},
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

  if (options.lexicalEmbedding) {
    // Without semantic embeddings, the same kind of problem at the same spot is
    // the same problem. Requires GPS on both sides: a district is too large.
    const near = usable
      .filter((c) => c.same_category === true && c.distance_km != null)
      .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
    const lexMerge = near.find(
      (c) => c.distance_km! <= LEXICAL_FALLBACK.mergeDistanceKm && c.age_days <= LEXICAL_FALLBACK.mergeMaxAgeDays,
    );
    if (lexMerge) {
      return {
        decision: "merge",
        match: lexMerge,
        candidates: top,
        reason: `Same kind of problem ${lexMerge.distance_km!.toFixed(2)} km from ${label(lexMerge)}, reported within ${LEXICAL_FALLBACK.mergeMaxAgeDays} days. Semantic embeddings are not configured, so category and distance decided rather than wording (similarity ${lexMerge.similarity.toFixed(2)}).`,
      };
    }
    const lexReview = near.find(
      (c) => c.distance_km! <= thresholds.maxDistanceKm && c.similarity >= LEXICAL_FALLBACK.reviewSimilarityFloor,
    );
    if (lexReview) {
      return {
        decision: "review",
        match: lexReview,
        candidates: top,
        reason: `Same kind of problem ${lexReview.distance_km!.toFixed(2)} km from ${label(lexReview)}. Too far or too old to merge automatically without semantic embeddings, so a person decides.`,
      };
    }
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
