import { ok, fail, route, readJson } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  reason: z.string().min(15, "The reporter will read this. Say why, properly.").max(2000),
});

/**
 * POST /api/verify/[id]/reject - this report does not describe a real problem.
 *
 * It leaves the queue and never becomes visible to colleges, but it is not
 * deleted: a report rejected today can be corroborated next week, and the
 * reporter is entitled to know what was decided and why.
 */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("verifier", "volunteer", "coordinator", "admin");
  const { id } = await ctx.params;
  const { reason } = await readJson(request, schema);

  const supabase = supabaseAdmin();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref")
    .eq("id", id)
    .single();
  if (!challenge) return fail(404, "No such challenge.", "not_found");

  const { error } = await supabase.from("verifications").insert({
    challenge_id: id,
    by_user: actor.id,
    kind: "inaccurate",
    method: "field",
    note: reason,
    rejected_reason: reason,
  });
  if (error) throw error;

  await supabase
    .from("challenges")
    .update({ status: "CLOSED_NOT_ACTIONABLE", closed_at: new Date().toISOString() })
    .eq("id", id);

  return ok({ challenge_id: id, ref: challenge.ref, status: "CLOSED_NOT_ACTIONABLE", reason });
});
