import { ok, route, readJson } from "@/lib/http";
import { dispatchSchema } from "@/lib/validation/schemas";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dispatchPledge } from "@/lib/services/swarm";

/**
 * POST /api/pledges/[id]/dispatch - the contributor marks it sent.
 *
 * Materials on a truck, or money transferred. The college is told what is
 * coming and when; it confirms receipt separately.
 */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("industry", "ngo", "admin");
  const { id } = await ctx.params;
  const body = await readJson(request, dispatchSchema);
  return ok(await dispatchPledge(supabaseAdmin(), actor, id, body));
});
