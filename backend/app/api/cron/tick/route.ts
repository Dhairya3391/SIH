import { ok, fail, route } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  pendingProposals,
  scoreAndNotify,
  dueWindows,
  closeWindow,
  SchemaNotReadyError,
} from "@/lib/services/proposals";

export const maxDuration = 60;

/**
 * POST /api/cron/tick - the clock the competition needs.
 *
 * Two timed jobs, because separate crons cost separate cold starts and both
 * are short:
 *
 *   1. score any proposal still waiting (and tell the college, and anyone it
 *      displaced from the lead)
 *   2. close any window whose time is up, and award
 *
 * Proposals are normally scored the moment they are submitted and windows are
 * also closed opportunistically when a college console is opened; this is the
 * safety net for the case where nobody opens anything.
 *
 * Every step is idempotent: scoring claims the row before it starts, and
 * closing checks the window is still open. Authenticated by a shared secret
 * rather than a session, because a cron has no user.
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

  // Five at a time keeps the request inside the function timeout.
  for (const id of await pendingProposals(supabase, 5)) {
    try {
      scored.push(await scoreAndNotify(supabase, id));
    } catch (err) {
      scored.push({ proposal_id: id, scored: false, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  for (const challengeId of await dueWindows(supabase, 10)) {
    try {
      awarded.push(await closeWindow(supabase, challengeId));
    } catch (err) {
      awarded.push({ challenge_id: challengeId, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  return {
    scored_count: scored.length,
    awarded_count: awarded.length,
    scored,
    awarded,
    ran_at: new Date().toISOString(),
  };
}

async function handle(request: Request) {
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
}

export const POST = route(handle);

/** GET does the same, because Vercel Cron issues GET requests. */
export const GET = route(handle);
