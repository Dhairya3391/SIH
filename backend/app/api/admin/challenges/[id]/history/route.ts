import { ok, fail, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/admin/challenges/[id]/history - everything that ever happened.
 *
 * One request, one ordered list, every entry carrying its actor and its
 * timestamp. This is the view that answers "what happened here, and when"
 * without anybody opening the database, and it is what the narrator reads
 * from so its answers and this page can never disagree.
 *
 * Accepts either a uuid or a human ref like C-107, because the ref is what
 * appears on every other screen.
 */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole("admin");
  const { id } = await ctx.params;
  const supabase = supabaseAdmin();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq(isUuid ? "id" : "ref", isUuid ? id : id.toUpperCase())
    .maybeSingle();
  if (!challenge) return fail(404, "No such challenge.", "not_found");

  const cid = challenge.id as string;

  const [
    reports,
    externals,
    verifications,
    proposals,
    leaderHistory,
    windowRow,
    needs,
    pledges,
    stages,
    updates,
    ledger,
    threads,
  ] = await Promise.all([
    supabase
      .from("reports")
      .select("id, channel, district, village, original_text, translated_text, reporter_name, created_at")
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
      .select("id, org_id, author_id, version, state, ai_score, ai_verdict, ai_rubric, ai_model, ai_rubric_version, funding_required, currency, duration_days, document_name, submitted_at, scored_at")
      .eq("challenge_id", cid)
      .order("submitted_at"),
    supabase
      .from("proposal_leader_history")
      .select("*")
      .eq("challenge_id", cid)
      .order("changed_at"),
    supabase.from("proposal_windows").select("*").eq("challenge_id", cid).maybeSingle(),
    supabase.from("resource_needs").select("*").eq("challenge_id", cid),
    supabase.from("pledges").select("*"),
    supabase.from("progress_stages").select("*").eq("challenge_id", cid).order("seq"),
    supabase
      .from("progress_updates")
      .select("id, stage_id, author_id, note, photo_paths, created_at")
      .eq("challenge_id", cid)
      .order("created_at"),
    supabase.from("ledger").select("*").eq("challenge_id", cid).order("created_at"),
    supabase.from("threads").select("*").eq("challenge_id", cid),
  ]);

  const needIds = new Set((needs.data ?? []).map((n) => n.id as string));
  const ourPledges = (pledges.data ?? []).filter((p) => needIds.has(p.need_id as string));

  // Resolve the people and organisations, so the timeline names actors rather
  // than printing uuids at the system owner.
  const userIds = [
    ...new Set(
      [
        ...(verifications.data ?? []).map((v) => v.by_user),
        ...(proposals.data ?? []).map((p) => p.author_id),
        ...(updates.data ?? []).map((u) => u.author_id),
      ].filter(Boolean) as string[],
    ),
  ];
  const orgIds = [
    ...new Set(
      [
        ...(proposals.data ?? []).map((p) => p.org_id),
        ...ourPledges.map((p) => p.org_id),
      ].filter(Boolean) as string[],
    ),
  ];

  const users = new Map<string, string>();
  if (userIds.length > 0) {
    const { data } = await supabase.from("users").select("id, full_name, role").in("id", userIds);
    for (const u of data ?? [])
      users.set(u.id as string, `${u.full_name ?? "unnamed"} (${u.role})`);
  }
  const orgs = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data } = await supabase.from("organizations").select("id, name").in("id", orgIds);
    for (const o of data ?? []) orgs.set(o.id as string, o.name as string);
  }

  interface Event {
    at: string;
    kind: string;
    actor: string | null;
    summary: string;
    detail: Record<string, unknown>;
  }
  const events: Event[] = [];

  for (const r of reports.data ?? [])
    events.push({
      at: r.created_at as string,
      kind: "report",
      actor: (r.reporter_name as string) ?? "anonymous citizen",
      summary: `Report filed over ${r.channel} from ${r.village ?? r.district}`,
      detail: { text: r.translated_text ?? r.original_text },
    });

  for (const e of externals.data ?? [])
    events.push({
      at: e.checked_at as string,
      kind: "external_check",
      actor: (e.model as string) ?? "corroboration engine",
      summary: e.provider_error
        ? `${e.provider} check could not run`
        : `${e.provider} check: ${e.verdict}`,
      detail: {
        citations: e.citations,
        reasoning: e.reasoning,
        error: e.provider_error,
        confidence: e.confidence,
      },
    });

  for (const v of verifications.data ?? [])
    events.push({
      at: v.created_at as string,
      kind: v.kind === "inaccurate" ? "rejected" : "verified",
      actor: v.by_user ? (users.get(v.by_user as string) ?? null) : null,
      summary:
        v.kind === "inaccurate"
          ? "Rejected as inaccurate by a verifier"
          : `Verified (${v.method}) with ${(v.source_urls as string[] | null)?.length ?? 0} source(s) and ${(v.photo_paths as string[] | null)?.length ?? 0} photo(s)`,
      detail: {
        note: v.note,
        sources: v.source_urls,
        photos: v.photo_paths,
        reason: v.rejected_reason,
      },
    });

  for (const p of proposals.data ?? [])
    events.push({
      at: p.submitted_at as string,
      kind: "proposal",
      actor: `${orgs.get(p.org_id as string) ?? "unknown org"}${p.author_id ? ` — ${users.get(p.author_id as string) ?? ""}` : ""}`,
      summary: `Proposal v${p.version} submitted (${p.document_name})`,
      detail: {
        state: p.state,
        score: p.ai_score,
        verdict: p.ai_verdict,
        model: p.ai_model,
        rubric_version: p.ai_rubric_version,
        rubric: p.ai_rubric,
        funding_required: p.funding_required,
        duration_days: p.duration_days,
      },
    });

  for (const h of leaderHistory.data ?? [])
    events.push({
      at: h.changed_at as string,
      kind: "lead_change",
      actor: "competition",
      summary:
        h.reason === "window_awarded"
          ? `Window closed and awarded at ${h.to_score}`
          : `Lead changed to ${h.to_score}${h.from_score !== null ? ` from ${h.from_score}` : ""} (${h.reason})`,
      detail: h as Record<string, unknown>,
    });

  for (const p of ourPledges)
    events.push({
      at: p.created_at as string,
      kind: "contribution",
      actor: orgs.get(p.org_id as string) ?? "unknown org",
      summary: `Pledged ${p.qty} (${p.kind}), state ${p.state ?? p.status}`,
      detail: p as Record<string, unknown>,
    });

  for (const u of updates.data ?? [])
    events.push({
      at: u.created_at as string,
      kind: "progress_update",
      actor: u.author_id ? (users.get(u.author_id as string) ?? null) : null,
      summary: (u.note as string).slice(0, 140),
      detail: { photos: u.photo_paths, stage_id: u.stage_id },
    });

  for (const l of ledger.data ?? [])
    events.push({
      at: l.created_at as string,
      kind: "ledger",
      actor: "ledger",
      summary: `Ledger entry: ${l.event ?? l.kind ?? "state change"}`,
      detail: l as Record<string, unknown>,
    });

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Gaps between consecutive events, which is the "time periods between each
  // update" the console is specified to show.
  const withGaps = events.map((e, i) => ({
    ...e,
    gap_hours:
      i === 0
        ? null
        : Math.round(
            ((new Date(e.at).getTime() - new Date(events[i - 1].at).getTime()) / 3_600_000) * 10,
          ) / 10,
  }));

  return ok({
    challenge,
    window: windowRow.data ?? null,
    stages: stages.data ?? [],
    needs: needs.data ?? [],
    counts: {
      reports: reports.data?.length ?? 0,
      external_checks: externals.data?.length ?? 0,
      verifications: verifications.data?.length ?? 0,
      proposals: proposals.data?.length ?? 0,
      contributions: ourPledges.length,
      progress_updates: updates.data?.length ?? 0,
      ledger_entries: ledger.data?.length ?? 0,
      threads: threads.data?.length ?? 0,
    },
    timeline: withGaps,
    longest_gap_hours: withGaps.reduce<number>((m, e) => Math.max(m, e.gap_hours ?? 0), 0),
  });
});
