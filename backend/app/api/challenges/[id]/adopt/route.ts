import { ok, fail, route, readJson } from "@/lib/http";
import { adoptSchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { transition } from "@/lib/services/lifecycle";
import { appendLedger } from "@/lib/services/ledger";

/**
 * POST /api/challenges/:id/adopt - an organisation joins the team.
 *
 * Only a verified organisation may adopt. That rule lives in the row-level
 * security policy as well, so calling the API directly does not get around it.
 * The check here exists to return a sentence a person can act on.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireRole("university", "industry", "volunteer", "coordinator", "admin");
    const body = await readJson(request, adoptSchema);
    const supabase = await supabaseServer();

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, verified")
      .eq("id", body.org_id)
      .maybeSingle();
    if (!org) return fail(404, "No such organisation.", "not_found");
    if (!org.verified) {
      return fail(
        403,
        "That organisation has not been verified by an admin yet, so it cannot adopt challenges or pledge resources.",
        "unverified_org",
      );
    }

    const { error } = await supabase
      .from("assignments")
      .upsert(
        { challenge_id: id, org_id: body.org_id, role: body.role },
        { onConflict: "challenge_id,org_id,role" },
      );
    if (error) throw error;

    await supabase
      .from("matches")
      .update({ status: "accepted" })
      .eq("challenge_id", id)
      .eq("org_id", body.org_id);

    await appendLedger(supabase, {
      entity: "assignment",
      entityId: id,
      action: "adopted",
      actor: actor.id,
      actorRole: actor.role,
      payload: { org_id: body.org_id, org_name: org.name, role: body.role },
    });

    // TEAM_FORMED only becomes legal once somebody has actually adopted, which
    // is now true. If the challenge is already past that stage, leave it alone.
    let status: string | null = null;
    try {
      status = (
        await transition(supabase, {
          challengeId: id,
          to: "TEAM_FORMED",
          actorId: actor.id,
          actorRole: actor.role,
        })
      ).to;
    } catch {
      status = null;
    }

    return ok({ adopted: true, org: org.name, role: body.role, status });
  },
);
