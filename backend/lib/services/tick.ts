import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  pendingProposals,
  scoreAndNotify,
  dueWindows,
  closeWindow,
  SchemaNotReadyError,
} from "./proposals";

/**
 * An opportunistic tick, run inline on the reads that care about it.
 *
 * Vercel's Hobby plan allows one cron a day, which is useless for a window
 * that can be two days long: a college would see "closes in 4 hours" for
 * another twenty. So the timed work also happens whenever somebody looks at a
 * surface that depends on it - which is exactly the moment it matters.
 *
 * Strictly bounded so it can never blow the request budget: one proposal and
 * two windows per call. The daily cron stays as the safety net for the case
 * where nobody opens the console at all.
 *
 * Never throws. A tick that fails must not take down the page that triggered
 * it - the caller is trying to render a list, not run a scheduler.
 */
export async function opportunisticTick(
  supabase: SupabaseClient,
  opts: { maxScores?: number; maxCloses?: number } = {},
): Promise<{ scored: number; awarded: number; skipped: string | null }> {
  const maxScores = opts.maxScores ?? 1;
  const maxCloses = opts.maxCloses ?? 2;
  let scored = 0;
  let awarded = 0;

  try {
    const due = (await dueWindows(supabase, maxCloses)).slice(0, maxCloses);
    for (const challengeId of due) {
      try {
        await closeWindow(supabase, challengeId);
        awarded += 1;
      } catch {
        // leave it for the next tick
      }
    }

    const pending = (await pendingProposals(supabase, maxScores)).slice(0, maxScores);
    for (const id of pending) {
      try {
        await scoreAndNotify(supabase, id);
        scored += 1;
      } catch {
        // the proposal is handed back to 'submitted' by scoreProposal itself
      }
    }
  } catch (err) {
    if (err instanceof SchemaNotReadyError) {
      return { scored, awarded, skipped: "schema_not_ready" };
    }
    return { scored, awarded, skipped: err instanceof Error ? err.message : "unknown" };
  }

  return { scored, awarded, skipped: null };
}
