import { ok, fail, route, readJson } from "@/lib/http";
import { pledgeSchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordPledge, challengeGap } from "@/lib/services/swarm";
import { resolveChallengeId } from "@/lib/services/projects";

/**
 * POST /api/challenges/:id/pledges - contribute part of a published need.
 *
 * A company takes 5 kg of the 10 kg of steel; another takes the other 5 kg.
 * An NGO covers ₹1,00,000 of ₹2,00,000. Capped at what is still open, and
 * the contributor lands in a thread with the college straight away.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireRole("industry", "ngo", "admin");
    const body = await readJson(request, pledgeSchema);
    const supabase = supabaseAdmin();

    // An organisation pledges as itself. Only an admin may name another.
    const orgId = actor.role === "admin" ? (body.org_id ?? actor.orgId) : actor.orgId;
    if (!orgId) {
      return fail(
        403,
        actor.role === "admin"
          ? "Say which organisation this pledge is on behalf of."
          : "This account is not linked to an organisation, so it cannot pledge. An administrator has to attach it.",
        "no_org",
      );
    }

    const challengeId = await resolveChallengeId(supabase, id);
    const result = await recordPledge(supabase, {
      challengeId,
      needId: body.need_id,
      orgId,
      actor,
      qty: body.qty,
      note: body.note,
      expectedDeliveryDate: body.expected_delivery_date ?? null,
    });

    return ok(
      {
        pledge_id: result.pledge_id,
        pledged: body.qty,
        gap: result.gap,
        fully_pledged: result.fully_pledged,
        thread_id: result.thread_id,
      },
      { status: 201 },
    );
  },
);

/** GET /api/challenges/:id/pledges - the current gap, same shape as the POST reply. */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const supabase = await supabaseServer();
    return ok(await challengeGap(supabase, id));
  },
);
