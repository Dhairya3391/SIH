import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Every meaningful act is appended to the ledger.
 *
 * One table does three jobs, which is why there is no separate updates table:
 * it is the audit trail, it is the activity timeline the challenge page reads,
 * and the hash chain makes tampering visible. The chaining itself happens in a
 * Postgres trigger, so it cannot be skipped by writing from somewhere else.
 */

export type LedgerEntity =
  | "report"
  | "challenge"
  | "solution"
  | "pledge"
  | "assignment"
  | "match"
  | "evidence"
  | "impact"
  | "crisis"
  | "weights"
  | "organization";

export interface LedgerEntry {
  entity: LedgerEntity;
  entityId: string | null;
  action: string;
  actor?: string | null;
  actorRole?: string | null;
  regionId?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * A ledger write must never be the reason a user-facing action fails. If the
 * append fails we log loudly and carry on: losing one timeline row is bad,
 * losing a citizen's report because of it would be worse.
 */
export async function appendLedger(
  supabase: SupabaseClient,
  entry: LedgerEntry,
): Promise<void> {
  const { error } = await supabase.from("ledger").insert({
    entity: entry.entity,
    entity_id: entry.entityId,
    action: entry.action,
    actor: entry.actor ?? null,
    actor_role: entry.actorRole ?? null,
    region_id: entry.regionId ?? null,
    payload: entry.payload ?? {},
  });
  if (error) console.error("[jharsetu] ledger append failed", entry.action, error.message);
}

export async function appendMany(
  supabase: SupabaseClient,
  entries: LedgerEntry[],
): Promise<void> {
  if (!entries.length) return;
  const { error } = await supabase.from("ledger").insert(
    entries.map((e) => ({
      entity: e.entity,
      entity_id: e.entityId,
      action: e.action,
      actor: e.actor ?? null,
      actor_role: e.actorRole ?? null,
      region_id: e.regionId ?? null,
      payload: e.payload ?? {},
    })),
  );
  if (error) console.error("[jharsetu] ledger batch append failed", error.message);
}

/** The timeline shown on the challenge page. */
export async function timeline(
  supabase: SupabaseClient,
  entity: LedgerEntity,
  entityId: string,
  limit = 100,
) {
  const { data, error } = await supabase
    .from("ledger")
    .select("id, entity, entity_id, action, actor, actor_role, payload, hash, created_at")
    .eq("entity", entity)
    .eq("entity_id", entityId)
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * Walks the chain and recomputes every hash. This is the answer to "how is this
 * tamper-evident without a blockchain?", and it runs in well under a second on
 * demo-sized data.
 */
export async function verifyChain(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("verify_ledger", { p_from: 0 });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { ok: boolean; broken_at: number | null; checked: number };
}
