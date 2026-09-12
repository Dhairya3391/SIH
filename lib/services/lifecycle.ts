import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canTransition,
  nextActions,
  type LifecycleContext,
} from "@/lib/domain/lifecycle";
import type { ChallengeStatus, UserRole } from "@/lib/domain/types";
import { appendLedger } from "./ledger";
import { rescoreChallenge } from "./scoring";
import { notifyReporter } from "./notify";
import { HttpError } from "@/lib/supabase/server";

/**
 * The lifecycle service: it gathers the real state of a challenge, asks the
 * state machine whether a move is legal, and only then writes.
 *
 * The evidence rule lives here and nowhere else. A challenge cannot be closed
 * with a button; it closes with photos, a beneficiary count and a verifier's
 * sign-off, and this is the code that refuses when any of those is missing.
 */

export async function loadContext(
  supabase: SupabaseClient,
  challengeId: string,
  reason?: string | null,
): Promise<LifecycleContext & { status: ChallengeStatus; regionId: string }> {
  const { data: challenge, error } = await supabase
    .from("challenges")
    .select("id, region_id, status, mode, brief, crisis_id")
    .eq("id", challengeId)
    .single();
  if (error) throw error;

  const [assignments, solutions, evidence, verifications, impact] = await Promise.all([
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", challengeId)
      .is("released_at", null),
    supabase.from("solutions").select("id, status").eq("challenge_id", challengeId),
    supabase
      .from("evidence_files")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", challengeId),
    supabase.from("verifications").select("kind").eq("challenge_id", challengeId),
    supabase
      .from("impact_records")
      .select("people_served, community_confirmed, verified_by")
      .eq("challenge_id", challengeId)
      .maybeSingle(),
  ]);

  const solutionRows = solutions.data ?? [];
  const verificationRows = verifications.data ?? [];

  return {
    status: challenge.status as ChallengeStatus,
    regionId: challenge.region_id,
    crisisMode: challenge.mode === "crisis",
    hasBrief: Boolean(challenge.brief && Object.keys(challenge.brief).length > 0),
    coordinatorApproved: [
      "VERIFIED", "OPEN", "TEAM_FORMED", "SOLUTION_PROPOSED",
      "PILOT", "DEPLOYED", "IMPACT_VERIFIED", "NEEDS_FOLLOW_UP",
    ].includes(challenge.status),
    teamSize: assignments.count ?? 0,
    proposalCount: solutionRows.length,
    hasApprovedPilot: solutionRows.some(
      (s) => s.status === "approved_for_pilot" || s.status === "deployed",
    ),
    evidenceCount: evidence.count ?? 0,
    beneficiaryCount: impact.data?.people_served ?? null,
    hasVerifierSignoff:
      Boolean(impact.data?.verified_by) || verificationRows.some((v) => v.kind === "field"),
    communityConfirmed: Boolean(impact.data?.community_confirmed),
    reason,
  };
}

export interface TransitionInput {
  challengeId: string;
  to: ChallengeStatus;
  actorId: string;
  actorRole: UserRole;
  reason?: string | null;
  /** Extra fields written alongside the status change. */
  patch?: Record<string, unknown>;
}

export async function transition(
  supabase: SupabaseClient,
  input: TransitionInput,
): Promise<{ from: ChallengeStatus; to: ChallengeStatus; action: string; priority: number }> {
  const ctx = await loadContext(supabase, input.challengeId, input.reason);
  const check = canTransition(ctx.status, input.to, input.actorRole, ctx);

  if (!check.allowed) {
    // The whole list, not just the first problem: a coordinator should see
    // everything still missing before closure, not discover them one at a time.
    throw new HttpError(422, check.problems.join(" "), { problems: check.problems });
  }

  const patch: Record<string, unknown> = { status: input.to, ...(input.patch ?? {}) };
  const now = new Date().toISOString();
  if (input.to === "VERIFIED") patch.verified_at = now;
  if (input.to === "TEAM_FORMED") patch.team_formed_at = now;
  if (input.to === "DEPLOYED") patch.deployed_at = now;
  if (input.to === "IMPACT_VERIFIED" || input.to === "CLOSED_NOT_ACTIONABLE") patch.closed_at = now;

  const { error } = await supabase.from("challenges").update(patch).eq("id", input.challengeId);
  if (error) throw error;

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: input.challengeId,
    action: check.action!,
    actor: input.actorId,
    actorRole: input.actorRole,
    regionId: ctx.regionId,
    payload: { from: ctx.status, to: input.to, reason: input.reason ?? undefined },
  });

  const scored = await rescoreChallenge(supabase, input.challengeId);
  await notifyOnTransition(supabase, input.challengeId, input.to, input.reason);

  return { from: ctx.status, to: input.to, action: check.action!, priority: scored.priority };
}

/** What this person could do next, for the single next-action button. */
export async function availableActions(
  supabase: SupabaseClient,
  challengeId: string,
  role: UserRole,
) {
  const ctx = await loadContext(supabase, challengeId);
  return { status: ctx.status, actions: nextActions(ctx.status, role, ctx) };
}

/**
 * Tells everyone who reported this problem what just happened to it, in the
 * language they reported in.
 */
async function notifyOnTransition(
  supabase: SupabaseClient,
  challengeId: string,
  to: ChallengeStatus,
  reason?: string | null,
): Promise<void> {
  const template =
    to === "VERIFIED" ? "brief_approved"
    : to === "TEAM_FORMED" ? "team_formed"
    : to === "PILOT" ? "pilot_approved"
    : to === "DEPLOYED" ? "deployed"
    : to === "CLOSED_NOT_ACTIONABLE" ? "closed_not_actionable"
    : null;
  if (!template) return;

  const { data: challenge } = await supabase
    .from("challenges")
    .select("ref")
    .eq("id", challengeId)
    .single();

  const { data: reporters } = await supabase
    .from("reports")
    .select("reporter_id, phone_hash, lang")
    .eq("cluster_id", challengeId);

  const seen = new Set<string>();
  for (const r of reporters ?? []) {
    const key = r.reporter_id ?? r.phone_hash;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    await notifyReporter(supabase, {
      userId: r.reporter_id,
      phoneHash: r.phone_hash,
      lang: r.lang,
      template,
      payload: { ref: challenge?.ref ?? "your report", reason: reason ?? "" },
    });
  }
}

/**
 * Evidence-based closure. Writes the impact record first, then asks the state
 * machine to move to DEPLOYED, so the requirements are checked against the row
 * that was actually saved rather than against what the caller claimed.
 */
export interface CloseInput {
  challengeId: string;
  actorId: string;
  actorRole: UserRole;
  completionNote: string;
  peopleServed: number;
  vulnerableServed: number;
  remainingNeed?: string;
  followUpHours?: number;
}

export async function closeWithEvidence(supabase: SupabaseClient, input: CloseInput) {
  const { data: challenge, error } = await supabase
    .from("challenges")
    .select("id, region_id, created_at, team_formed_at")
    .eq("id", input.challengeId)
    .single();
  if (error) throw error;

  const { count: evidenceCount } = await supabase
    .from("evidence_files")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", input.challengeId);

  if (!evidenceCount) {
    throw new HttpError(
      422,
      "Closure needs at least one photo or document as evidence. Upload it before marking this deployed.",
    );
  }

  const createdAt = new Date(challenge.created_at).getTime();
  const teamAt = challenge.team_formed_at ? new Date(challenge.team_formed_at).getTime() : null;
  const now = Date.now();

  await supabase.from("impact_records").upsert(
    {
      challenge_id: input.challengeId,
      people_served: input.peopleServed,
      vulnerable_served: input.vulnerableServed,
      time_to_match_min: teamAt ? Math.round((teamAt - createdAt) / 60000) : null,
      time_to_resolution_min: Math.round((now - createdAt) / 60000),
      remaining_need: input.remainingNeed ?? null,
      verified_by: input.actorId,
      follow_up_due: input.followUpHours
        ? new Date(now + input.followUpHours * 3600_000).toISOString()
        : null,
    },
    { onConflict: "challenge_id" },
  );

  const result = await transition(supabase, {
    challengeId: input.challengeId,
    to: "DEPLOYED",
    actorId: input.actorId,
    actorRole: input.actorRole,
    reason: input.completionNote,
  });

  // A follow-up is a real task, not a note: it opens its own state.
  if (input.followUpHours) {
    await supabase
      .from("challenges")
      .update({ status: "NEEDS_FOLLOW_UP" })
      .eq("id", input.challengeId);
    await appendLedger(supabase, {
      entity: "challenge",
      entityId: input.challengeId,
      action: "follow_up_opened",
      actor: input.actorId,
      actorRole: input.actorRole,
      regionId: challenge.region_id,
      payload: { due_in_hours: input.followUpHours, note: input.remainingNeed },
    });
  }

  return result;
}
