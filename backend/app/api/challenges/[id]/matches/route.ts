import { ok, route, readQuery } from "@/lib/http";
import { matchesQuerySchema } from "@/lib/validation/schemas";
import { supabaseServer } from "@/lib/supabase/server";
import { computeMatches, nearbyResources } from "@/lib/services/matching";

/**
 * GET /api/challenges/:id/matches - recommended partners, with reasons.
 *
 * Never a bare ranking. Every recommendation carries the reasons that produced
 * it, and a coordinator can override the order; the override is logged.
 */
export const GET = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { limit, refresh } = readQuery(request, matchesQuerySchema);
    const supabase = await supabaseServer();

    if (!refresh) {
      const { data: cached } = await supabase
        .from("matches")
        .select("org_id, score, reasons, status, organizations(name, type, district, verified)")
        .eq("challenge_id", id)
        .order("score", { ascending: false })
        .limit(limit);
      if (cached?.length) {
        return ok({
          matches: cached,
          cached: true,
          nearby: await nearbyResources(supabase, id, 30),
        });
      }
    }

    const matches = await computeMatches(supabase, id, limit);
    return ok({ matches, cached: false, nearby: await nearbyResources(supabase, id, 30) });
  },
);
