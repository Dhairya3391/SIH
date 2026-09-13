import { ok, fail, route, readJson } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendLedger } from "@/lib/services/ledger";
import { notifyReporters } from "@/lib/services/notify";

const schema = z.object({
  reason: z.string().trim().min(15, "The reporter will read this. Say why, properly.").max(2000),
});

/**
 * POST /api/verify/[id]/reject - this report does not describe a real problem.
 *
 * It leaves the queue and never becomes visible to colleges, but it is not
 * deleted: a report rejected today can be corroborated next week, and the
 * reporter is told what was decided and why. An AI verification can be
 * overturned here too - that is the human check on the automatic one.
 */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("verifier", "volunteer", "coordinator", "admin");
  const { id } = await ctx.params;
  const { reason } = await readJson(request, schema);

  const supabase = supabaseAdmin();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, region_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!challenge) return fail(404, "No such challenge.", "not_found");
  // TEAM_FORMED is blocked too: the team holds unreleased assignments, and
  // closing underneath them would strand the organisations without telling
  // them. Release the team first, then reject.
  if (["TEAM_FORMED", "SOLUTION_PROPOSED", "PILOT", "DEPLOYED", "IMPACT_VERIFIED"].includes(challenge.status as string)) {
    return fail(
      409,
      "A team has already formed around this problem, so it can no longer be rejected from the verification desk.",
      "in_delivery",
    );
  }

  const { error } = await supabase.from("verifications").insert({
    challenge_id: id,
    by_user: actor.id,
    kind: "inaccurate",
    method: actor.role === "coordinator" || actor.role === "admin" ? "coordinator" : "field",
    note: reason,
    rejected_reason: reason,
  });
  if (error) throw error;

  const now = new Date().toISOString();
  await supabase
    .from("challenges")
    .update({ status: "CLOSED_NOT_ACTIONABLE", closed_at: now, confidence: "unverified" })
    .eq("id", id);

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: id,
    action: "verification_rejected",
    actor: actor.id,
    actorRole: actor.role,
    regionId: challenge.region_id as string,
    payload: { reason, previous_status: challenge.status },
  });

  const told = await notifyReporters(supabase, id, "closed_not_actionable", {
    ref: challenge.ref,
    reason,
  });

  return ok({
    challenge_id: id,
    ref: challenge.ref,
    status: "CLOSED_NOT_ACTIONABLE",
    reason,
    reporters_told: told,
  });
});
