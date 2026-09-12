import { ok, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { verifyChain } from "@/lib/services/ledger";

/**
 * GET /api/ledger/verify - proves the Impact Ledger has not been edited.
 *
 * Walks the chain and recomputes every hash from the previous one. If any row
 * has been altered, its hash no longer matches and this reports where the chain
 * breaks.
 *
 * This is the honest version of the transparency claim: it gives tamper
 * evidence without the build cost of a blockchain, and without pretending to be
 * one. The append-only guarantee is enforced by triggers in Postgres, so even
 * an admin cannot rewrite history.
 */
export const GET = route(async () => {
  const supabase = await supabaseServer();
  const result = await verifyChain(supabase);

  return ok({
    ok: result.ok,
    entries_checked: result.checked,
    broken_at: result.broken_at,
    explanation: result.ok
      ? `All ${result.checked} ledger entries recompute to their stored hashes. Nothing has been altered.`
      : `Entry ${result.broken_at} does not match its recomputed hash. Everything after it is suspect.`,
  });
});
