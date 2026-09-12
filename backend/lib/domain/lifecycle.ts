/**
 * The challenge lifecycle, as a state machine.
 *
 *   REPORTED -> REFINED -> VERIFIED -> OPEN -> TEAM_FORMED
 *            -> SOLUTION_PROPOSED -> PILOT -> DEPLOYED -> IMPACT_VERIFIED
 *
 * REFINED means the Compiler drafted the brief. VERIFIED means a coordinator
 * approved it, so the AI draft always comes before the human check.
 *
 * Crisis fast path: OPEN -> TEAM_FORMED -> DEPLOYED. Delivering drinking water
 * cannot wait for proposals and pilots. The evidence rule still applies.
 *
 * Side paths: DUPLICATE, NEEDS_FOLLOW_UP, and CLOSED_NOT_ACTIONABLE, which only
 * a human can set, with a logged reason, and the reporter is told why.
 * AI never rejects a report.
 */

import type { ChallengeStatus, UserRole } from "./types";

export interface TransitionRule {
  from: ChallengeStatus;
  to: ChallengeStatus;
  /** Roles allowed to make this move. */
  roles: UserRole[];
  /** Human-readable name for the ledger and the timeline. */
  action: string;
  /** Only available while Crisis Mode is on for this challenge. */
  crisisOnly?: boolean;
  /** Checked by requirementsMet() below. */
  requires?: Array<
    | "brief"
    | "coordinator_approval"
    | "team"
    | "proposal"
    | "approved_pilot"
    | "evidence"
    | "beneficiary_count"
    | "verifier_signoff"
    | "community_confirmation"
    | "human_reason"
  >;
}

const STAFF: UserRole[] = ["coordinator", "admin"];
const PARTNER: UserRole[] = ["university", "industry", "volunteer", "coordinator", "admin"];

export const TRANSITIONS: TransitionRule[] = [
  // --- the main path ------------------------------------------------------
  { from: "REPORTED", to: "REFINED", roles: ["coordinator", "admin"], action: "compiled",
    requires: ["brief"] },

  { from: "REFINED", to: "VERIFIED", roles: STAFF, action: "brief_approved",
    requires: ["brief", "coordinator_approval"] },

  { from: "VERIFIED", to: "OPEN", roles: STAFF, action: "opened_for_partners" },

  { from: "OPEN", to: "TEAM_FORMED", roles: PARTNER, action: "team_formed",
    requires: ["team"] },

  { from: "TEAM_FORMED", to: "SOLUTION_PROPOSED", roles: PARTNER, action: "solution_proposed",
    requires: ["proposal"] },

  { from: "SOLUTION_PROPOSED", to: "PILOT", roles: STAFF, action: "pilot_approved",
    requires: ["approved_pilot"] },

  { from: "PILOT", to: "DEPLOYED", roles: STAFF, action: "deployed",
    requires: ["evidence", "beneficiary_count", "verifier_signoff"] },

  { from: "DEPLOYED", to: "IMPACT_VERIFIED", roles: ["citizen", "volunteer", "coordinator", "admin"],
    action: "impact_verified", requires: ["community_confirmation"] },

  // --- crisis fast path ---------------------------------------------------
  // Urgent needs skip proposals and pilots, but not the evidence rule.
  { from: "OPEN", to: "DEPLOYED", roles: STAFF, action: "crisis_deployed", crisisOnly: true,
    requires: ["evidence", "beneficiary_count", "verifier_signoff"] },
  { from: "TEAM_FORMED", to: "DEPLOYED", roles: STAFF, action: "crisis_deployed", crisisOnly: true,
    requires: ["evidence", "beneficiary_count", "verifier_signoff"] },

  // --- side paths ---------------------------------------------------------
  { from: "REPORTED", to: "DUPLICATE", roles: STAFF, action: "merged_as_duplicate" },
  { from: "REFINED",  to: "DUPLICATE", roles: STAFF, action: "merged_as_duplicate" },

  { from: "DEPLOYED", to: "NEEDS_FOLLOW_UP", roles: STAFF, action: "follow_up_opened" },
  { from: "NEEDS_FOLLOW_UP", to: "DEPLOYED", roles: STAFF, action: "follow_up_closed",
    requires: ["evidence"] },

  // Only a human closes something as not actionable, and the reason is logged
  // and sent to the reporter. There is deliberately no AI path into this state.
  { from: "REFINED",  to: "CLOSED_NOT_ACTIONABLE", roles: STAFF, action: "closed_not_actionable",
    requires: ["human_reason"] },
  { from: "VERIFIED", to: "CLOSED_NOT_ACTIONABLE", roles: STAFF, action: "closed_not_actionable",
    requires: ["human_reason"] },
  { from: "OPEN",     to: "CLOSED_NOT_ACTIONABLE", roles: STAFF, action: "closed_not_actionable",
    requires: ["human_reason"] },
];

export interface LifecycleContext {
  crisisMode: boolean;
  hasBrief: boolean;
  coordinatorApproved: boolean;
  teamSize: number;
  proposalCount: number;
  hasApprovedPilot: boolean;
  evidenceCount: number;
  beneficiaryCount: number | null;
  hasVerifierSignoff: boolean;
  communityConfirmed: boolean;
  /** A written reason, required before anything is closed as not actionable. */
  reason?: string | null;
}

export interface TransitionCheck {
  allowed: boolean;
  action?: string;
  /** Every unmet requirement, so the UI can list all of them at once. */
  problems: string[];
}

const REQUIREMENT_MESSAGES: Record<NonNullable<TransitionRule["requires"]>[number], string> = {
  brief: "The Challenge Compiler has not drafted a brief yet.",
  coordinator_approval: "A coordinator has to approve the brief first.",
  team: "No organisation has adopted this challenge yet.",
  proposal: "No team has submitted a proposal yet.",
  approved_pilot: "No proposal has been approved for pilot.",
  evidence: "Closure needs at least one photo or document as evidence.",
  beneficiary_count: "Closure needs a beneficiary count.",
  verifier_signoff: "A field volunteer or coordinator has to confirm the work.",
  community_confirmation: "The community has not confirmed the fix yet.",
  human_reason: "A written reason is required, and it is sent to the reporter.",
};

function requirementMet(
  req: NonNullable<TransitionRule["requires"]>[number],
  ctx: LifecycleContext,
): boolean {
  switch (req) {
    case "brief": return ctx.hasBrief;
    case "coordinator_approval": return ctx.coordinatorApproved;
    case "team": return ctx.teamSize > 0;
    case "proposal": return ctx.proposalCount > 0;
    case "approved_pilot": return ctx.hasApprovedPilot;
    case "evidence": return ctx.evidenceCount > 0;
    case "beneficiary_count": return ctx.beneficiaryCount != null && ctx.beneficiaryCount >= 0;
    case "verifier_signoff": return ctx.hasVerifierSignoff;
    case "community_confirmation": return ctx.communityConfirmed;
    case "human_reason": return !!ctx.reason && ctx.reason.trim().length >= 10;
  }
}

export function canTransition(
  from: ChallengeStatus,
  to: ChallengeStatus,
  role: UserRole,
  ctx: LifecycleContext,
): TransitionCheck {
  const rules = TRANSITIONS.filter((r) => r.from === from && r.to === to);
  if (!rules.length) {
    return { allowed: false, problems: [`${from} cannot move directly to ${to}.`] };
  }

  const problems: string[] = [];
  for (const rule of rules) {
    if (rule.crisisOnly && !ctx.crisisMode) {
      problems.push("That shortcut is only available while Crisis Mode is on for this challenge.");
      continue;
    }
    if (!rule.roles.includes(role)) {
      problems.push(`A ${role} cannot perform "${rule.action}".`);
      continue;
    }
    const unmet = (rule.requires ?? []).filter((r) => !requirementMet(r, ctx));
    if (unmet.length) {
      problems.push(...unmet.map((r) => REQUIREMENT_MESSAGES[r]));
      continue;
    }
    return { allowed: true, action: rule.action, problems: [] };
  }

  return { allowed: false, problems: [...new Set(problems)] };
}

/** What this challenge could legally do next, for the single next-action button. */
export function nextActions(
  from: ChallengeStatus,
  role: UserRole,
  ctx: LifecycleContext,
): Array<{ to: ChallengeStatus; action: string; ready: boolean; problems: string[] }> {
  const seen = new Set<string>();
  const out: Array<{ to: ChallengeStatus; action: string; ready: boolean; problems: string[] }> = [];

  for (const rule of TRANSITIONS.filter((r) => r.from === from)) {
    if (rule.crisisOnly && !ctx.crisisMode) continue;
    if (!rule.roles.includes(role)) continue;
    if (seen.has(rule.to)) continue;
    seen.add(rule.to);
    const check = canTransition(from, rule.to, role, ctx);
    out.push({ to: rule.to, action: rule.action, ready: check.allowed, problems: check.problems });
  }
  return out;
}

/** Ordered stages for the progress bar, excluding the three side paths. */
export const MAIN_PATH: ChallengeStatus[] = [
  "REPORTED",
  "REFINED",
  "VERIFIED",
  "OPEN",
  "TEAM_FORMED",
  "SOLUTION_PROPOSED",
  "PILOT",
  "DEPLOYED",
  "IMPACT_VERIFIED",
];

export const STATUS_LABELS: Record<ChallengeStatus, string> = {
  REPORTED: "Reported",
  REFINED: "Brief drafted",
  VERIFIED: "Coordinator approved",
  OPEN: "Open for partners",
  TEAM_FORMED: "Team formed",
  SOLUTION_PROPOSED: "Solution proposed",
  PILOT: "Pilot approved",
  DEPLOYED: "Deployed",
  IMPACT_VERIFIED: "Impact verified",
  DUPLICATE: "Merged as duplicate",
  NEEDS_FOLLOW_UP: "Needs follow-up",
  CLOSED_NOT_ACTIONABLE: "Closed, not actionable",
};

export function isClosed(status: ChallengeStatus): boolean {
  return status === "IMPACT_VERIFIED" || status === "CLOSED_NOT_ACTIONABLE" || status === "DUPLICATE";
}
