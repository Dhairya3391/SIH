/**
 * Shared domain vocabulary. These mirror the Postgres enums in
 * supabase/migrations/0002_enums.sql exactly; if one changes, change both.
 */

export const USER_ROLES = [
  "citizen",
  "volunteer",
  // A verifier is a desk role: reviews evidence and AI corroboration. That is
  // a different job from a volunteer, who goes to the village and photographs it.
  "verifier",
  "coordinator",
  "university",
  // Companies supply materials; NGOs fund money. Different consoles, different roles.
  "industry",
  "ngo",
  "admin",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles that contribute to a college's published requirements. */
export const CONTRIBUTOR_ROLES: UserRole[] = ["industry", "ngo"];

export const ORG_TYPES = ["univ", "company", "ngo", "govt", "volunteers"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

/** Eight fixed categories. A sprawling taxonomy is on the "do not build" list. */
export const CATEGORIES = [
  "disaster_safety",
  "water",
  "health",
  "education",
  "agriculture",
  "roads_infra",
  "energy_connectivity",
  "environment",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, { en: string; hi: string; smsCode: string }> = {
  disaster_safety:     { en: "Disaster & safety",      hi: "आपदा एवं सुरक्षा",      smsCode: "D" },
  water:               { en: "Water",                  hi: "पानी",                   smsCode: "W" },
  health:              { en: "Health",                 hi: "स्वास्थ्य",              smsCode: "H" },
  education:           { en: "Education",              hi: "शिक्षा",                 smsCode: "E" },
  agriculture:         { en: "Agriculture",            hi: "कृषि",                   smsCode: "A" },
  roads_infra:         { en: "Roads & infrastructure", hi: "सड़क एवं अवसंरचना",     smsCode: "R" },
  energy_connectivity: { en: "Energy & connectivity",  hi: "बिजली एवं संपर्क",       smsCode: "C" },
  environment:         { en: "Environment",            hi: "पर्यावरण",               smsCode: "N" },
};

export const DM_PHASES = ["mitigation", "preparedness", "response", "recovery"] as const;
export type DmPhase = (typeof DM_PHASES)[number];

/** "Is it real?" - deliberately a different question from "how urgent is it?". */
export const CONFIDENCE_LEVELS = [
  "unverified",
  "community_corroborated",
  // The AI found independent proof (weather, news or web) and cited it. This
  // counts as verified: the problem opens to colleges with its sources attached.
  "externally_corroborated",
  "field_verified",
  "coordinator_approved",
  "resolved_with_evidence",
] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** The rungs a college may build against. Everything below is still being checked. */
export const VERIFIED_CONFIDENCE: ConfidenceLevel[] = [
  "externally_corroborated",
  "field_verified",
  "coordinator_approved",
  "resolved_with_evidence",
];

/** The rungs that still belong on the verifier's desk. */
export const UNVERIFIED_CONFIDENCE: ConfidenceLevel[] = ["unverified", "community_corroborated"];

export const CHALLENGE_STATUSES = [
  "REPORTED",
  "REFINED",
  "VERIFIED",
  "OPEN",
  "TEAM_FORMED",
  "SOLUTION_PROPOSED",
  "PILOT",
  "DEPLOYED",
  "IMPACT_VERIFIED",
  "DUPLICATE",
  "NEEDS_FOLLOW_UP",
  "CLOSED_NOT_ACTIONABLE",
] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

/** Not yet verified by the AI or a person: these sit on the verifier's desk. */
export const AWAITING_VERIFICATION: ChallengeStatus[] = ["REPORTED", "REFINED"];

/** Verified and still open to college proposals. */
export const OPEN_FOR_PROPOSALS: ChallengeStatus[] = ["VERIFIED", "OPEN", "TEAM_FORMED"];

/**
 * Awarded and beyond. A problem here has left the main lists; its funders and
 * its college still track it.
 *   SOLUTION_PROPOSED  a college won; requirements are being funded
 *   PILOT              work is under way
 *   DEPLOYED           every stage is done
 *   IMPACT_VERIFIED    the community confirmed the fix
 */
export const IN_DELIVERY: ChallengeStatus[] = ["SOLUTION_PROPOSED", "PILOT", "DEPLOYED", "NEEDS_FOLLOW_UP"];

export const CLOSED_STATUSES: ChallengeStatus[] = ["IMPACT_VERIFIED", "CLOSED_NOT_ACTIONABLE", "DUPLICATE"];

export const VULNERABILITY_TAGS = [
  "children",
  "elderly",
  "disability",
  "pregnancy",
  "medical_dependency",
  "isolated",
  "no_signal",
] as const;
export type VulnerabilityTag = (typeof VULNERABILITY_TAGS)[number];

/** Single-letter codes used inside a 160-character SMS. */
export const VULNERABILITY_SMS_CODES: Record<VulnerabilityTag, string> = {
  children: "C",
  elderly: "E",
  disability: "D",
  pregnancy: "P",
  medical_dependency: "M",
  isolated: "I",
  no_signal: "N",
};

export const REPORT_CHANNELS = ["web", "sms", "volunteer", "ivr"] as const;
export type ReportChannel = (typeof REPORT_CHANNELS)[number];

export const PLEDGE_KINDS = ["money", "equipment", "people", "expertise"] as const;
export type PledgeKind = (typeof PLEDGE_KINDS)[number];

export type PlatformMode = "peace" | "crisis";

/** Priority bands, used for the map legend and the queue. */
export type PriorityBand = "critical" | "high" | "moderate" | "long_term";

export function priorityBand(priority: number): PriorityBand {
  if (priority >= 75) return "critical";
  if (priority >= 50) return "high";
  if (priority >= 25) return "moderate";
  return "long_term";
}

export const PRIORITY_BAND_LABELS: Record<PriorityBand, string> = {
  critical: "Critical",
  high: "High",
  moderate: "Moderate",
  long_term: "Long-term",
};

export interface LatLng {
  lat: number;
  lng: number;
}

/** Every scored thing explains itself the same way. */
export interface ScoreFactor {
  key: string;
  label: string;
  points: number;
  max: number;
  /** The normalised 0-1 input, kept so the UI can show the working. */
  raw: number;
  reason: string;
}

export interface ScoreBreakdown {
  total: number;
  factors: ScoreFactor[];
  /** Which weight set produced this, so an audited change is traceable. */
  weightsVersion: string;
}
