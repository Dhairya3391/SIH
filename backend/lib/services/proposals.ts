import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  reviewProposal,
  generateStages,
  RUBRIC_VERSION,
  type GeneratedStage,
  type ProposalReview,
} from "@/lib/ai/proposal-review";
import { reviewProposalWithRules, generateStagesWithRules } from "@/lib/ai/proposal-rules";
import { appendLedger } from "./ledger";
import { notifyOrgs } from "./notify";

/**
 * The proposal competition.
 *
 * A college uploads a PDF. The first upload opens a window whose length comes
 * from the challenge's severity - a problem the platform itself calls
 * "immediate threat to life" cannot sit open for ten days waiting for a better
 * document. Each proposal is analysed independently against a fixed rubric
 * the moment it arrives; a proposal that is not viable is rejected with the
 * reasons, and the college may send a new version. The highest viable score
 * leads, a displaced college is told the score it now has to beat, and when
 * the window closes the leader is awarded and delivery stages are drawn from
 * its document.
 *
 * Two invariants hold this together and both are enforced in SQL, not here:
 *   - the leader is deterministic (score, then earliest submission, then id)
 *   - a score is written once and never recomputed on read
 */

export class SchemaNotReadyError extends Error {
  constructor(public detail: string) {
    super(
      "The proposal competition tables are not in this database yet. Apply backend/supabase/migrations/0010_proposal_competition.sql.",
    );
    this.name = "SchemaNotReadyError";
  }
}

/** Postgres says 42P01 for a missing table and 42703 for a missing column. */
function assertSchema(error: { code?: string; message?: string } | null): void {
  if (!error) return;
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205") {
    throw new SchemaNotReadyError(error.message ?? error.code ?? "unknown");
  }
}

export interface WindowState {
  challenge_id: string;
  opened_at: string;
  window_days: number;
  closes_at: string;
  state: "open" | "closed" | "awarded" | "reopened";
  leader_proposal_id: string | null;
  leader_score: number | null;
  leader_changed_at: string | null;
  awarded_proposal_id: string | null;
  closed_at: string | null;
  reopen_count: number;
}

/** Opens the window on the first proposal, or returns the existing one. */
export async function openWindow(
  supabase: SupabaseClient,
  challengeId: string,
): Promise<WindowState> {
  const { data, error } = await supabase.rpc("open_proposal_window", {
    p_challenge: challengeId,
  });
  assertSchema(error);
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as WindowState;
}

export async function getWindow(
  supabase: SupabaseClient,
  challengeId: string,
): Promise<WindowState | null> {
  const { data, error } = await supabase
    .from("proposal_windows")
    .select("*")
    .eq("challenge_id", challengeId)
    .maybeSingle();
  assertSchema(error);
  if (error) throw error;
  return (data as WindowState) ?? null;
}

export interface SubmitResult {
  proposal_id: string;
  version: number;
  window: WindowState;
  /** This submission opened the window. */
  first_in_window: boolean;
}

/**
 * Records a submission and opens the window if this is the first. Scoring is
 * started by the caller after the response, so a college uploading a twenty-page
 * PDF does not wait on the analysis.
 */
export async function submitProposal(
  supabase: SupabaseClient,
  input: {
    challengeId: string;
    orgId: string;
    authorId: string | null;
    documentPath: string;
    documentName: string;
    documentPages: number;
    extractedText: string;
  },
): Promise<SubmitResult> {
  let win = await getWindow(supabase, input.challengeId);

  if (win && win.state === "reopened") {
    // Nothing viable arrived last time. A new submission starts a fresh period.
    const now = new Date();
    const { data: reopened, error: reopenError } = await supabase
      .from("proposal_windows")
      .update({
        state: "open",
        opened_at: now.toISOString(),
        closes_at: new Date(now.getTime() + win.window_days * 86_400_000).toISOString(),
        closed_at: null,
        leader_proposal_id: null,
        leader_score: null,
      })
      .eq("challenge_id", input.challengeId)
      .eq("state", "reopened")
      .select("*")
      .maybeSingle();
    assertSchema(reopenError);
    if (reopened) win = reopened as WindowState;
  }

  if (win && win.state !== "open") {
    throw new Error(
      `Proposals for this challenge closed on ${new Date(win.closed_at ?? win.closes_at).toLocaleDateString("en-IN")} and the work was awarded.`,
    );
  }

  const { data: prior, error: priorError } = await supabase
    .from("proposals")
    .select("version")
    .eq("challenge_id", input.challengeId)
    .eq("org_id", input.orgId)
    .order("version", { ascending: false })
    .limit(1);
  assertSchema(priorError);
  const version = (prior?.[0]?.version ?? 0) + 1;

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      challenge_id: input.challengeId,
      org_id: input.orgId,
      author_id: input.authorId,
      version,
      document_path: input.documentPath,
      document_name: input.documentName,
      document_pages: input.documentPages,
      extracted_text: input.extractedText,
      state: "submitted",
      ai_rubric_version: RUBRIC_VERSION,
    })
    .select("id, version")
    .single();
  assertSchema(error);
  if (error) throw error;

  const window = await openWindow(supabase, input.challengeId);
  return {
    proposal_id: data.id as string,
    version: data.version as number,
    window,
    first_in_window: !win,
  };
}

export interface ScoreOutcome {
  proposal_id: string;
  challenge_id: string | null;
  org_id: string | null;
  scored: boolean;
  total: number | null;
  verdict: string | null;
  source: "ai" | "rules" | null;
  required_changes: string[];
  leaderChanged: boolean;
  displaced: { org_id: string; proposal_id: string; score: number | null } | null;
  error: string | null;
}

/**
 * Scores one submitted proposal. Claims the row first so two overlapping runs
 * cannot both score it - a double score would write two different numbers for
 * the same document.
 *
 * The model reviews it when one is available. When it is not - no key, a
 * provider outage, an unusable answer - the same rubric is applied by rules
 * and the verdict says so. A proposal is never left unanalysed.
 */
export async function scoreProposal(
  supabase: SupabaseClient,
  proposalId: string,
): Promise<ScoreOutcome> {
  const { data: claimed, error: claimError } = await supabase
    .from("proposals")
    .update({ state: "scoring" })
    .eq("id", proposalId)
    .eq("state", "submitted")
    .select("id, challenge_id, org_id, extracted_text, document_pages, version")
    .maybeSingle();
  assertSchema(claimError);
  if (claimError) throw claimError;

  const empty: ScoreOutcome = {
    proposal_id: proposalId,
    challenge_id: null,
    org_id: null,
    scored: false,
    total: null,
    verdict: null,
    source: null,
    required_changes: [],
    leaderChanged: false,
    displaced: null,
    error: null,
  };
  if (!claimed) return { ...empty, error: "already claimed or not in submitted state" };

  try {
    const { data: challenge } = await supabase
      .from("challenges")
      .select("ref, title, district, brief, region_id")
      .eq("id", claimed.challenge_id)
      .single();
    const brief = (challenge?.brief ?? {}) as { problem?: string; needs?: string[] };

    const reviewInput = {
      challengeTitle: (challenge?.title as string) ?? "Untitled challenge",
      challengeProblem: brief.problem ?? "",
      challengeNeeds: Array.isArray(brief.needs) ? brief.needs : [],
      challengeDistrict: (challenge?.district as string) ?? "",
      documentText: (claimed.extracted_text as string) ?? "",
      documentPages: (claimed.document_pages as number) ?? 1,
    };

    // Who was leading before this score landed, so we know whom to tell.
    const before = await getWindow(supabase, claimed.challenge_id as string);

    let review: ProposalReview;
    let source: "ai" | "rules" = "ai";
    let fallbackReason: string | null = null;
    try {
      review = await reviewProposal(reviewInput);
    } catch (err) {
      source = "rules";
      fallbackReason = err instanceof Error ? err.message : "the AI reviewer was unavailable";
      review = reviewProposalWithRules(reviewInput);
    }

    const { error: writeError } = await supabase
      .from("proposals")
      .update({
        state: review.verdict === "not_viable" ? "rejected_not_viable" : "scored",
        ai_score: review.total,
        ai_verdict: review.verdict,
        ai_rubric: {
          total: review.total,
          criteria: review.criteria,
          summary: review.summary,
          required_changes: review.required_changes,
          // Kept so the college's requirements can be pre-filled from its own document.
          extraction: review.extraction,
          source,
          fallback_reason: fallbackReason,
        },
        ai_model: source === "ai" ? review.model : "rule-based rubric (AI unavailable)",
        ai_rubric_version: review.rubric_version,
        ai_error: null,
        scored_at: new Date().toISOString(),
        funding_required: review.extraction.funding_required,
        currency: review.extraction.currency,
        duration_days: review.extraction.duration_days,
      })
      .eq("id", proposalId);
    assertSchema(writeError);
    if (writeError) throw writeError;

    // Only a viable proposal can lead. A rejected one must never become the
    // leader by being the only submission.
    let leaderChanged = false;
    if (review.verdict === "viable") {
      const { data: changed, error: refreshError } = await supabase.rpc("refresh_proposal_leader", {
        p_challenge: claimed.challenge_id,
      });
      assertSchema(refreshError);
      leaderChanged = Boolean(changed);
    }

    let displaced: ScoreOutcome["displaced"] = null;
    if (leaderChanged && before?.leader_proposal_id) {
      const { data: old } = await supabase
        .from("proposals")
        .select("id, org_id, ai_score")
        .eq("id", before.leader_proposal_id)
        .maybeSingle();
      if (old && old.id !== proposalId && old.org_id !== claimed.org_id) {
        displaced = {
          org_id: old.org_id as string,
          proposal_id: old.id as string,
          score: (old.ai_score as number) ?? null,
        };
      }
    }

    await appendLedger(supabase, {
      entity: "challenge",
      entityId: claimed.challenge_id as string,
      action: "proposal_scored",
      regionId: (challenge?.region_id as string) ?? null,
      payload: {
        proposal_id: proposalId,
        org_id: claimed.org_id,
        version: claimed.version,
        score: review.total,
        verdict: review.verdict,
        source,
        leader_changed: leaderChanged,
      },
    });

    return {
      ...empty,
      challenge_id: claimed.challenge_id as string,
      org_id: claimed.org_id as string,
      scored: true,
      total: review.total,
      verdict: review.verdict,
      source,
      required_changes: review.required_changes,
      leaderChanged,
      displaced,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "scoring failed";
    // Hand it back for a retry rather than leaving it stuck in "scoring".
    await supabase.from("proposals").update({ state: "submitted", ai_error: message }).eq("id", proposalId);
    if (err instanceof SchemaNotReadyError) throw err;
    return {
      ...empty,
      challenge_id: claimed.challenge_id as string,
      org_id: claimed.org_id as string,
      error: message,
    };
  }
}

/** Scores, then tells the college its verdict and any displaced college the score to beat. */
export async function scoreAndNotify(
  supabase: SupabaseClient,
  proposalId: string,
): Promise<ScoreOutcome> {
  const outcome = await scoreProposal(supabase, proposalId);
  if (!outcome.scored || !outcome.challenge_id) return outcome;

  const { data: challenge } = await supabase
    .from("challenges")
    .select("ref")
    .eq("id", outcome.challenge_id)
    .maybeSingle();
  const ref = (challenge?.ref as string) ?? "the challenge";

  await notifyOrgs(supabase, {
    orgIds: [outcome.org_id],
    template:
      outcome.verdict === "viable"
        ? "proposal_scored"
        : outcome.verdict === "needs_changes"
          ? "proposal_needs_changes"
          : "proposal_not_viable",
    payload: {
      ref,
      score: outcome.total,
      proposal_id: proposalId,
      challenge_id: outcome.challenge_id,
      reasons: outcome.required_changes.slice(0, 3).join("; ") || "see the verdict page",
    },
  });

  if (outcome.displaced) {
    await notifyOrgs(supabase, {
      orgIds: [outcome.displaced.org_id],
      template: "proposal_displaced",
      payload: {
        ref,
        proposal_id: outcome.displaced.proposal_id,
        challenge_id: outcome.challenge_id,
        your_score: outcome.displaced.score,
        score_to_beat: outcome.total,
      },
    });
  }
  return outcome;
}

export interface AwardOutcome {
  challenge_id: string;
  outcome: "awarded" | "reopened";
  winner_proposal_id: string | null;
  winner_org_id: string | null;
  stages_created: number;
  stages_source: "ai" | "rules" | null;
  lapsed: number;
}

/**
 * Closes a window and awards it: when its time is up, or early from the admin
 * console. Anything still waiting to be scored is scored first, so the award
 * is decided on every submission rather than on whichever ones a job reached.
 *
 * The winner is assigned to the challenge, the rest are told, and delivery
 * stages are drawn from the winning document. With no viable proposal the
 * window reopens rather than awarding something that was rejected.
 */
export async function closeWindow(
  supabase: SupabaseClient,
  challengeId: string,
  opts: { actorId?: string | null; actorRole?: string | null; manual?: boolean } = {},
): Promise<AwardOutcome> {
  const win = await getWindow(supabase, challengeId);
  if (!win) throw new Error("No proposal window for this challenge.");
  if (win.state !== "open") {
    return {
      challenge_id: challengeId,
      outcome: win.state === "reopened" ? "reopened" : "awarded",
      winner_proposal_id: win.awarded_proposal_id,
      winner_org_id: null,
      stages_created: 0,
      stages_source: null,
      lapsed: 0,
    };
  }

  const { data: waiting } = await supabase
    .from("proposals")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("state", "submitted");
  for (const w of waiting ?? []) {
    try {
      await scoreAndNotify(supabase, w.id as string);
    } catch {
      // A proposal that cannot be scored is left out of the award, not guessed at.
    }
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, title, district, region_id, verified_at, team_formed_at")
    .eq("id", challengeId)
    .single();
  const ref = (challenge?.ref as string) ?? "the challenge";
  const now = new Date().toISOString();

  const { data: submitters } = await supabase
    .from("proposals")
    .select("org_id")
    .eq("challenge_id", challengeId);
  const submitterOrgs = [...new Set((submitters ?? []).map((s) => s.org_id as string))];

  const { data: leaderId, error: leaderError } = await supabase.rpc("proposal_leader", {
    p_challenge: challengeId,
  });
  assertSchema(leaderError);

  if (!leaderId) {
    await supabase
      .from("proposal_windows")
      .update({
        state: "reopened",
        closed_at: now,
        reopen_count: win.reopen_count + 1,
        leader_proposal_id: null,
        leader_score: null,
      })
      .eq("challenge_id", challengeId);
    await appendLedger(supabase, {
      entity: "challenge",
      entityId: challengeId,
      action: "window_reopened",
      actor: opts.actorId ?? null,
      actorRole: opts.actorRole ?? null,
      regionId: (challenge?.region_id as string) ?? null,
      payload: { reason: "no viable proposal", manual: Boolean(opts.manual), submissions: submitters?.length ?? 0 },
    });
    await notifyOrgs(supabase, { orgIds: submitterOrgs, template: "window_reopened", payload: { ref, challenge_id: challengeId } });
    return {
      challenge_id: challengeId,
      outcome: "reopened",
      winner_proposal_id: null,
      winner_org_id: null,
      stages_created: 0,
      stages_source: null,
      lapsed: 0,
    };
  }

  const { data: winner } = await supabase
    .from("proposals")
    .select("id, org_id, extracted_text, duration_days, ai_rubric, ai_score")
    .eq("id", leaderId)
    .single();

  await supabase.from("proposals").update({ state: "winner" }).eq("id", leaderId);

  // Everything else that was scored and viable becomes a runner-up; the rest lapse.
  const { data: others } = await supabase
    .from("proposals")
    .select("id, ai_verdict")
    .eq("challenge_id", challengeId)
    .neq("id", leaderId)
    .in("state", ["scored", "submitted", "scoring"]);

  let lapsed = 0;
  for (const o of others ?? []) {
    await supabase
      .from("proposals")
      .update({ state: o.ai_verdict === "viable" ? "runner_up" : "lapsed" })
      .eq("id", o.id);
    lapsed += 1;
  }

  await supabase
    .from("proposal_windows")
    .update({ state: "awarded", closed_at: now, awarded_proposal_id: leaderId })
    .eq("challenge_id", challengeId);

  await supabase.from("proposal_leader_history").insert({
    challenge_id: challengeId,
    to_proposal_id: leaderId,
    to_score: (winner?.ai_score as number) ?? null,
    reason: "window_awarded",
  });

  // The college is now the team on this challenge.
  await supabase
    .from("challenges")
    .update({ status: "SOLUTION_PROPOSED", team_formed_at: challenge?.team_formed_at ?? now })
    .eq("id", challengeId);
  await supabase
    .from("assignments")
    .upsert(
      { challenge_id: challengeId, org_id: winner?.org_id, role: "builder", accepted_at: now, released_at: null },
      { onConflict: "challenge_id,org_id,role" },
    );

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: challengeId,
    action: "window_awarded",
    actor: opts.actorId ?? null,
    actorRole: opts.actorRole ?? null,
    regionId: (challenge?.region_id as string) ?? null,
    payload: {
      proposal_id: leaderId,
      org_id: winner?.org_id,
      score: winner?.ai_score,
      manual: Boolean(opts.manual),
      scheduled_close: win.closes_at,
      runners_up_and_lapsed: lapsed,
    },
  });

  await supabase.rpc("record_timing", {
    p_challenge: challengeId,
    p_stage: "to_first_proposal",
    p_started: challenge?.verified_at ?? win.opened_at,
    p_ended: win.opened_at,
  });
  await supabase.rpc("record_timing", {
    p_challenge: challengeId,
    p_stage: "to_award",
    p_started: win.opened_at,
    p_ended: now,
  });

  // The delivery plan. A failure here must not undo the award - the college is
  // the winner either way, and the rules produce a plan when the model cannot.
  const rubric = (winner?.ai_rubric ?? {}) as { extraction?: { materials?: Array<{ item: string }> } };
  const materials = (rubric.extraction?.materials ?? []).map((m) => m.item).filter(Boolean);
  const documentText = (winner?.extracted_text as string) ?? "";
  const durationDays = (winner?.duration_days as number) ?? null;

  let stages: GeneratedStage[] = [];
  let stagesSource: "ai" | "rules" = "ai";
  try {
    stages = (
      await generateStages({
        challengeTitle: (challenge?.title as string) ?? ref,
        documentText,
        durationDays,
        materials,
      })
    ).stages;
  } catch {
    stages = [];
  }
  if (stages.length < 2) {
    stagesSource = "rules";
    stages = generateStagesWithRules({
      district: (challenge?.district as string) ?? null,
      documentText,
      durationDays,
      materials,
    });
  }

  let stagesCreated = 0;
  const { data: existingStages } = await supabase
    .from("progress_stages")
    .select("id")
    .eq("challenge_id", challengeId)
    .limit(1);
  if (!existingStages?.length && stages.length > 0) {
    let cursor = Date.now();
    const rows = stages.map((s) => {
      const start = new Date(cursor);
      cursor += Math.max(1, s.expected_days) * 86_400_000;
      return {
        proposal_id: leaderId,
        challenge_id: challengeId,
        seq: s.seq,
        title: s.title,
        definition_of_done: s.definition_of_done,
        expected_days: s.expected_days,
        expected_start: start.toISOString(),
        expected_end: new Date(cursor).toISOString(),
        ai_generated: stagesSource === "ai",
      };
    });
    const { error: stageError } = await supabase.from("progress_stages").insert(rows);
    if (!stageError) {
      stagesCreated = rows.length;
      await appendLedger(supabase, {
        entity: "challenge",
        entityId: challengeId,
        action: "stages_generated",
        regionId: (challenge?.region_id as string) ?? null,
        payload: { count: rows.length, source: stagesSource, titles: rows.map((r) => r.title) },
      });
    }
  }

  await notifyOrgs(supabase, {
    orgIds: [winner?.org_id as string],
    template: "proposal_awarded",
    payload: { ref, challenge_id: challengeId, proposal_id: leaderId },
  });
  await notifyOrgs(supabase, {
    orgIds: submitterOrgs.filter((o) => o !== winner?.org_id),
    template: "proposal_not_awarded",
    payload: { ref, challenge_id: challengeId },
  });

  return {
    challenge_id: challengeId,
    outcome: "awarded",
    winner_proposal_id: leaderId as string,
    winner_org_id: (winner?.org_id as string) ?? null,
    stages_created: stagesCreated,
    stages_source: stagesCreated ? stagesSource : null,
    lapsed,
  };
}

/** The awarded proposal for a challenge, or null before an award. */
export async function winningProposal(
  supabase: SupabaseClient,
  challengeId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("proposals")
    .select("*")
    .eq("challenge_id", challengeId)
    .eq("state", "winner")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

/** Windows whose time is up, oldest first. */
export async function dueWindows(
  supabase: SupabaseClient,
  limit = 20,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("proposal_windows")
    .select("challenge_id")
    .eq("state", "open")
    .lte("closes_at", new Date().toISOString())
    .order("closes_at", { ascending: true })
    .limit(limit);
  assertSchema(error);
  if (error) throw error;
  return (data ?? []).map((r) => r.challenge_id as string);
}

/** Proposals waiting to be scored, oldest first. */
export async function pendingProposals(
  supabase: SupabaseClient,
  limit = 5,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("proposals")
    .select("id")
    .eq("state", "submitted")
    .order("submitted_at", { ascending: true })
    .limit(limit);
  assertSchema(error);
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}
