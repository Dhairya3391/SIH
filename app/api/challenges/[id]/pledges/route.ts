import { ok, route, readJson } from "@/lib/http";
import { pledgeSchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { recordPledge, challengeGap } from "@/lib/services/swarm";

/**
 * POST /api/challenges/:id/pledges - Resource Swarm.
 *
 * A partner covers part of what is needed. On stage this is one company
 * pledging 8 of 12 siren units and a second closing the last 4, with the gap
 * bar shrinking live because the portals subscribe to Postgres changes.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireRole("industry", "university", "volunteer", "coordinator", "admin");
    const body = await readJson(request, pledgeSchema);
    const supabase = await supabaseServer();

    const { gap, overPledged } = await recordPledge(supabase, {
      challengeId: id,
      needId: body.need_id,
      orgId: body.org_id,
      actorId: actor.id,
      qty: body.qty,
      kind: body.kind,
      note: body.note,
    });

    return ok(
      {
        pledged: body.qty,
        gap,
        /** Allowed, but flagged: telling a partner "we have enough" is a human call. */
        over_pledged: overPledged,
        fully_pledged: gap.fullyPledged,
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
