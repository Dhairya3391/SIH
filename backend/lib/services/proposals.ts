import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reviewProposal, generateStages, RUBRIC_VERSION } from "@/lib/ai/proposal-review";
import { AiUnavailableError } from "@/lib/ai/llm";

/**
 * The proposal competition.
 *
 * A college uploads a PDF. The first upload opens a window whose length comes
 * from the challenge's severity - a problem the platform itself calls
 * "immediate threat to life" cannot sit open for ten days waiting for a better
 * document. Each proposal is scored independently against a fixed rubric, the
 * highest viable score leads, and a displaced college is told with its own
 * breakdown and the score it now has to beat. When the window closes the
 * leader is awarded and progress stages are generated from its document.
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
}

/**
 * Records a submission and opens the window if this is the first. Scoring is
 * deliberately NOT done here: a college uploading a twenty-page PDF must not
 * wait on a model call, and the scoring job is idempotent so a crash mid-score
 * is recoverable.
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
  const win = await getWindow(supabase, input.challengeId);
  if (win && win.state !== "open") {
    throw new Error(
      `Proposals for this challenge closed on ${new Date(win.closes_at).toLocaleDateString("en-IN")}.`,
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
  return { proposal_id: data.id as string, version: data.version as number, window };
}

export interface ScoreOutcome {
  proposal_id: string;
  scored: boolean;
  total: number | null;
  verdict: string | null;
  leaderChanged: boolean;
  displaced: { org_id: string; proposal_id: string; score: number | null } | null;
  error: string | null;
}

/**
 * Scores one submitted proposal. Claims the row first so two overlapping cron
 * runs cannot both score it - a double score would write two different numbers
 * for the same document.
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
    .select("id, challenge_id, org_id, extracted_text, document_pages")
    .maybeSingle();
  assertSchema(claimError);
  if (claimError) throw claimError;
  if (!claimed) {
    return {
      proposal_id: proposalId,
      scored: false,
      total: null,
      verdict: null,
      leaderChanged: false,
      displaced: null,
      error: "already claimed or not in submitted state",
    };
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("title, district, brief")
    .eq("id", claimed.challenge_id)
    .single();

  const brief = (challenge?.brief ?? {}) as { problem?: string; needs?: string[] };

  // Who was leading before this score landed, so we know whom to notify.
  const before = await getWindow(supabase, claimed.challenge_id as string);

  try {
    const review = await reviewProposal({
      challengeTitle: challenge?.title ?? "Untitled challenge",
      challengeProblem: brief.problem ?? "",
      challengeNeeds: Array.isArray(brief.needs) ? brief.needs : [],
      challengeDistrict: challenge?.district ?? "",
      documentText: (claimed.extracted_text as string) ?? "",
      documentPages: (claimed.document_pages as number) ?? 1,
    });

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
        },
        ai_model: review.model,
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
      const { data: changed, error: refreshError } = await supabase.rpc(
        "refresh_proposal_leader",
        { p_challenge: claimed.challenge_id },
      );
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
      if (old && old.id !== proposalId) {
        displaced = {
          org_id: old.org_id as string,
          proposal_id: old.id as string,
          score: (old.ai_score as number) ?? null,
        };
      }
    }

    return {
      proposal_id: proposalId,
      scored: true,
      total: review.total,
      verdict: review.verdict,
      leaderChanged,
      displaced,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "scoring failed";
    // Hand it back for a retry rather than leaving it stuck in "scoring", and
    // never write a guessed score.
    await supabase
      .from("proposals")
      .update({
        state: "submitted",
        ai_error: message,
      })
      .eq("id", proposalId);

    if (err instanceof AiUnavailableError || err instanceof SchemaNotReadyError) throw err;
    return {
      proposal_id: proposalId,
      scored: false,
      total: null,
      verdict: null,
      leaderChanged: false,
      displaced: null,
      error: message,
    };
  }
}

export interface AwardOutcome {
  challenge_id: string;
  outcome: "awarded" | "reopened";
  winner_proposal_id: string | null;
  winner_org_id: string | null;
  stages_created: number;
  lapsed: number;
}

/**
 * Closes a window whose time is up. Awards the leader, marks the rest lapsed,
 * and generates the delivery plan from the winning document.
 *
 * With no viable proposal the window reopens rather than awarding something
 * the model rejected.
 */
export async function closeWindow(
  supabase: SupabaseClient,
  challengeId: string,
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
      lapsed: 0,
    };
  }

  const { data: leaderId, error: leaderError } = await supabase.rpc("proposal_leader", {
    p_challenge: challengeId,
  });
  assertSchema(leaderError);

  if (!leaderId) {
    await supabase
      .from("proposal_windows")
      .update({
        state: "reopened",
        closed_at: new Date().toISOString(),
        reopen_count: win.reopen_count + 1,
        leader_proposal_id: null,
        leader_score: null,
      })
      .eq("challenge_id", challengeId);
    return {
      challenge_id: challengeId,
      outcome: "reopened",
      winner_proposal_id: null,
      winner_org_id: null,
      stages_created: 0,
      lapsed: 0,
    };
  }

  const { data: winner } = await supabase
    .from("proposals")
    .select("id, org_id, extracted_text, duration_days, ai_rubric")
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
    .update({
      state: "awarded",
      closed_at: new Date().toISOString(),
      awarded_proposal_id: leaderId,
    })
    .eq("challenge_id", challengeId);

  await supabase.from("proposal_leader_history").insert({
    challenge_id: challengeId,
    to_proposal_id: leaderId,
    to_score: (winner?.ai_rubric as { total?: number } | null)?.total ?? null,
    reason: "window_awarded",
  });

  await supabase
    .from("challenges")
    .update({ status: "SOLUTION_PROPOSED" })
    .eq("id", challengeId);

  // The delivery plan. A failure here must not undo the award - the college is
  // the winner either way, and the stages can be generated again.
  let stagesCreated = 0;
  try {
    const materials =
      ((winner?.ai_rubric as { extraction?: { materials?: { item: string }[] } } | null)
        ?.extraction?.materials ?? []).map((m) => m.item);
    const { stages } = await generateStages({
      challengeTitle: challengeId,
      documentText: (winner?.extracted_text as string) ?? "",
      durationDays: (winner?.duration_days as number) ?? null,
      materials,
    });
    if (stages.length > 0) {
      const rows = stages.map((s) => ({
        proposal_id: leaderId,
        challenge_id: challengeId,
        seq: s.seq,
        title: s.title,
        definition_of_done: s.definition_of_done,
        expected_days: s.expected_days,
        ai_generated: true,
      }));
      const { error: stageError } = await supabase.from("progress_stages").insert(rows);
      if (!stageError) stagesCreated = rows.length;
    }
  } catch {
    // Leave the stages for the college to request again.
  }

  return {
    challenge_id: challengeId,
    outcome: "awarded",
    winner_proposal_id: leaderId as string,
    winner_org_id: (winner?.org_id as string) ?? null,
    stages_created: stagesCreated,
    lapsed,
  };
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
