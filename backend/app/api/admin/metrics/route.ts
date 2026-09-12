import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminMetrics } from "@/lib/services/metrics";
import { opportunisticTick } from "@/lib/services/tick";

/**
 * GET /api/admin/metrics - the system owner's readout.
 *
 * Where every problem sits, the severe ones still open and how many days since
 * each was listed, how many were verified by the AI versus a person, what the
 * AI made of every proposal, money pledged against money received, and the
 * projects whose college has gone quiet. Computed from the record; anything the
 * record cannot answer is null.
 */
export const GET = route(async () => {
  await requireRole("admin");
  const supabase = supabaseAdmin();
  await opportunisticTick(supabase);
  return ok(await adminMetrics(supabase));
});
