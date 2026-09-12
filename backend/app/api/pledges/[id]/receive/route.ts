import { ok, route, readJson } from "@/lib/http";
import { receiveSchema } from "@/lib/validation/schemas";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { receivePledge } from "@/lib/services/swarm";

/**
 * POST /api/pledges/[id]/receive - the college confirms it arrived.
 *
 * Only the college delivering the project (or staff) can. Until this, a
 * pledge is a promise; after it, a fact with a date the funder can see.
 */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("university", "coordinator", "admin");
  const { id } = await ctx.params;
  const body = await readJson(request, receiveSchema);
  return ok(await receivePledge(supabaseAdmin(), actor, id, body));
});
