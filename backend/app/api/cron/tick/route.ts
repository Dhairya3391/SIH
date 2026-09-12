import { ok, fail, route } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  pendingProposals,
  scoreProposal,
  dueWindows,
  closeWindow,
  SchemaNotReadyError,
} from "@/lib/services/proposals";

/**
 * POST /api/cron/tick - the clock the competition needs.
 *
 * One endpoint does the three timed jobs, because three Vercel crons cost
 * three cold starts and they are all short:
 *
 *   1. score any proposal still waiting
 *   2. close any window whose time is up, and award
 *   3. notify colleges displaced from the lead since the last tick
 *
 * Every step is idempotent: scoring claims the row before it starts, and
 * closing checks the window is still open. Crons overlap and retry, and a
 * double award would be unrecoverable mid-demo.
 *
 * Authenticated by a shared secret rather than a session, because a cron has
 * no user. Vercel sends its own Authorization header; a manual run can pass
 * ?secret= instead.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.DEMO_RESET_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function runTick() {
  const supabase = supabaseAdmin();
  const scored: unknown[] = [];
  const awarded: unknown[] = [];
  const notified: unknown[] = [];

  // 1. score what is waiting. Five at a time keeps the request inside the
  //    function timeout even when the model is slow.
  const pending = await pendingProposals(supabase, 5);
  for (const id of pending) {
    try {
      const outcome = await scoreProposal(supabase, id);
      scored.push(outcome);

      // 3. the displaced college is told, with the score it has to beat.
      if (outcome.displaced) {
        const { data: org } = await supabase
          .from("users")
          .select("id")
          .eq("org_id", outcome.displaced.org_id);
        for (const u of org ?? []) {
          await supabase.from("notifications").insert({
            user_id: u.id,
            channel: "app",
            template: "proposal_displaced",
            payload: {
              proposal_id: outcome.displaced.proposal_id,
              your_score: outcome.displaced.score,
              score_to_beat: outcome.total,
            },
          });
          notified.push({ user_id: u.id, reason: "displaced" });
        }
      }
    } catch (err) {
      scored.push({
        proposal_id: id,
        scored: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  // 2. close what is due.
  const due = await dueWindows(supabase, 10);
  for (const challengeId of due) {
    try {
      awarded.push(await closeWindow(supabase, challengeId));
    } catch (err) {
      awarded.push({
        challenge_id: challengeId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return {
    scored_count: scored.length,
    awarded_count: awarded.length,
    notified_count: notified.length,
    scored,
    awarded,
    ran_at: new Date().toISOString(),
  };
}

export const POST = route(async (request: Request) => {
  if (!authorised(request)) {
    return fail(401, "This endpoint is for the scheduler.", "unauthorised");
  }
  try {
    return ok(await runTick());
  } catch (err) {
    if (err instanceof SchemaNotReadyError) {
      return fail(503, err.message, "schema_not_ready", err.detail);
    }
    throw err;
  }
});

/** GET does the same, because Vercel Cron issues GET requests. */
export const GET = route(async (request: Request) => {
  if (!authorised(request)) {
    return fail(401, "This endpoint is for the scheduler.", "unauthorised");
  }
  try {
    return ok(await runTick());
  } catch (err) {
    if (err instanceof SchemaNotReadyError) {
      return fail(503, err.message, "schema_not_ready", err.detail);
    }
    throw err;
  }
});
