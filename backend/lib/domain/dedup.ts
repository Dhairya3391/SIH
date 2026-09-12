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
  /** Null when either side has no coordinates; we then fall back to text alone. */
  distance_km: number | null;
  age_days: number;
  status: string;
}

export interface DedupResult {
  decision: DedupDecision;
  match: DedupCandidate | null;
  /** Everything the coordinator should see when the decision is "review". */
  candidates: DedupCandidate[];
  reason: string;
}

/**
 * A report with no location is not automatically a new problem. When we have no
 * coordinates we still cluster on text, but we demand a higher similarity,
 * because distance is doing none of the work.
 */
const NO_LOCATION_MERGE_SIMILARITY = 0.9;

export function decideDedup(
  candidates: DedupCandidate[],
  thresholds: typeof DEDUP_THRESHOLDS = DEDUP_THRESHOLDS,
): DedupResult {
  const usable = candidates
    .filter((c) => c.age_days <= thresholds.maxAgeDays)
    .sort((a, b) => b.similarity - a.similarity);

  if (!usable.length) {
    return { decision: "new", match: null, candidates: [], reason: "Nothing similar nearby in the last 30 days." };
  }

  const best = usable[0];
  const withinDistance = best.distance_km == null || best.distance_km <= thresholds.maxDistanceKm;
  const mergeBar = best.distance_km == null ? NO_LOCATION_MERGE_SIMILARITY : thresholds.mergeSimilarity;

  if (best.similarity >= mergeBar && withinDistance) {
    return {
      decision: "merge",
      match: best,
      candidates: usable.slice(0, 5),
      reason:
        best.distance_km == null
          ? `Text similarity ${best.similarity.toFixed(2)} against ${best.ref ?? best.title}, with no location to check, so the bar was raised to ${NO_LOCATION_MERGE_SIMILARITY}.`
          : `Similarity ${best.similarity.toFixed(2)} and ${best.distance_km.toFixed(1)} km from ${best.ref ?? best.title}.`,
    };
  }

  if (best.similarity >= thresholds.reviewSimilarity && withinDistance) {
    return {
      decision: "review",
      match: best,
      candidates: usable.slice(0, 5),
      reason: `Similarity ${best.similarity.toFixed(2)} is in the 0.75-0.85 band, so a coordinator decides whether this is the same problem.`,
    };
  }

  return {
    decision: "new",
    match: null,
    candidates: usable.slice(0, 5),
    reason: withinDistance
      ? `Closest match is only ${best.similarity.toFixed(2)} similar, below the 0.75 review threshold.`
      : `Closest match is ${best.distance_km?.toFixed(1)} km away, beyond the ${thresholds.maxDistanceKm} km radius.`,
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
