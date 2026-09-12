import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/supabase/server";
import { fileUrl } from "@/lib/storage";

/**
 * Everything that ever happened to one challenge, in order, with who did it
 * and how long after the previous step.
 *
 * The admin history page and the AI assistant both read this, so the answer
 * the assistant gives and the page the admin opens can never disagree.
 *
 * The ledger is the source for actions; reports, proposal submissions and
 * messages come from their own tables. Rows written before an action was
 * ledgered (seeded or older data) are read from their tables instead, so
 * nothing on record is missing from the timeline.
 */

export interface HistoryEvent {
  at: string;
  kind: string;
  actor: string | null;
  summary: string;
  detail: Record<string, unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dayGap = (a: string, b: string) =>
  Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) * 10) / 10;

/** One ledger action as a sentence and an event kind. Also used by the public challenge timeline. */
export function describeLedgerEntry(
  action: string,
  p: Record<string, unknown>,
  orgName: (id: unknown) => string,
): { kind: string; summary: string } {
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
  switch (action) {
    case "compiled":
      return { kind: "compiled", summary: `The report was compiled into this problem (${p.source === "ai" ? "by the AI" : "by the rule-based compiler"}; ${String(p.decision ?? "new")}).` };
    case "report_merged":
      return { kind: "merged", summary: `Another report merged in${p.similarity != null ? ` at ${Math.round(n(p.similarity) * 100)}% similarity` : ""}.` };
    case "brief_recompiled":
      return { kind: "compiled", summary: `The brief was recompiled from ${n(p.report_count)} reports.` };
    case "sent_to_verifier":
      return { kind: "routed", summary: `Sent straight to the verifier desk: ${String(p.reason ?? "")}` };
    case "external_check":
      return {
        kind: "external_check",
        summary: `AI check (${String(p.trigger ?? "")}): ${String(p.verdict)}${p.citations ? ` with ${n(p.citations)} source(s)` : ""}, confidence ${Math.round(n(p.confidence) * 100)}% (${p.method === "ai" ? String(p.model ?? "model") : "published rules"}).`,
      };
    case "ai_verified":
      return { kind: "ai_verified", summary: `Verified automatically from ${Array.isArray(p.sources) ? p.sources.length : 0} independent source(s); now open to colleges.` };
    case "human_verified":
      return { kind: "human_verified", summary: `Verified by a ${p.method === "coordinator" ? "coordinator" : "verifier"} with ${Array.isArray(p.sources) ? p.sources.length : 0} source(s) and ${n(p.photos)} photo(s).` };
    case "verification_rejected":
      return { kind: "rejected", summary: `Rejected at verification: ${String(p.reason ?? "")}` };
    case "brief_approved":
    case "opened_for_partners":
      return { kind: "approved", summary: `Approved by a coordinator (${action.replace(/_/g, " ")}).` };
    case "proposal_scored":
      return {
        kind: "proposal_scored",
        summary: `Proposal v${String(p.version ?? "?")} from ${orgName(p.org_id)} scored ${String(p.score)} - ${String(p.verdict).replace(/_/g, " ")} (${p.source === "rules" ? "rule-based rubric" : "AI reviewer"}).`,
      };
    case "window_awarded":
      return { kind: "window_awarded", summary: `Awarded to ${orgName(p.org_id)} at ${String(p.score)}${p.manual ? " (closed early by an administrator)" : ""}.` };
    case "window_reopened":
      return { kind: "window_reopened", summary: "The window closed with no viable proposal and reopened." };
    case "stages_generated":
      return { kind: "stages_generated", summary: `${n(p.count)} delivery stages drawn from the winning document (${p.source === "rules" ? "rules" : "AI"}).` };
    case "requirements_published":
    case "requirements_updated": {
      const added = Array.isArray(p.added) ? (p.added as Array<Record<string, unknown>>) : [];
      const list = added
        .map((a) => (a.kind === "money" ? `₹${n(a.qty).toLocaleString("en-IN")} funding` : `${String(a.qty)} ${String(a.unit)} ${String(a.item)}`))
        .join(", ");
      return { kind: "requirements", summary: `${action === "requirements_published" ? "Requirements published" : "Requirements updated"}${list ? `: ${list}` : ""}.` };
    }
    case "requirement_removed":
      return { kind: "requirements", summary: `Requirement removed: ${String(p.item ?? "")}.` };
    case "needs_published":
      return { kind: "requirements", summary: "Needs published for a pilot." };
    case "pledged":
      return { kind: "pledge", summary: `${String(p.org_name ?? orgName(p.org_id))} pledged ${String(p.amount ?? `${String(p.qty)} ${String(p.unit ?? "")}`)} of ${String(p.item)}.` };
    case "contribution_dispatched":
      return { kind: "dispatched", summary: `${String(p.org_name)} sent ${String(p.amount)} of ${String(p.item)}${p.expected_delivery_date ? `, expected ${String(p.expected_delivery_date)}` : ""}.` };
    case "contribution_received":
      return { kind: "received", summary: `The college confirmed receiving ${String(p.amount)} of ${String(p.item)} from ${String(p.org_name)}${p.days_from_pledge != null ? `, ${String(p.days_from_pledge)} days after it was pledged` : ""}.` };
    case "contribution_withdrawn":
      return { kind: "withdrawn", summary: `${String(p.org_name)} withdrew ${String(p.amount)} of ${String(p.item)}.` };
    case "fully_funded":
      return { kind: "funded", summary: "Every requirement is fully pledged." };
    case "all_contributions_received":
      return { kind: "funded", summary: "Everything pledged has been received by the college." };
    case "work_started":
      return { kind: "work_started", summary: `Work started (${String(p.reason ?? "")}).` };
    case "stage_updated":
      return { kind: "stage", summary: `Stage ${String(p.seq)}, "${String(p.title)}": ${String(p.from).replace(/_/g, " ")} → ${String(p.to).replace(/_/g, " ")}${p.note ? ` - ${String(p.note)}` : ""}.` };
    case "progress_update":
      return { kind: "update", summary: `Progress update: ${String(p.note ?? "")}${n(p.photos) ? ` (${n(p.photos)} photo(s))` : ""}` };
    case "work_completed":
      return { kind: "completed", summary: "Every delivery stage is done: work complete. Reporters were asked to confirm the fix." };
    case "impact_verified":
      return { kind: "confirmed", summary: "The community confirmed the fix." };
    case "CHALLENGE_DELETED":
      return { kind: "ledger", summary: "The challenge was deleted by an administrator." };
    default:
      return { kind: "ledger", summary: action.replace(/_/g, " ") };
  }
}

export async function challengeHistory(supabase: SupabaseClient, idOrRef: string) {
  const isUuid = UUID.test(idOrRef);
  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq(isUuid ? "id" : "ref", isUuid ? idOrRef : idOrRef.toUpperCase())
    .maybeSingle();
  if (!challenge) throw new HttpError(404, "No such challenge.");
  const cid = challenge.id as string;

  const [reports, externals, verifications, proposals, leaderHistory, windowRow, needs, stages, updates, ledger, threads] =
    await Promise.all([
      supabase
        .from("reports")
        .select("id, channel, district, village, original_text, translated_text, reporter_id, created_at")
        .eq("cluster_id", cid)
        .order("created_at"),
      supabase
        .from("external_checks")
        .select("id, provider, verdict, confidence, citations, reasoning, provider_error, model, checked_at")
        .eq("challenge_id", cid)
        .order("checked_at"),
      supabase
        .from("verifications")
        .select("id, kind, method, note, source_urls, photo_paths, rejected_reason, by_user, created_at")
        .eq("challenge_id", cid)
        .order("created_at"),
      supabase
        .from("proposals")
        .select(
          "id, org_id, author_id, version, state, ai_score, ai_verdict, ai_rubric, ai_model, ai_rubric_version, funding_required, currency, duration_days, document_name, document_pages, submitted_at, scored_at",
        )
        .eq("challenge_id", cid)
        .order("submitted_at"),
      supabase.from("proposal_leader_history").select("*").eq("challenge_id", cid).order("changed_at"),
      supabase.from("proposal_windows").select("*").eq("challenge_id", cid).maybeSingle(),
      supabase.from("resource_needs").select("*").eq("challenge_id", cid).order("created_at"),
      supabase.from("progress_stages").select("*").eq("challenge_id", cid).order("seq"),
      supabase
        .from("progress_updates")
        .select("id, stage_id, author_id, note, photo_paths, created_at")
        .eq("challenge_id", cid)
        .order("created_at"),
      supabase.from("ledger").select("id, action, actor, actor_role, payload, hash, created_at").eq("entity_id", cid).order("id"),
      supabase.from("threads").select("*").eq("challenge_id", cid),
    ]);

  const needIds = (needs.data ?? []).map((n) => n.id as string);
  const threadIds = (threads.data ?? []).map((t) => t.id as string);
  const [{ data: pledges }, { data: messages }] = await Promise.all([
    needIds.length
      ? supabase.from("pledges").select("*").in("need_id", needIds).order("created_at")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    threadIds.length
      ? supabase
          .from("messages")
          .select("id, thread_id, author_id, author_org_id, body, created_at")
          .in("thread_id", threadIds)
          .order("created_at")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  // Name the people and organisations rather than printing ids at the system owner.
  const userIds = [
    ...new Set(
      [
        ...(reports.data ?? []).map((r) => r.reporter_id),
        ...(verifications.data ?? []).map((v) => v.by_user),
        ...(proposals.data ?? []).map((p) => p.author_id),
        ...(updates.data ?? []).map((u) => u.author_id),
        ...(messages ?? []).map((m) => m.author_id),
        ...(ledger.data ?? []).map((l) => l.actor),
      ].filter(Boolean) as string[],
    ),
  ];
  const orgIds = [
    ...new Set(
      [
        ...(proposals.data ?? []).map((p) => p.org_id),
        ...(pledges ?? []).map((p) => p.org_id),
        ...(threads.data ?? []).flatMap((t) => [t.college_org_id, t.contributor_org_id]),
      ].filter(Boolean) as string[],
    ),
  ];
  const [{ data: users }, { data: orgs }] = await Promise.all([
    userIds.length
      ? supabase.from("users").select("id, full_name, role").in("id", userIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    orgIds.length
      ? supabase.from("organizations").select("id, name, type").in("id", orgIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const userLabel = new Map((users ?? []).map((u) => [u.id as string, `${(u.full_name as string) ?? "unnamed"} (${String(u.role)})`]));
  const orgLabel = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));
  const orgName = (id: unknown) => (typeof id === "string" ? (orgLabel.get(id) ?? "an organisation") : "an organisation");
  const userName = (id: unknown) => (typeof id === "string" ? (userLabel.get(id) ?? null) : null);

  const events: HistoryEvent[] = [];
  const actions = new Set((ledger.data ?? []).map((l) => l.action as string));

  for (const r of reports.data ?? [])
    events.push({
      at: r.created_at as string,
      kind: "report",
      actor: userName(r.reporter_id) ?? "anonymous citizen",
      summary: `Report filed over ${String(r.channel)} from ${String(r.village ?? r.district ?? "an unstated place")}.`,
      detail: { text: r.translated_text ?? r.original_text },
    });

  for (const p of proposals.data ?? [])
    events.push({
      at: p.submitted_at as string,
      kind: "proposal_submitted",
      actor: `${orgName(p.org_id)}${p.author_id ? ` - ${userName(p.author_id) ?? ""}` : ""}`,
      summary: `Proposal v${String(p.version)} submitted by ${orgName(p.org_id)} (${String(p.document_name ?? "document")}, ${String(p.document_pages ?? "?")} page(s)).`,
      detail: { state: p.state, score: p.ai_score, verdict: p.ai_verdict, funding_required: p.funding_required, duration_days: p.duration_days },
    });

  for (const m of messages ?? []) {
    const thread = (threads.data ?? []).find((t) => t.id === m.thread_id);
    const other = thread ? (m.author_org_id === thread.college_org_id ? thread.contributor_org_id : thread.college_org_id) : null;
    events.push({
      at: m.created_at as string,
      kind: "message",
      actor: userName(m.author_id) ?? orgName(m.author_org_id),
      summary: `${orgName(m.author_org_id)} wrote to ${orgName(other)}: "${String(m.body).slice(0, 140)}"`,
      detail: { thread_id: m.thread_id },
    });
  }

  for (const l of ledger.data ?? []) {
    const d = describeLedgerEntry(l.action as string, (l.payload ?? {}) as Record<string, unknown>, orgName);
    events.push({
      at: l.created_at as string,
      kind: d.kind,
      actor: userName(l.actor) ?? (l.actor_role ? String(l.actor_role) : "system"),
      summary: d.summary,
      detail: { action: l.action, ...((l.payload ?? {}) as Record<string, unknown>), hash: l.hash },
    });
  }

  // Older rows that predate these actions being ledgered.
  if (!["ai_verified", "human_verified", "verification_rejected"].some((a) => actions.has(a))) {
    for (const v of verifications.data ?? [])
      events.push({
        at: v.created_at as string,
        kind: v.kind === "inaccurate" ? "rejected" : v.method === "ai_external" ? "ai_verified" : "human_verified",
        actor: userName(v.by_user),
        summary: v.kind === "inaccurate" ? `Flagged as inaccurate: ${String(v.rejected_reason ?? v.note ?? "")}` : `Verification on record (${String(v.method ?? v.kind)}).`,
        detail: { note: v.note, sources: v.source_urls },
      });
  }
  if (!actions.has("external_check")) {
    for (const e of externals.data ?? [])
      events.push({
        at: e.checked_at as string,
        kind: "external_check",
        actor: (e.model as string) ?? "corroboration engine",
        summary: e.provider_error ? `${String(e.provider)} check could not run: ${String(e.provider_error)}` : `${String(e.provider)} check: ${String(e.verdict)}.`,
        detail: { citations: e.citations, reasoning: e.reasoning },
      });
  }
  if (!actions.has("pledged")) {
    for (const p of pledges ?? [])
      events.push({
        at: p.created_at as string,
        kind: "pledge",
        actor: orgName(p.org_id),
        summary: `${orgName(p.org_id)} pledged ${String(p.qty)} (${String(p.kind)}), now ${String(p.state ?? p.status)}.`,
        detail: p,
      });
  }
  if (!actions.has("progress_update") && !actions.has("stage_updated")) {
    for (const u of updates.data ?? [])
      events.push({
        at: u.created_at as string,
        kind: "update",
        actor: userName(u.author_id),
        summary: `Progress update: ${String(u.note).slice(0, 160)}`,
        detail: { photos: u.photo_paths },
      });
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const timeline = events.map((e, i) => ({
    ...e,
    gap_hours: i === 0 ? null : Math.round(((new Date(e.at).getTime() - new Date(events[i - 1].at).getTime()) / 3_600_000) * 10) / 10,
  }));

  // The time between one progress update from the college and the next.
  const ups = updates.data ?? [];
  const cadenceRows = ups.map((u, i) => ({
    at: u.created_at as string,
    note: u.note as string,
    author: userName(u.author_id),
    photos: ((u.photo_paths as string[]) ?? []).map((p) => fileUrl(p)),
    gap_days: i === 0 ? null : dayGap(ups[i - 1].created_at as string, u.created_at as string),
  }));
  const gaps = cadenceRows.map((r) => r.gap_days).filter((g): g is number => g !== null);
  const lastUpdateAt = ups.at(-1)?.created_at as string | undefined;

  const contributions = (pledges ?? []).map((p) => {
    const need = (needs.data ?? []).find((n) => n.id === p.need_id);
    return {
      id: p.id as string,
      org: orgName(p.org_id),
      item: (need?.item as string) ?? "",
      unit: (need?.unit as string) ?? "",
      kind: p.kind as string,
      qty: Number(p.qty),
      state: ((p.state as string) ?? (p.status as string)) as string,
      pledged_at: p.created_at as string,
      dispatched_at: (p.dispatched_at as string) ?? null,
      received_at: (p.received_at as string) ?? null,
      receipt_note: (p.receipt_note as string) ?? null,
      days_to_receive: p.received_at ? dayGap(p.created_at as string, p.received_at as string) : null,
    };
  });

  return {
    challenge,
    window: windowRow.data ?? null,
    stages: stages.data ?? [],
    needs: needs.data ?? [],
    contributions,
    proposals: (proposals.data ?? []).map((p) => ({ ...p, org: orgName(p.org_id) })),
    counts: {
      reports: reports.data?.length ?? 0,
      external_checks: externals.data?.length ?? 0,
      verifications: verifications.data?.length ?? 0,
      proposals: proposals.data?.length ?? 0,
      contributions: contributions.length,
      progress_updates: ups.length,
      messages: messages?.length ?? 0,
      ledger_entries: ledger.data?.length ?? 0,
    },
    timeline,
    longest_gap_hours: timeline.reduce<number>((m, e) => Math.max(m, e.gap_hours ?? 0), 0),
    progress_cadence: {
      updates: cadenceRows,
      average_gap_days: gaps.length ? Math.round((gaps.reduce((s, g) => s + g, 0) / gaps.length) * 10) / 10 : null,
      longest_gap_days: gaps.length ? Math.max(...gaps) : null,
      days_since_last_update: lastUpdateAt ? dayGap(lastUpdateAt, new Date().toISOString()) : null,
    },
    leader_history: leaderHistory.data ?? [],
  };
}
