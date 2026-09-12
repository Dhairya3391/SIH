import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendLedger } from "./ledger";
import { rescoreChallenge } from "./scoring";
import { notifyCapabilityMatch } from "./notify";
import type { PledgeKind } from "@/lib/domain/types";
import { HttpError } from "@/lib/supabase/server";

/**
 * Resource Swarm.
 *
 * No single organisation has to solve everything. The approved pilot's needs go
 * out as capability alerts, partners pledge part of what is needed, and the
 * remaining gap stays visible until it closes. On stage this is one company
 * pledging 8 of 12 siren units, and a second closing the last 4.
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

  return { needs, pctClosed, fullyPledged: needs.length > 0 && pctClosed >= 100 };
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
 * Turns an approved pilot into resource needs, then alerts every organisation
 * whose capabilities match. This is the step that converts "a good proposal"
 * into "someone is being asked for something specific".
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

export interface PledgeInput {
  challengeId: string;
  needId: string;
  orgId: string;
  actorId: string;
  qty: number;
  kind: PledgeKind;
  note?: string;
}

export async function recordPledge(
  supabase: SupabaseClient,
  input: PledgeInput,
): Promise<{ gap: Awaited<ReturnType<typeof challengeGap>>; overPledged: boolean }> {
  const { data: need, error: needError } = await supabase
    .from("resource_needs")
    .select("id, challenge_id, item, qty_needed, unit")
    .eq("id", input.needId)
    .single();
  if (needError) throw needError;
  if (need.challenge_id !== input.challengeId) {
    throw new HttpError(400, "That need belongs to a different challenge.");
  }

  const before = await challengeGap(supabase, input.challengeId);
  const row = before.needs.find((n) => n.need_id === input.needId);
  const open = row ? Number(row.qty_open) : Number(need.qty_needed);

  // Over-pledging is allowed but flagged: telling a company "no, we have
  // enough" is a coordinator's call, not a database constraint's.
  const overPledged = input.qty > open;

  const { error } = await supabase.from("pledges").insert({
    need_id: input.needId,
    org_id: input.orgId,
    pledged_by: input.actorId,
    qty: input.qty,
    kind: input.kind,
    status: "offered",
    note: input.note ?? null,
  });
  if (error) throw error;

  const gap = await challengeGap(supabase, input.challengeId);

  await appendLedger(supabase, {
    entity: "pledge",
    entityId: input.challengeId,
    action: "pledged",
    actor: input.actorId,
    payload: {
      need_id: input.needId,
      item: need.item,
      org_id: input.orgId,
      qty: input.qty,
      unit: need.unit,
      kind: input.kind,
      remaining_after: gap.needs.find((n) => n.need_id === input.needId)?.qty_open ?? 0,
      over_pledged: overPledged,
    },
  });

  // A closed gap changes the priority score, so it is recomputed immediately.
  await rescoreChallenge(supabase, input.challengeId);

  return { gap, overPledged };
}
