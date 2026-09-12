/**
 * Formula 2 of 5: the confidence ladder.
 *
 * Confidence answers "is it real?". Priority answers "how urgent is it?". They
 * are kept apart on purpose, because AI cannot answer the first on its own and
 * conflating them is how a portal ends up ranking rumours.
 *
 *   unverified
 *   -> community corroborated   (>= 3 independent reporters in the cluster)
 *   -> field verified           (a volunteer or NGO photo)
 *   -> coordinator approved
 *   -> resolved with evidence
 *
 * An "inaccurate" flag from verified locals drops it one level until somebody
 * checks. Plain SMS from an unknown number starts at the bottom. Low confidence
 * is labelled, never hidden.
 */

import type { ConfidenceLevel } from "./types";
import { CONFIDENCE_LEVELS } from "./types";

export const COMMUNITY_CORROBORATION_THRESHOLD = 3;

export function confidenceRank(level: ConfidenceLevel): number {
  return CONFIDENCE_LEVELS.indexOf(level);
}

export function confidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case "unverified": return "Unverified";
    case "community_corroborated": return "Community corroborated";
    case "field_verified": return "Field verified";
    case "coordinator_approved": return "Coordinator approved";
    case "resolved_with_evidence": return "Resolved with evidence";
  }
}

export interface ConfidenceInput {
  /** Distinct reporters across the whole cluster, not raw report count. */
  uniqueReporters: number;
  /** A volunteer or NGO has filed a `field` verification with a photo. */
  hasFieldVerification: boolean;
  coordinatorApproved: boolean;
  /** Closure evidence is in and a verifier has signed it off. */
  resolvedWithEvidence: boolean;
  /** Open `inaccurate` flags from verified locals that nobody has checked yet. */
  openInaccurateFlags: number;
  /** Plain SMS from a number we do not know starts at the bottom of the ladder. */
  fromUnknownSmsOnly?: boolean;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  reason: string;
  /** True when an unchecked "inaccurate" flag pulled this down a rung. */
  demoted: boolean;
}

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  let level: ConfidenceLevel = "unverified";
  let reason = "No corroboration yet.";

  if (input.uniqueReporters >= COMMUNITY_CORROBORATION_THRESHOLD) {
    level = "community_corroborated";
    reason = `${input.uniqueReporters} independent reporters describe the same problem.`;
  }
  if (input.hasFieldVerification) {
    level = "field_verified";
    reason = "A field volunteer or NGO confirmed it on the ground with a photo.";
  }
  if (input.coordinatorApproved) {
    level = "coordinator_approved";
    reason = "A district or faculty coordinator approved the compiled brief.";
  }
  if (input.resolvedWithEvidence) {
    level = "resolved_with_evidence";
    reason = "Closed with evidence and a verifier's sign-off.";
  }

  // An unknown SMS number on its own never climbs past the bottom rung.
  if (input.fromUnknownSmsOnly && !input.hasFieldVerification && !input.coordinatorApproved) {
    return {
      level: "unverified",
      reason: "Arrived as plain SMS from a number we do not recognise, so it starts unverified.",
      demoted: false,
    };
  }

  let demoted = false;
  if (input.openInaccurateFlags > 0 && !input.resolvedWithEvidence) {
    const rank = Math.max(0, confidenceRank(level) - 1);
    if (rank !== confidenceRank(level)) demoted = true;
    level = CONFIDENCE_LEVELS[rank];
    reason = `${input.openInaccurateFlags} verified local(s) flagged this as inaccurate, so it drops a level until someone checks.`;
  }

  return { level, reason, demoted };
}

/**
 * A challenge may only be approved by a coordinator once the Compiler has
 * actually drafted a brief. The AI draft always comes before the human check,
 * never the other way round.
 */
export function canApprove(status: string): boolean {
  return status === "REFINED";
}
