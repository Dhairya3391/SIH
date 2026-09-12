import type { NextRequest } from "next/server";
import { ok, fail, route } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { seedDatabase } from "@/lib/seed/run";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/demo/reset - one command restores the seeded state.
 *
 * A non-negotiable from the playbook: between rehearsals, and if anything goes
 * wrong on stage, the demo has to come back to a known state without anybody
 * touching a database console.
 *
 * Guarded by a shared secret, because this deletes everything. It refuses
 * outright unless DEMO_RESET_SECRET is set, so a deployed instance can never be
 * wiped by someone who simply guessed the URL.
 */
export const POST = route(async (request: NextRequest) => {
  const expected = process.env.DEMO_RESET_SECRET;
  if (!expected) {
    return fail(
      403,
      "Demo reset is disabled because DEMO_RESET_SECRET is not set on this deployment.",
      "disabled",
    );
  }

  const provided =
    request.headers.get("x-jharsetu-secret") ??
    new URL(request.url).searchParams.get("secret");
  if (provided !== expected) {
    return fail(401, "Bad or missing reset secret.", "unauthorised");
  }

  const started = Date.now();
  const result = await seedDatabase(supabaseAdmin(), { wipe: true });

  return ok({
    reset: true,
    ms: Date.now() - started,
    ...result,
    note: "Every seeded row is labelled as simulated.",
  });
});
