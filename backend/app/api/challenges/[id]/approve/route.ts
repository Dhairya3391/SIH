import { ok, route, readJson } from "@/lib/http";
import { approveBriefSchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { transition } from "@/lib/services/lifecycle";
import { rescoreChallenge } from "@/lib/services/scoring";
import { appendLedger } from "@/lib/services/ledger";

/**
 * POST /api/challenges/:id/approve - the coordinator approves the brief.
 *
 * This is the one-click step in the demo, and it is where the human takes over
 * from the model. A coordinator may correct the severity or the category first.
 * The correction is recorded as an override with who made it, so "AI prepares
 * it, a human decides" is a fact in the ledger and not only a line in the pitch.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireRole("coordinator", "admin");
    const body = await readJson(request, approveBriefSchema);
    const supabase = await supabaseServer();

    const patch: Record<string, unknown> = {};
    const overrides: Record<string, unknown> = {};

    if (body.severity != null) {
      patch.severity = body.severity;
      patch.severity_source = "coordinator";
      overrides.severity = body.severity;
    }
    if (body.title) {
      patch.title = body.title;
      overrides.title = body.title;
    }
    if (body.category) {
      patch.category = body.category;
      overrides.category = body.category;
    }
    if (body.dm_phase) {
      patch.dm_phase = body.dm_phase;
      overrides.dm_phase = body.dm_phase;
    }

    if (Object.keys(overrides).length) {
      await appendLedger(supabase, {
        entity: "challenge",
        entityId: id,
        action: "coordinator_override",
        actor: actor.id,
        actorRole: actor.role,
        payload: { overrides, note: body.note },
      });
    }

    const { data: current } = await supabase
      .from("challenges")
      .select("status")
      .eq("id", id)
      .single();

    let fromStatus = current?.status ?? "REPORTED";
    let toStatus = current?.status ?? "OPEN";

    if (current?.status === "REPORTED") {
      const result = await transition(supabase, {
        challengeId: id,
        to: "VERIFIED",
        actorId: actor.id,
        actorRole: actor.role,
        reason: body.note,
        patch,
      });
      fromStatus = result.from;

      // Approving opens it to partners straight away.
      const opened = await transition(supabase, {
        challengeId: id,
        to: "OPEN",
        actorId: actor.id,
        actorRole: actor.role,
      });
      toStatus = opened.to;
    } else if (current?.status === "VERIFIED") {
      const opened = await transition(supabase, {
        challengeId: id,
        to: "OPEN",
        actorId: actor.id,
        actorRole: actor.role,
        reason: body.note,
        patch,
      });
      fromStatus = "VERIFIED";
      toStatus = opened.to;
    } else {
      // Already OPEN or further along: apply any coordinator overrides directly
      if (Object.keys(patch).length > 0) {
        await supabase.from("challenges").update(patch).eq("id", id);
      }
    }

    const scored = await rescoreChallenge(supabase, id);

    return ok({
      from: fromStatus,
      status: toStatus,
      priority: scored.priority,
      confidence: scored.confidence,
      why_critical: scored.whyCritical,
      score_breakdown: scored.breakdown,
      overrides,
    });
  },
);
