import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendLedger } from "./ledger";
import { rescoreChallenge } from "./scoring";
import { notifyCapabilityMatch, notifyOrgs } from "./notify";
import { collegeForChallenge, ensureThread } from "./threads";
import type { PledgeKind } from "@/lib/domain/types";
import { HttpError, type Actor } from "@/lib/supabase/server";

/**
 * Resource Swarm: the needs a college publishes, and the partial contributions
 * that close them.
 *
 * No single organisation has to cover everything. A college needs 10 kg of
 * steel and ₹2,00,000; one company sends 5 kg, another the other 5 kg, and two
 * NGOs split the money. Each contribution is then tracked to the end: pledged,
 * sent by the contributor, received by the college - with a date on every step.
 */

export interface GapRow {
  need_id: string;
  item: string;
  unit: string;
  kind: PledgeKind;
  qty_needed: number;
  qty_pledged: number;
  qty_open: number;
  pct_closed: number;
}

export async function challengeGap(
  supabase: SupabaseClient,
  challengeId: string,
): Promise<{ needs: GapRow[]; pctClosed: number; fullyPledged: boolean }> {
  const { data, error } = await supabase.rpc("challenge_gap", { p_challenge: challengeId });
  if (error) throw error;

  const needs = (data ?? []) as GapRow[];
  const totalNeeded = needs.reduce((s, n) => s + Number(n.qty_needed), 0);
  const totalPledged = needs.reduce((s, n) => s + Math.min(Number(n.qty_pledged), Number(n.qty_needed)), 0);
  const pctClosed = totalNeeded === 0 ? 0 : Math.round((totalPledged / totalNeeded) * 100);

  // Per line, not in aggregate: ₹2,00,000 covered does not make up for steel missing.
  const fullyPledged = needs.length > 0 && needs.every((n) => Number(n.qty_open) <= 0);
  return { needs, pctClosed, fullyPledged };
}

/** "₹2,00,000" for money, "5 kg" for everything else. */
export function formatAmount(qty: number, unit: string | null | undefined, kind?: string | null): string {
  if (kind === "money" || unit === "INR") return `₹${Math.round(Number(qty)).toLocaleString("en-IN")}`;
  return `${Number(qty).toLocaleString("en-IN")} ${unit ?? "units"}`;
}

export interface CreateNeedsInput {
  challengeId: string;
  solutionId: string | null;
  actorId: string;
  needs: Array<{
    item: string;
    qty_needed: number;
    unit: string;
    kind: PledgeKind;
    capability?: string;
  }>;
}

/**
 * The coordinator pilot path: turns an approved pilot into resource needs,
 * then alerts every organisation whose capabilities match.
 */
export async function createNeedsAndAlert(
  supabase: SupabaseClient,
  input: CreateNeedsInput,
): Promise<GapRow[]> {
  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id, ref, region_id, district, capabilities")
    .eq("id", input.challengeId)
    .single();
  if (challengeError) throw challengeError;

  const { data: inserted, error } = await supabase
    .from("resource_needs")
    .insert(
      input.needs.map((n) => ({
        challenge_id: input.challengeId,
        solution_id: input.solutionId,
        item: n.item,
        qty_needed: n.qty_needed,
        unit: n.unit,
        kind: n.kind,
        capability: n.capability ?? null,
      })),
    )
    .select("id, item, capability");
  if (error) throw error;

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: input.challengeId,
    action: "needs_published",
    actor: input.actorId,
    regionId: challenge.region_id,
    payload: { solution_id: input.solutionId, needs: input.needs },
  });

  // Capability-match alerts: only to verified organisations, because an
  // unverified account cannot pledge anyway and should not be asked to.
  const capabilities = [
    ...new Set(
      inserted
        .map((n) => n.capability)
        .filter((c): c is string => Boolean(c))
        .concat((challenge.capabilities ?? []) as string[]),
    ),
  ];

  for (const capability of capabilities) {
    const { data: orgs } = await supabase
      .from("org_capabilities")
      .select("org_id, organizations!inner(verified, region_id)")
      .eq("capability", capability)
      .eq("organizations.verified", true)
      .eq("organizations.region_id", challenge.region_id)
      .limit(30);

    const orgIds = [...new Set((orgs ?? []).map((o) => o.org_id as string))];
    if (orgIds.length) {
      await notifyCapabilityMatch(supabase, {
        challengeId: input.challengeId,
        challengeRef: challenge.ref,
        capability,
        orgIds,
      });
    }
  }

  const { needs } = await challengeGap(supabase, input.challengeId);
  return needs;
}

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

const NOT_ACCEPTING = ["DEPLOYED", "IMPACT_VERIFIED", "CLOSED_NOT_ACTIONABLE", "DUPLICATE"];

export interface PledgeInput {
  challengeId: string;
  needId: string;
  orgId: string;
  actor: Actor;
  qty: number;
  note?: string;
  expectedDeliveryDate?: string | null;
}

export async function recordPledge(
  supabase: SupabaseClient,
  input: PledgeInput,
): Promise<{
  pledge_id: string;
  gap: Awaited<ReturnType<typeof challengeGap>>;
  fully_pledged: boolean;
  thread_id: string | null;
}> {
  const { data: need } = await supabase
    .from("resource_needs")
    .select("id, challenge_id, item, qty_needed, unit, kind, created_at")
    .eq("id", input.needId)
    .maybeSingle();
  if (!need) throw new HttpError(404, "That need no longer exists.");
  if (need.challenge_id !== input.challengeId) {
    throw new HttpError(400, "That need belongs to a different challenge.");
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, region_id, status")
    .eq("id", input.challengeId)
    .maybeSingle();
  if (!challenge || NOT_ACCEPTING.includes(challenge.status as string)) {
    throw new HttpError(409, "This project is no longer accepting contributions.");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, type, verified")
    .eq("id", input.orgId)
    .maybeSingle();
  if (!org) throw new HttpError(404, "No such organisation.");
  if (!org.verified) {
    throw new HttpError(
      403,
      "That organisation has not been verified by an administrator yet, so it cannot pledge.",
    );
  }

  const before = await challengeGap(supabase, input.challengeId);
  const line = before.needs.find((n) => n.need_id === input.needId);
  const open = line ? Number(line.qty_open) : Number(need.qty_needed);

  if (open <= 0) {
    throw new HttpError(409, `Nothing is left to give on "${need.item}" - other contributors have covered it.`);
  }
  // Capped at what is still open: "15 kg of 10 kg" would show a line as
  // over-closed and mislead the college about what is actually coming.
  if (input.qty > open + 1e-9) {
    throw new HttpError(
      422,
      `Only ${formatAmount(open, need.unit as string, need.kind as string)} of "${need.item}" is still needed. Pledge that much or less.`,
    );
  }

  const { data: inserted, error } = await supabase
    .from("pledges")
    .insert({
      need_id: input.needId,
      org_id: input.orgId,
      pledged_by: input.actor.id,
      qty: input.qty,
      kind: need.kind,
      status: "offered",
      state: "offered",
      note: input.note ?? null,
      expected_delivery_date: input.expectedDeliveryDate ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const gap = await challengeGap(supabase, input.challengeId);
  const amount = formatAmount(input.qty, need.unit as string, need.kind as string);

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: input.challengeId,
    action: "pledged",
    actor: input.actor.id,
    actorRole: input.actor.role,
    regionId: challenge.region_id as string,
    payload: {
      pledge_id: inserted.id,
      need_id: input.needId,
      item: need.item,
      org_id: input.orgId,
      org_name: org.name,
      org_type: org.type,
      qty: input.qty,
      unit: need.unit,
      kind: need.kind,
      amount,
      remaining_after: gap.needs.find((n) => n.need_id === input.needId)?.qty_open ?? 0,
    },
  });

  // A closed gap changes the priority score, so it is recomputed immediately.
  await rescoreChallenge(supabase, input.challengeId);

  // The contributor can talk to the college straight away, about this project.
  const college = await collegeForChallenge(supabase, input.challengeId);
  let threadId: string | null = null;
  if (college && college !== input.orgId) {
    threadId = (await ensureThread(supabase, {
      challengeId: input.challengeId,
      collegeOrgId: college,
      contributorOrgId: input.orgId,
    })).id;
    await notifyOrgs(supabase, {
      orgIds: [college],
      template: "pledge_offered",
      payload: { ref: challenge.ref, challenge_id: input.challengeId, org: org.name, amount, item: need.item },
    });
  }

  if (gap.fullyPledged && !before.fullyPledged) {
    const now = new Date().toISOString();
    await appendLedger(supabase, {
      entity: "challenge",
      entityId: input.challengeId,
      action: "fully_funded",
      regionId: challenge.region_id as string,
      payload: { lines: gap.needs.length, last_pledge_id: inserted.id },
    });
    const { data: firstNeed } = await supabase
      .from("resource_needs")
      .select("created_at")
      .eq("challenge_id", input.challengeId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    await supabase.rpc("record_timing", {
      p_challenge: input.challengeId,
      p_stage: "to_fully_funded",
      p_started: (firstNeed?.created_at as string) ?? (need.created_at as string),
      p_ended: now,
    });
    // Everything is covered: the project leaves the needs board and work can start.
    // The move still obeys the state machine: PILOT is only legal from
    // SOLUTION_PROPOSED with a coordinator-approved pilot. If pledges land
    // before the approval, the challenge waits for it instead of skipping
    // the gate.
    if (challenge.status === "SOLUTION_PROPOSED") {
      const { data: pilot } = await supabase
        .from("solutions")
        .select("id")
        .eq("challenge_id", input.challengeId)
        .in("status", ["approved_for_pilot", "deployed"])
        .limit(1)
        .maybeSingle();
      if (pilot) {
        await supabase.from("challenges").update({ status: "PILOT" }).eq("id", input.challengeId);
      }
      await appendLedger(supabase, {
        entity: "challenge",
        entityId: input.challengeId,
        action: "work_started",
        regionId: challenge.region_id as string,
        payload: {
          reason: "every requirement is fully pledged",
          pilot_approved: Boolean(pilot),
        },
      });
    }
  }

  return { pledge_id: inserted.id as string, gap, fully_pledged: gap.fullyPledged, thread_id: threadId };
}

async function loadPledge(supabase: SupabaseClient, pledgeId: string) {
  const { data: pledge } = await supabase
    .from("pledges")
    .select("id, need_id, org_id, qty, kind, state, status, note, created_at, dispatched_at, received_at")
    .eq("id", pledgeId)
    .maybeSingle();
  if (!pledge) throw new HttpError(404, "No such contribution.");

  const { data: need } = await supabase
    .from("resource_needs")
    .select("id, challenge_id, item, unit, kind, qty_needed")
    .eq("id", pledge.need_id)
    .single();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, region_id, status")
    .eq("id", need!.challenge_id)
    .single();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, type")
    .eq("id", pledge.org_id)
    .single();

  const state = ((pledge.state as string) ?? (pledge.status as string) ?? "offered").toString();
  return {
    pledge,
    need: need!,
    challenge: challenge!,
    org: org!,
    state,
    amount: formatAmount(Number(pledge.qty), need!.unit as string, need!.kind as string),
  };
}

/** The contributor marks it sent: materials on their way, or money transferred. */
export async function dispatchPledge(
  supabase: SupabaseClient,
  actor: Actor,
  pledgeId: string,
  body: { expected_delivery_date?: string | null; note?: string | null },
) {
  const ctx = await loadPledge(supabase, pledgeId);
  if (actor.role !== "admin" && actor.orgId !== ctx.pledge.org_id) {
    throw new HttpError(403, "Only the organisation that pledged this can mark it sent.");
  }
  if (!["offered", "committed"].includes(ctx.state)) {
    throw new HttpError(409, `This contribution is already ${ctx.state}.`);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("pledges")
    .update({
      state: "dispatched",
      status: "confirmed",
      dispatched_at: now,
      ...(body.expected_delivery_date ? { expected_delivery_date: body.expected_delivery_date } : {}),
      ...(body.note ? { note: [ctx.pledge.note, body.note].filter(Boolean).join("\n") } : {}),
    })
    .eq("id", pledgeId);
  if (error) throw error;

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: ctx.challenge.id as string,
    action: "contribution_dispatched",
    actor: actor.id,
    actorRole: actor.role,
    regionId: ctx.challenge.region_id as string,
    payload: {
      pledge_id: pledgeId,
      org_id: ctx.org.id,
      org_name: ctx.org.name,
      item: ctx.need.item,
      amount: ctx.amount,
      expected_delivery_date: body.expected_delivery_date ?? null,
      note: body.note ?? null,
    },
  });

  const college = await collegeForChallenge(supabase, ctx.challenge.id as string);
  await notifyOrgs(supabase, {
    orgIds: [college],
    template: "pledge_dispatched",
    payload: { ref: ctx.challenge.ref, challenge_id: ctx.challenge.id, org: ctx.org.name, amount: ctx.amount, item: ctx.need.item },
  });

  return { pledge_id: pledgeId, state: "dispatched", dispatched_at: now };
}

/** The college confirms it arrived. Only the college delivering the project can. */
export async function receivePledge(
  supabase: SupabaseClient,
  actor: Actor,
  pledgeId: string,
  body: { receipt_note?: string | null },
) {
  const ctx = await loadPledge(supabase, pledgeId);
  const college = await collegeForChallenge(supabase, ctx.challenge.id as string);
  const allowed =
    actor.role === "admin" || actor.role === "coordinator" || (college !== null && actor.orgId === college);
  if (!allowed) {
    throw new HttpError(403, "Only the college delivering this project can confirm what it received.");
  }
  if (ctx.state === "received") throw new HttpError(409, "This contribution is already confirmed as received.");
  if (ctx.state === "withdrawn") throw new HttpError(409, "This contribution was withdrawn.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("pledges")
    .update({
      state: "received",
      status: "delivered",
      received_at: now,
      received_by: actor.id,
      receipt_note: body.receipt_note ?? null,
      // Received without a recorded dispatch still happened on or before today.
      dispatched_at: (ctx.pledge.dispatched_at as string | null) ?? now,
    })
    .eq("id", pledgeId);
  if (error) throw error;

  const days = Math.round(((Date.now() - new Date(ctx.pledge.created_at as string).getTime()) / 86_400_000) * 10) / 10;
  await appendLedger(supabase, {
    entity: "challenge",
    entityId: ctx.challenge.id as string,
    action: "contribution_received",
    actor: actor.id,
    actorRole: actor.role,
    regionId: ctx.challenge.region_id as string,
    payload: {
      pledge_id: pledgeId,
      org_id: ctx.org.id,
      org_name: ctx.org.name,
      item: ctx.need.item,
      amount: ctx.amount,
      receipt_note: body.receipt_note ?? null,
      days_from_pledge: days,
    },
  });

  const { data: collegeOrg } = college
    ? await supabase.from("organizations").select("name").eq("id", college).maybeSingle()
    : { data: null };
  await notifyOrgs(supabase, {
    orgIds: [ctx.org.id as string],
    template: "pledge_confirmed_received",
    payload: {
      ref: ctx.challenge.ref,
      challenge_id: ctx.challenge.id,
      college: (collegeOrg?.name as string) ?? "The college",
      amount: ctx.amount,
      item: ctx.need.item,
    },
  });

  // Everything that was needed is now in the college's hands.
  const { data: needs } = await supabase
    .from("resource_needs")
    .select("id, qty_needed")
    .eq("challenge_id", ctx.challenge.id);
  const { data: received } = await supabase
    .from("pledges")
    .select("need_id, qty")
    .in("need_id", (needs ?? []).map((n) => n.id as string))
    .eq("state", "received");
  const receivedByNeed = new Map<string, number>();
  for (const p of received ?? []) {
    receivedByNeed.set(p.need_id as string, (receivedByNeed.get(p.need_id as string) ?? 0) + Number(p.qty));
  }
  const allReceived =
    (needs ?? []).length > 0 &&
    (needs ?? []).every((n) => (receivedByNeed.get(n.id as string) ?? 0) >= Number(n.qty_needed));
  if (allReceived) {
    await appendLedger(supabase, {
      entity: "challenge",
      entityId: ctx.challenge.id as string,
      action: "all_contributions_received",
      regionId: ctx.challenge.region_id as string,
      payload: { lines: needs?.length ?? 0 },
    });
  }

  return { pledge_id: pledgeId, state: "received", received_at: now, all_received: allReceived };
}

/** A contributor takes back an offer it has not sent yet. */
export async function withdrawPledge(supabase: SupabaseClient, actor: Actor, pledgeId: string) {
  const ctx = await loadPledge(supabase, pledgeId);
  if (actor.role !== "admin" && actor.orgId !== ctx.pledge.org_id) {
    throw new HttpError(403, "Only the organisation that pledged this can withdraw it.");
  }
  if (ctx.state !== "offered" && ctx.state !== "committed") {
    throw new HttpError(409, `A contribution that is already ${ctx.state} cannot be withdrawn. Talk to the college in Messages.`);
  }

  const { error } = await supabase
    .from("pledges")
    .update({ state: "withdrawn", status: "withdrawn" })
    .eq("id", pledgeId);
  if (error) throw error;

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: ctx.challenge.id as string,
    action: "contribution_withdrawn",
    actor: actor.id,
    actorRole: actor.role,
    regionId: ctx.challenge.region_id as string,
    payload: { pledge_id: pledgeId, org_name: ctx.org.name, item: ctx.need.item, amount: ctx.amount },
  });
  await rescoreChallenge(supabase, ctx.challenge.id as string);

  return { pledge_id: pledgeId, state: "withdrawn" };
}
