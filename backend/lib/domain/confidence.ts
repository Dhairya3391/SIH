/**
 * Formula 2 of 5: the confidence ladder.
 *
 * Confidence answers "is it real?". Priority answers "how urgent is it?". They
 * are kept apart on purpose, because conflating them is how a portal ends up
 * ranking rumours.
 *
 *   unverified
 *   -> community corroborated   (>= 3 independent reporters in the cluster)
 *   -> externally corroborated  (the AI found independent proof - weather,
 *                                news or web - and cited every source)
 *   -> field verified           (a verifier confirmed it with sources or photos)
 *   -> coordinator approved
 *   -> resolved with evidence
 *
 * Everything from "externally corroborated" up counts as verified and opens the
 * problem to colleges. An "inaccurate" flag filed after the last positive check
 * drops it one rung until somebody looks again. Plain SMS from an unknown number
 * starts at the bottom. Low confidence is labelled, never hidden.
 */

import type { ConfidenceLevel } from "./types";
import { CONFIDENCE_LEVELS, VERIFIED_CONFIDENCE } from "./types";

export const COMMUNITY_CORROBORATION_THRESHOLD = 3;

export function confidenceRank(level: ConfidenceLevel): number {
  return CONFIDENCE_LEVELS.indexOf(level);
}

export function isVerifiedConfidence(level: string | null | undefined): boolean {
  return VERIFIED_CONFIDENCE.includes(level as ConfidenceLevel);
}

export function confidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case "unverified": return "Unverified";
    case "community_corroborated": return "Community corroborated";
    case "externally_corroborated": return "Verified by independent sources";
    case "field_verified": return "Field verified";
    case "coordinator_approved": return "Coordinator approved";
    case "resolved_with_evidence": return "Resolved with evidence";
  }
}

export interface ConfidenceInput {
  /** Distinct reporters across the whole cluster, not raw report count. */
  uniqueReporters: number;
  /** The corroboration engine found cited, independent proof and verified it. */
  externallyVerified: boolean;
  /** A verifier or volunteer confirmed it with sources or photos. */
  hasFieldVerification: boolean;
  coordinatorApproved: boolean;
  /** Closure evidence is in and the community signed it off. */
  resolvedWithEvidence: boolean;
  /** `inaccurate` flags filed after the most recent positive check. */
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
  if (input.externallyVerified) {
    level = "externally_corroborated";
    reason = "The AI found independent sources - weather records, news or the web - confirming it, and cited them.";
  }
  if (input.hasFieldVerification) {
    level = "field_verified";
    reason = "A verifier confirmed it with sources or photos.";
  }
  if (input.coordinatorApproved) {
    level = "coordinator_approved";
    reason = "A district coordinator approved the compiled brief.";
  }
  if (input.resolvedWithEvidence) {
    level = "resolved_with_evidence";
    reason = "Closed with evidence and the community's sign-off.";
  }

  // An unknown SMS number on its own never climbs past the bottom rung.
  if (
    input.fromUnknownSmsOnly &&
    !input.hasFieldVerification &&
    !input.coordinatorApproved &&
    !input.externallyVerified
  ) {
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
    reason = `${input.openInaccurateFlags} flag(s) say this is inaccurate, so it drops a level until someone checks.`;
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
