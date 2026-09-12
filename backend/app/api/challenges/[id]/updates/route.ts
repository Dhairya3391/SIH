import { ok, fail, route, readJson } from "@/lib/http";
import { updateSchema, closeNotActionableSchema, transitionSchema } from "@/lib/validation/schemas";
import { requireActor, requireRole, supabaseServer } from "@/lib/supabase/server";
import { transition } from "@/lib/services/lifecycle";
import { appendLedger } from "@/lib/services/ledger";

/**
 * POST /api/challenges/:id/updates - progress notes and milestone changes.
 *
 * Updates are ledger rows, which is why there is no separate updates table: the
 * workspace timeline and the audit trail are the same thing.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireActor();
    const body = await readJson(request, updateSchema);
    const supabase = await supabaseServer();

    if (!body.note && !body.milestone_id) {
      return fail(400, "Send a note, a milestone change, or both.", "validation");
    }

    if (body.milestone_id && body.milestone_status) {
      const { error } = await supabase
        .from("milestones")
        .update({
          status: body.milestone_status,
          completed_at: body.milestone_status === "done" ? new Date().toISOString() : null,
        })
        .eq("id", body.milestone_id)
        .eq("challenge_id", id);
      if (error) throw error;
    }

    await appendLedger(supabase, {
      entity: "challenge",
      entityId: id,
      action: body.milestone_id ? "milestone_updated" : "progress_note",
      actor: actor.id,
      actorRole: actor.role,
      payload: {
        note: body.note,
        milestone_id: body.milestone_id,
        milestone_status: body.milestone_status,
      },
    });

    return ok({ recorded: true }, { status: 201 });
  },
);
