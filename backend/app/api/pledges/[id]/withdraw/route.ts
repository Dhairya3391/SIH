import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withdrawPledge } from "@/lib/services/swarm";

/** POST /api/pledges/[id]/withdraw - take back an offer that has not been sent yet. */
export const POST = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("industry", "ngo", "admin");
  const { id } = await ctx.params;
  return ok(await withdrawPledge(supabaseAdmin(), actor, id));
});
