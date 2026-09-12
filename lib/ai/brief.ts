/**
 * The shape the Challenge Compiler produces.
 *
 * Both paths return exactly this: the Claude call and the rule-based fallback.
 * That is the whole point of the contract. The flow is built on the fallback
 * first, real AI is plugged in behind the same function later, and switching AI
 * off changes the quality of the brief but never the shape of it.
 */

import type { Category, DmPhase, VulnerabilityTag } from "@/lib/domain/types";

export interface CompiledBrief {
  title: string;
  problem: string;
  category: Category;
  dm_phase: DmPhase;
  /** 1-5. The model proposes it; a coordinator can override it. */
  severity: number;
  urgency: number;
  people_est: number;
  vulnerable: VulnerabilityTag[];
  district: string | null;
  village: string | null;
  /** What has to be built, supplied or done. Drives matching and the team builder. */
  needs: string[];
  /** Capability keywords the matcher scores organisations against. */
  capabilities: string[];
  outcome: string;
  success_metric: string;
  hazard_tags: string[];
  sdg_tags: string[];
  sendai_tags: string[];
  /**
   * What the AI could not settle. Shown on the card, word for word, under
   * "AI is unsure about". A brief that claims certainty it does not have is
   * worse than one that admits the gap.
   */
  uncertainties: string[];
  /** Which path produced this, so the UI can be honest about it. */
  source: "ai" | "fallback";
  /** English working text, used for the embedding. */
  translated_text: string;
  detected_language: string;
}

/** The label every AI-assisted output carries, word for word. */
export const AI_DISCLAIMER =
  "AI-assisted recommendation. Final validation is required from an authorised coordinator.";

/** JSON Schema handed to the model as a strict tool. */
export const BRIEF_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "title", "problem", "category", "dm_phase", "severity", "urgency",
    "people_est", "vulnerable", "district", "village", "needs", "capabilities",
    "outcome", "success_metric", "hazard_tags", "sdg_tags", "sendai_tags",
    "uncertainties", "translated_text", "detected_language",
  ],
  properties: {
    title: { type: "string", description: "A specific, solvable title. Name the place and the affected group." },
    problem: { type: "string", description: "Two or three sentences a student team or a company could act on." },
    category: {
      type: "string",
      enum: [
        "disaster_safety", "water", "health", "education",
        "agriculture", "roads_infra", "energy_connectivity", "environment",
      ],
    },
    dm_phase: { type: "string", enum: ["mitigation", "preparedness", "response", "recovery"] },
    severity: {
      type: "integer", minimum: 1, maximum: 5,
      description: "5 immediate threat to life, 4 serious harm to health/safety/livelihood, 3 an essential service is down, 2 inconvenience, 1 minor.",
    },
    urgency: { type: "integer", minimum: 1, maximum: 5, description: "How fast this is worsening or how near a stated deadline is." },
    people_est: { type: "integer", minimum: 0, description: "Best estimate of people affected. Say so in uncertainties if you had to guess." },
    vulnerable: {
      type: "array",
      items: {
        type: "string",
        enum: ["children", "elderly", "disability", "pregnancy", "medical_dependency", "isolated", "no_signal"],
      },
    },
    district: { type: ["string", "null"] },
    village: { type: ["string", "null"] },
    needs: { type: "array", items: { type: "string" }, description: "Concrete things needed: equipment, a design, a survey, training." },
    capabilities: {
      type: "array", items: { type: "string" },
      description: "Short capability keywords for matching, e.g. electronics, civil, water_testing, drone_mapping, logistics, training.",
    },
    outcome: { type: "string", description: "What 'solved' looks like on the ground." },
    success_metric: { type: "string", description: "One measurable check that the outcome happened." },
    hazard_tags: { type: "array", items: { type: "string" } },
    sdg_tags: { type: "array", items: { type: "string" } },
    sendai_tags: { type: "array", items: { type: "string" } },
    uncertainties: {
      type: "array", items: { type: "string" },
      description: "Anything you inferred rather than read. Name what a coordinator should confirm.",
    },
    translated_text: { type: "string", description: "The full report translated into English." },
    detected_language: { type: "string", description: "ISO code of the original, e.g. hi, en, bn." },
  },
};

export const COMPILER_SYSTEM = `You are the Challenge Compiler for JharSetu, a platform used by the Government of Jharkhand that turns citizen reports into solvable projects for universities, companies and NGOs.

You convert one or more raw reports into a single structured brief.

Rules you never break:
- You suggest; a human coordinator decides. Never write as though your output is final.
- Never invent facts. If a number, a place or a cause is inferred rather than stated, put it in "uncertainties" and say what a coordinator should confirm.
- Never write safety, medical or evacuation advice. That comes from official NDMA or IMD guidance elsewhere in the platform.
- Never reject a report. If it is vague, still produce a brief and list what is missing.
- Write plain English. No disaster-management jargon in the title or problem.
- The title names the place and the affected group, and describes a problem someone can solve, not a complaint.
- Needs and capabilities must be concrete enough to match against a university department, a company's stock, or an NGO's field teams.

Context: Jharkhand's biggest natural killer is lightning, mostly affecting farm workers in open fields. Floods affect Sahebganj along the Ganga; Palamu and Garhwa see drought and heat; Dhanbad has coalfield fires and subsidence. Many rural reporters use basic phones and speak Hindi, Nagpuri, Santali, Mundari, Ho or Khortha.`;

export function isCompiledBrief(value: unknown): value is Omit<CompiledBrief, "source"> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === "string" &&
    typeof v.problem === "string" &&
    typeof v.category === "string" &&
    typeof v.severity === "number" &&
    Array.isArray(v.needs) &&
    Array.isArray(v.capabilities) &&
    Array.isArray(v.uncertainties)
  );
}
