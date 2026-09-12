import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { challengeHistory } from "@/lib/services/history";

/**
 * GET /api/admin/challenges/[id]/history - everything that ever happened.
 *
 * One ordered list, every entry carrying its actor, its timestamp and the gap
 * since the previous entry, plus the college's progress-update cadence and
 * every contribution with its pledged, sent and received dates. Accepts a
 * uuid or a ref like C-107. The admin assistant reads the same service.
 */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole("admin");
  const { id } = await ctx.params;
  return ok(await challengeHistory(supabaseAdmin(), id));
});
