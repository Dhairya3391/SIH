import { ok, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { challengeTimeline } from "@/lib/services/ledger";

/**
 * GET /api/challenges/:id/timeline - the activity timeline.
 *
 * Read straight from the hash-chained ledger. That is why there is no separate
 * updates table: the timeline and the audit trail are the same rows.
 */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const supabase = await supabaseServer();
    return ok({ entries: await challengeTimeline(supabase, id) });
  },
);
