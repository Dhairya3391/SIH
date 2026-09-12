import "server-only";
import { llmJson, isAiEnabled, AiUnavailableError } from "./llm";

/**
 * Scores a college's solution proposal against a fixed, published rubric.
 *
 * Three rules make this fair enough to put a college's work through:
 *
 *  1. SCORED ONCE. The caller persists the score at submission and never
 *     recomputes it on read. Re-running a non-deterministic model would
 *     silently reshuffle the leaderboard, and a displaced college would have a
 *     dispute nobody could answer.
 *  2. SCORED INDEPENDENTLY. Other proposals are never passed in. A later
 *     submission must not be able to change an earlier score.
 *  3. SCORED TRANSPARENTLY. Every criterion returns its own points, a reason,
 *     and the pages it read them from, so a rejection is feedback a student
 *     can act on rather than a number they can only argue with.
 */

export const RUBRIC_VERSION = "v1";

export interface RubricCriterion {
  key: string;
  label: string;
  max: number;
  /** What a good answer looks like, sent to the model verbatim. */
  guidance: string;
}

/** Weights sum to 100. Published, so a college knows what it is being judged on. */
export const RUBRIC: RubricCriterion[] = [
  {
    key: "problem_fit",
    label: "Problem fit",
    max: 25,
    guidance:
      "Does it solve THIS challenge as briefed? Judge against the challenge's own problem statement and stated needs, not against a generic idea of the category. A well-built solution to a different problem scores zero here.",
  },
  {
    key: "technical_soundness",
    label: "Technical soundness",
    max: 20,
    guidance:
      "Is the approach workable? Are the components real, available in India, and used the way they actually work?",
  },
  {
    key: "practicality_in_context",
    label: "Practicality in context",
    max: 15,
    guidance:
      "Can this be built AND MAINTAINED in a rural Jharkhand block: intermittent power, no reliable internet, local labour, monsoon, no technician on call? A solution that needs a cloud API and a site visit every month scores low here even if it is technically elegant. This is the criterion that stops the platform funding things that die in six months.",
  },
  {
    key: "cost_credibility",
    label: "Cost credibility",
    max: 15,
    guidance:
      "Is the stated funding plausible for the stated scope? Flag both a figure that looks far too low to deliver and one that looks inflated.",
  },
  {
    key: "timeline_credibility",
    label: "Timeline credibility",
    max: 10,
    guidance:
      "Is the duration plausible for the work described, and does it respect any deadline in the brief such as a monsoon?",
  },
  {
    key: "requirements_completeness",
    label: "Requirements completeness",
    max: 10,
    guidance:
      "Are materials, quantities, units and skills specified well enough that a company could pledge against them without asking a question?",
  },
  {
    key: "maintenance_handover",
    label: "Maintenance and handover",
    max: 5,
    guidance:
      "Who owns it after deployment, and who repairs it in year two? Name the panchayat, school or department that takes it on.",
  },
];

export const VIABILITY_FLOOR = 40;
export const NEEDS_CHANGES_CEILING = 55;

export interface ProposalScoreCriterion {
  key: string;
  label: string;
  max: number;
  points: number;
  reason: string;
  pages: number[];
}

export interface ProposalExtraction {
  funding_required: number | null;
  currency: string;
  duration_days: number | null;
  materials: Array<{ item: string; qty: number | null; unit: string | null }>;
}

export interface ProposalReview {
  total: number;
  verdict: "viable" | "needs_changes" | "not_viable";
  criteria: ProposalScoreCriterion[];
  summary: string;
  /** What the college must change. Empty when the verdict is viable. */
  required_changes: string[];
  extraction: ProposalExtraction;
  rubric_version: string;
  model: string;
}

interface RawReview {
  criteria: Array<{ key: string; points: number; reason: string; pages: number[] }>;
  summary: string;
  required_changes: string[];
  funding_required: number | null;
  currency: string | null;
  duration_days: number | null;
  materials: Array<{ item: string; qty: number | null; unit: string | null }>;
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "criteria",
    "summary",
    "required_changes",
    "funding_required",
    "currency",
    "duration_days",
    "materials",
  ],
  properties: {
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "points", "reason", "pages"],
        properties: {
          key: { type: "string", enum: RUBRIC.map((c) => c.key) },
          points: { type: "number" },
          reason: { type: "string" },
          pages: { type: "array", items: { type: "integer" } },
        },
      },
    },
    summary: { type: "string" },
    required_changes: { type: "array", items: { type: "string" } },
    funding_required: { type: ["number", "null"] },
    currency: { type: ["string", "null"] },
    duration_days: { type: ["integer", "null"] },
    materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "qty", "unit"],
        properties: {
          item: { type: "string" },
          qty: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

const SYSTEM = `You review engineering proposals for JharSetu, a Government of Jharkhand platform where college teams propose solutions to verified community problems.

You are scoring ONE proposal against a fixed rubric. You are NOT comparing it to any other proposal.

Rules you must follow:
- Score each criterion only on the evidence in the document. If the document does not address a criterion, give it a low score and say what is missing.
- Cite the page numbers you read each judgement from. Never cite a page that does not exist in the document.
- Write reasons a final-year engineering student can act on. Name the specific gap, not a grade.
- Be hard on practicality. This will be built in a rural block with unreliable power and no technician on call.
- Extract the funding figure, duration and material list exactly as stated. If a value is not in the document, return null rather than estimating it.
- Never invent a number the document does not contain.`;

export function clampPoints(points: number, max: number): number {
  if (!Number.isFinite(points)) return 0;
  return Math.max(0, Math.min(max, Math.round(points * 10) / 10));
}

function verdictFor(total: number, problemFit: number): ProposalReview["verdict"] {
  // A proposal that does not address this problem is not viable at any total.
  if (problemFit <= 0) return "not_viable";
  if (total < VIABILITY_FLOOR) return "not_viable";
  if (total < NEEDS_CHANGES_CEILING) return "needs_changes";
  return "viable";
}

/**
 * Reviews one proposal. Throws AiUnavailableError when the model is off or
 * unreachable - the caller records that on the row and leaves the proposal
 * unscored rather than guessing a number.
 */
export async function reviewProposal(input: {
  challengeTitle: string;
  challengeProblem: string;
  challengeNeeds: string[];
  challengeDistrict: string;
  documentText: string;
  documentPages: number;
}): Promise<ProposalReview> {
  if (!isAiEnabled()) {
    throw new AiUnavailableError(
      "Proposal review needs the model. AI is switched off on this deployment.",
    );
  }

  const rubricText = RUBRIC.map(
    (c) => `- ${c.key} (max ${c.max}): ${c.label}. ${c.guidance}`,
  ).join("\n");

  const prompt = `THE CHALLENGE
Title: ${input.challengeTitle}
District: ${input.challengeDistrict}
Problem as briefed: ${input.challengeProblem}
Stated needs: ${input.challengeNeeds.length ? input.challengeNeeds.join("; ") : "(none recorded)"}

THE RUBRIC
${rubricText}

THE PROPOSAL DOCUMENT (${input.documentPages} pages; page markers are inline)
${input.documentText.slice(0, 120_000)}

Score every criterion. Cite page numbers between 1 and ${input.documentPages}.`;

  const result = await llmJson<RawReview>({
    task: "proposal-review",
    system: SYSTEM,
    prompt,
    schema: schema as unknown as Record<string, unknown>,
    maxTokens: 3000,
    cache: "off", // a score must be a fresh judgement of this document
  });

  const byKey = new Map(result.value.criteria.map((c) => [c.key, c]));
  const criteria: ProposalScoreCriterion[] = RUBRIC.map((def) => {
    const got = byKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      max: def.max,
      points: clampPoints(got?.points ?? 0, def.max),
      reason: got?.reason?.trim() || "The document does not address this.",
      // Drop any page the document does not have: a citation that cannot be
      // checked is worse than no citation.
      pages: (got?.pages ?? []).filter(
        (p) => Number.isInteger(p) && p >= 1 && p <= input.documentPages,
      ),
    };
  });

  const total = Math.round(criteria.reduce((s, c) => s + c.points, 0) * 10) / 10;
  const problemFit = criteria.find((c) => c.key === "problem_fit")?.points ?? 0;
  const verdict = verdictFor(total, problemFit);

  return {
    total,
    verdict,
    criteria,
    summary: result.value.summary?.trim() || "",
    required_changes:
      verdict === "viable" ? [] : (result.value.required_changes ?? []).filter(Boolean),
    extraction: {
      funding_required:
        typeof result.value.funding_required === "number" ? result.value.funding_required : null,
      currency: result.value.currency?.trim() || "INR",
      duration_days:
        typeof result.value.duration_days === "number" ? result.value.duration_days : null,
      materials: (result.value.materials ?? []).filter((m) => m?.item),
    },
    rubric_version: RUBRIC_VERSION,
    model: result.model,
  };
}

/**
 * Progress stages for the winning proposal, named after what it actually does.
 * A generic 25 / 50 / 75 tracker tells a contributor nothing.
 */
export interface GeneratedStage {
  seq: number;
  title: string;
  definition_of_done: string;
  expected_days: number;
  needs_material: string | null;
}

const stageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["stages"],
  properties: {
    stages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "definition_of_done", "expected_days", "needs_material"],
        properties: {
          title: { type: "string" },
          definition_of_done: { type: "string" },
          expected_days: { type: "integer" },
          needs_material: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export async function generateStages(input: {
  challengeTitle: string;
  documentText: string;
  durationDays: number | null;
  materials: string[];
}): Promise<{ stages: GeneratedStage[]; model: string }> {
  if (!isAiEnabled()) {
    throw new AiUnavailableError("Stage generation needs the model.");
  }

  const result = await llmJson<{ stages: Omit<GeneratedStage, "seq">[] }>({
    task: "proposal-stages",
    system: `You turn an approved engineering proposal into a delivery plan that a village coordinator, a funding company and a system owner all read from the same screen.

Rules:
- Between 4 and 8 stages, in the order the work actually happens.
- Name each stage after what this proposal does. Never "Phase 1" or "50% complete".
- definition_of_done must be one sentence somebody could photograph as proof.
- expected_days should sum to roughly the proposal's stated duration.
- needs_material names the material this stage is blocked without, from the list given, or null.`,
    prompt: `PROPOSAL FOR: ${input.challengeTitle}
Stated duration: ${input.durationDays ?? "not stated"} days
Materials required: ${input.materials.length ? input.materials.join("; ") : "(none listed)"}

DOCUMENT
${input.documentText.slice(0, 60_000)}`,
    schema: stageSchema as unknown as Record<string, unknown>,
    maxTokens: 1600,
    cache: "off",
  });

  const stages = (result.value.stages ?? []).slice(0, 8).map((s, i) => ({
    seq: i + 1,
    title: s.title?.trim() || `Stage ${i + 1}`,
    definition_of_done: s.definition_of_done?.trim() || "",
    expected_days: Number.isFinite(s.expected_days) ? Math.max(1, s.expected_days) : 7,
    needs_material: s.needs_material?.trim() || null,
  }));

  return { stages, model: result.model };
}
