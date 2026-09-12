import { ok, fail, route, readJson } from "@/lib/http";
import { confirmSchema } from "@/lib/validation/schemas";
import { requireActor, supabaseServer } from "@/lib/supabase/server";
import { transition } from "@/lib/services/lifecycle";
import { appendLedger } from "@/lib/services/ledger";

/**
 * POST /api/challenges/:id/confirm - the community has the final say.
 *
 * The person who reported the problem says whether it is actually fixed. A yes
 * moves the challenge to IMPACT_VERIFIED and writes the Impact Ledger entry. A
 * no is not an error and is not buried: it files a `still_exists` signal, which
 * pulls confidence down and puts the challenge back in front of a coordinator.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireActor();
    const body = await readJson(request, confirmSchema);
    const supabase = await supabaseServer();

    // Only somebody who reported this problem, or a coordinator, may sign it off.
    const isStaff = actor.role === "coordinator" || actor.role === "admin";
    if (!isStaff) {
      const { count } = await supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("cluster_id", id)
        .eq("reporter_id", actor.id);
      if (!count) {
        return fail(
          403,
          "Only somebody who reported this problem, or a coordinator, can confirm the fix.",
          "not_a_reporter",
        );
      }
    }

    if (!body.confirmed) {
      await supabase.from("verifications").insert({
        challenge_id: id,
        by_user: actor.id,
        kind: "still_exists",
        note: body.note ?? "The reporter says this is not fixed.",
      });
      await appendLedger(supabase, {
        entity: "challenge",
        entityId: id,
        action: "community_rejected_closure",
        actor: actor.id,
        actorRole: actor.role,
        payload: { note: body.note },
      });
      return ok({
        confirmed: false,
        status: "DEPLOYED",
        message: "Recorded. This goes back to the coordinator as still unresolved.",
      });
    }

    await supabase
      .from("impact_records")
      .update({ community_confirmed: true, community_confirmed_at: new Date().toISOString() })
      .eq("challenge_id", id);

    const moved = await transition(supabase, {
      challengeId: id,
      to: "IMPACT_VERIFIED",
      actorId: actor.id,
      actorRole: actor.role,
      reason: body.note ?? "Confirmed fixed by the community.",
    });

    const { data: ledgerEntry } = await supabase
      .from("ledger")
      .select("id, hash, prev_hash, action, created_at")
      .eq("entity", "challenge")
      .eq("entity_id", id)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    return ok({
      confirmed: true,
      status: moved.to,
      /** The hash that makes this closure tamper-evident. */
      ledger: ledgerEntry,
    });
  },
);
