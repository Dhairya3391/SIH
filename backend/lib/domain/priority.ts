/**
 * Formula 1 of 5: the priority score.
 *
 * A 0-100 urgency score with its reasons shown. This is deterministic code, not
 * AI: the model only proposes the severity input, and a coordinator can
 * override that. Upvote-driven portals bury remote villages under loud urban
 * ones, so popularity is capped at 5 of the 100 points while vulnerability
 * carries 15.
 *
 *   25 x severity          (AI proposes 1-5, coordinator can override)
 * + 15 x urgency           (deadline, worsening fast, Crisis Mode boost)
 * + 15 x people affected   (log scale)
 * + 15 x vulnerability     (children, elderly, disability, pregnancy,
 *                           medical dependency, isolation, no phone signal)
 * + 10 x hazard exposure   (from the GIS layer)
 * + 10 x resource gap      (share of the need still unpledged)
 * +  5 x recurrence        (seasonal or repeated)
 * +  5 x community signal  (unique reporters, log scale, CAPPED)
 */

import type { ScoreBreakdown, ScoreFactor, VulnerabilityTag } from "./types";
import { priorityBand } from "./types";

export interface PriorityWeights {
  severity: number;
  urgency: number;
  people: number;
  vulnerability: number;
  hazard: number;
  resource_gap: number;
  recurrence: number;
  community: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  severity: 25,
  urgency: 15,
  people: 15,
  vulnerability: 15,
  hazard: 10,
  resource_gap: 10,
  recurrence: 5,
  community: 5,
};

export interface PriorityInput {
  /** 1-5. 5 = immediate threat to life, 1 = minor. */
  severity: number;
  /** 1-5, how fast it is worsening or how near the deadline is. */
  urgency: number;
  peopleAffected: number;
  vulnerable: VulnerabilityTag[];
  /** 0-1 from hazard_cells; 0 when we have no layer for that point. */
  hazardExposure: number;
  /**
   * True when hazardExposure came from the district's mapped cells rather than
   * the report's own coordinates, because the report carried no GPS. The
   * number is still real; the reason string must not claim point precision.
   */
  hazardIsDistrictEstimate?: boolean;
  /** 0-1, share of the listed need that nobody has pledged yet. */
  resourceGap: number;
  /** How many times this has recurred, seasonally or otherwise. */
  recurrenceCount: number;
  /** Distinct reporters in the cluster. */
  uniqueReporters: number;
  /** Crisis Mode lifts urgency to at least 0.8: a live flood is not a backlog item. */
  crisisMode?: boolean;
  /** Hours until a stated deadline, if the brief names one. */
  hoursToDeadline?: number | null;
}

/** People affected saturates: 4,800 and 9,000 are both "a lot of people". */
const PEOPLE_SATURATION = 5000;
/** Reporter count saturates fast, which is what caps popularity in practice. */
const REPORTER_SATURATION = 30;

/**
 * Not every vulnerability indicator carries the same risk, so they are weighted
 * rather than counted. The divisor is the worst realistic combination, not the
 * sum of all seven, or a single very exposed group could never score high.
 */
const VULNERABILITY_WEIGHTS: Record<VulnerabilityTag, number> = {
  medical_dependency: 1.0,
  disability: 0.9,
  pregnancy: 0.9,
  elderly: 0.8,
  children: 0.8,
  isolated: 0.7,
  no_signal: 0.5,
};
const VULNERABILITY_DIVISOR = 3.4;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Log-scale normalisation, so the first hundred people matter more than the next thousand. */
function logNorm(value: number, saturation: number): number {
  if (value <= 0) return 0;
  return clamp01(Math.log1p(value) / Math.log1p(saturation));
}

export function severityLabel(severity: number): string {
  switch (Math.round(severity)) {
    case 5: return "immediate threat to life";
    case 4: return "serious harm to health, safety or livelihood";
    case 3: return "an essential service is down";
    case 2: return "inconvenience";
    default: return "minor";
  }
}

export function computePriority(
  input: PriorityInput,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
  weightsVersion = "default",
): ScoreBreakdown {
  const severityRaw = clamp01((input.severity - 1) / 4);

  // Urgency: the stated value, lifted by a near deadline, and floored in a crisis.
  let urgencyRaw = clamp01((input.urgency - 1) / 4);
  if (input.hoursToDeadline != null && input.hoursToDeadline >= 0) {
    // Inside 72 hours the deadline starts to dominate.
    urgencyRaw = Math.max(urgencyRaw, clamp01(1 - input.hoursToDeadline / 72));
  }
  if (input.crisisMode) urgencyRaw = Math.max(urgencyRaw, 0.8);

  const peopleRaw = logNorm(input.peopleAffected, PEOPLE_SATURATION);

  const vulnSum = [...new Set(input.vulnerable)].reduce(
    (sum, tag) => sum + (VULNERABILITY_WEIGHTS[tag] ?? 0),
    0,
  );
  const vulnerabilityRaw = clamp01(vulnSum / VULNERABILITY_DIVISOR);

  const hazardRaw = clamp01(input.hazardExposure);
  const gapRaw = clamp01(input.resourceGap);

  // Once, twice, three or more times. Beyond that it is simply "recurring".
  const recurrenceRaw = clamp01(input.recurrenceCount / 3);

  const communityRaw = logNorm(input.uniqueReporters, REPORTER_SATURATION);

  const factors: ScoreFactor[] = [
    {
      key: "severity",
      label: "Severity",
      raw: severityRaw,
      max: weights.severity,
      points: severityRaw * weights.severity,
      reason: `Rated ${input.severity}/5: ${severityLabel(input.severity)}.`,
    },
    {
      key: "urgency",
      label: "Urgency",
      raw: urgencyRaw,
      max: weights.urgency,
      points: urgencyRaw * weights.urgency,
      reason: input.crisisMode
        ? "Crisis Mode is active for this district, so urgency is floored at 80%."
        : input.hoursToDeadline != null
          ? `About ${Math.round(input.hoursToDeadline)} hours until the stated deadline.`
          : `Reported urgency ${input.urgency}/5.`,
    },
    {
      key: "people",
      label: "People affected",
      raw: peopleRaw,
      max: weights.people,
      points: peopleRaw * weights.people,
      reason: `About ${input.peopleAffected.toLocaleString("en-IN")} people, on a log scale that saturates near ${PEOPLE_SATURATION.toLocaleString("en-IN")}.`,
    },
    {
      key: "vulnerability",
      label: "Vulnerability",
      raw: vulnerabilityRaw,
      max: weights.vulnerability,
      points: vulnerabilityRaw * weights.vulnerability,
      reason: input.vulnerable.length
        ? `Vulnerable groups present: ${input.vulnerable.join(", ").replace(/_/g, " ")}.`
        : "No vulnerable groups recorded.",
    },
    {
      key: "hazard",
      label: "Hazard exposure",
      raw: hazardRaw,
      max: weights.hazard,
      points: hazardRaw * weights.hazard,
      reason: hazardRaw > 0
        ? input.hazardIsDistrictEstimate
          ? `District-level estimate: the mapped cells covering this district peak at ${Math.round(hazardRaw * 100)}% intensity. No GPS on the report, so this is not a point reading.`
          : `Inside a mapped hazard zone at ${Math.round(hazardRaw * 100)}% intensity.`
        : "Not inside a mapped hazard zone.",
    },
    {
      key: "resource_gap",
      label: "Resource gap",
      raw: gapRaw,
      max: weights.resource_gap,
      points: gapRaw * weights.resource_gap,
      reason: gapRaw >= 1
        ? "Nothing has been pledged against this yet."
        : `${Math.round(gapRaw * 100)}% of the stated need is still unpledged.`,
    },
    {
      key: "recurrence",
      label: "Recurrence",
      raw: recurrenceRaw,
      max: weights.recurrence,
      points: recurrenceRaw * weights.recurrence,
      reason: input.recurrenceCount > 0
        ? `Reported ${input.recurrenceCount} time(s) before, so it is recurring rather than one-off.`
        : "First time this has been reported here.",
    },
    {
      key: "community",
      label: "Community signal",
      raw: communityRaw,
      max: weights.community,
      points: communityRaw * weights.community,
      reason: `${input.uniqueReporters} distinct reporter(s). Capped at ${weights.community} points so loud areas cannot outrank remote ones.`,
    },
  ].map((f) => ({ ...f, points: Math.round(f.points * 10) / 10 }));

  const total = Math.round(
    Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0))),
  );

  return { total, factors, weightsVersion };
}

/**
 * The one-line "why critical" that sits under the score on the challenge card.
 * It names the two or three factors that actually drove the number, because a
 * coordinator approving in one click needs the reason, not the arithmetic.
 */
export function explainPriority(
  breakdown: ScoreBreakdown,
  context: { district?: string | null; peopleAffected?: number; hasPartner?: boolean } = {},
): string {
  const top = [...breakdown.factors]
    .filter((f) => f.max > 0)
    .sort((a, b) => b.points / b.max - a.points / a.max)
    .slice(0, 3);

  const parts: string[] = [];
  for (const f of top) {
    if (f.points / f.max < 0.5) continue;
    switch (f.key) {
      case "severity":
        parts.push(severityLabel(Math.round(f.raw * 4 + 1)));
        break;
      case "vulnerability":
        parts.push("vulnerable groups affected");
        break;
      case "people":
        parts.push(`around ${(context.peopleAffected ?? 0).toLocaleString("en-IN")} people affected`);
        break;
      case "hazard":
        parts.push(`inside a mapped hazard zone${context.district ? ` in ${context.district}` : ""}`);
        break;
      case "urgency":
        parts.push("worsening quickly");
        break;
      case "resource_gap":
        parts.push("nothing pledged against it yet");
        break;
      case "recurrence":
        parts.push("a recurring problem");
        break;
      case "community":
        parts.push("corroborated by many reporters");
        break;
    }
  }
  if (context.hasPartner === false) parts.push("no partner assigned yet");

  const band = priorityBand(breakdown.total);
  const lead = band === "critical" ? "Critical" : band === "high" ? "High priority" : "Priority";
  if (!parts.length) return `${lead}: scored ${breakdown.total}/100 on the published weights.`;
  return `${lead}: ${parts.slice(0, 3).join(", ")}.`;
}
