import { ok, route, readJson } from "@/lib/http";
import { approveBriefSchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { transition } from "@/lib/services/lifecycle";
import { rescoreChallenge } from "@/lib/services/scoring";
import { appendLedger } from "@/lib/services/ledger";
import type { ChallengeStatus } from "@/lib/domain/types";

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

    // Every new report arrives as REFINED, so that is the usual starting point.
    // Approving walks it through verification and opens it to partners in one go.
    const path: ChallengeStatus[] =
      current?.status === "REPORTED"
        ? ["REFINED", "VERIFIED", "OPEN"]
        : current?.status === "REFINED"
          ? ["VERIFIED", "OPEN"]
          : current?.status === "VERIFIED"
            ? ["OPEN"]
            : [];

    for (const [i, to] of path.entries()) {
      const result = await transition(supabase, {
        challengeId: id,
        to,
        actorId: actor.id,
        actorRole: actor.role,
        reason: i === 0 ? body.note : undefined,
        patch: i === 0 ? patch : undefined,
      });
      if (i === 0) fromStatus = result.from;
      toStatus = result.to;
    }

    if (path.includes("VERIFIED")) {
      // The approval is a verification in its own right, recorded as the coordinator's.
      await supabase.from("verifications").insert({
        challenge_id: id,
        by_user: actor.id,
        kind: "field",
        method: "coordinator",
        note: body.note ?? "Approved by a district coordinator.",
      });
    } else if (!path.length && Object.keys(patch).length > 0) {
      // Already OPEN or further along: apply any coordinator overrides directly.
      await supabase.from("challenges").update(patch).eq("id", id);
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
