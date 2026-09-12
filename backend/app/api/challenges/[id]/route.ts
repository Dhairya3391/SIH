import { ok, fail, route } from "@/lib/http";
import { supabaseServer, currentActor, requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { priorityBand } from "@/lib/domain/types";
import { AI_DISCLAIMER } from "@/lib/ai/brief";
import { challengeGap } from "@/lib/services/swarm";
import { availableActions } from "@/lib/services/lifecycle";
import { timeline, appendLedger } from "@/lib/services/ledger";
import { fileUrl } from "@/lib/storage";
import { describeLedgerEntry } from "@/lib/services/history";

/**
 * The ledger as events a person can read: what happened, which role did it,
 * and how long after the step before. Names of people are left out - this is
 * served to anyone holding the reference.
 */
function readableTimeline(
  rows: Array<{ action: string; actor_role: string | null; payload: Record<string, unknown> | null; created_at: string }>,
) {
  return rows.map((l, i) => {
    const d = describeLedgerEntry(l.action, l.payload ?? {}, (id) =>
      typeof id === "string" ? "an organisation" : "an organisation",
    );
    return {
      at: l.created_at,
      kind: d.kind,
      actor: l.actor_role ?? "system",
      summary: d.summary,
      detail: null,
      gap_hours:
        i === 0
          ? null
          : Math.round(((new Date(l.created_at).getTime() - new Date(rows[i - 1].created_at).getTime()) / 3_600_000) * 10) / 10,
    };
  });
}

/**
 * The public face of a project after award: who is building it, how far the
 * funding has got, the delivery stages and the latest progress. No contact
 * details and no other college's proposal - those belong to signed-in partners.
 */
async function publicProject(challengeId: string) {
  const admin = supabaseAdmin();
  const { data: winner } = await admin
    .from("proposals")
    .select("id, org_id, ai_score, funding_required, duration_days, submitted_at")
    .eq("challenge_id", challengeId)
    .eq("state", "winner")
    .limit(1)
    .maybeSingle();
  if (!winner) return null;

  const [{ data: org }, { data: stages }, { data: updates }, { data: win }] = await Promise.all([
    admin.from("organizations").select("id, name, type, district").eq("id", winner.org_id).maybeSingle(),
    admin
      .from("progress_stages")
      .select("id, seq, title, definition_of_done, expected_days, status, started_at, completed_at")
      .eq("challenge_id", challengeId)
      .order("seq"),
    admin
      .from("progress_updates")
      .select("id, stage_id, note, photo_paths, created_at")
      .eq("challenge_id", challengeId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin.from("proposal_windows").select("closed_at").eq("challenge_id", challengeId).maybeSingle(),
  ]);

  return {
    college: org ?? null,
    proposal_id: winner.id as string,
    score: (winner.ai_score as number) ?? null,
    funding_required: (winner.funding_required as number) ?? null,
    duration_days: (winner.duration_days as number) ?? null,
    awarded_at: (win?.closed_at as string) ?? null,
    stages: stages ?? [],
    stages_done: (stages ?? []).filter((s) => s.status === "done").length,
    updates: (updates ?? []).map((u) => ({
      id: u.id as string,
      stage_id: (u.stage_id as string) ?? null,
      note: u.note as string,
      photos: ((u.photo_paths as string[]) ?? []).map((p) => fileUrl(p)),
      created_at: u.created_at as string,
    })),
  };
}

/**
 * GET /api/challenges/:id - everything the main demo screen needs, in one call.
 *
 * The challenge detail page is the screen judges should remember, so it gets a
 * single round trip: the brief, the priority breakdown, the cluster, what is
 * nearby, the proposals with their readiness scores, the gap bar, the timeline
 * and the evidence.
 */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await currentActor();
    const supabase = await supabaseServer();
    const isStaff = actor?.role === "coordinator" || actor?.role === "admin";

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const { data: challenge, error } = await supabase
      .from(isStaff ? "challenges" : "challenges_public")
      .select("*")
      .eq(isUuid ? "id" : "ref", id)
      .maybeSingle();
    if (error) throw error;
    if (!challenge) return fail(404, "No such challenge.", "not_found");

    const challengeId = challenge.id;

    const [reports, verifications, matches, assignments, team, solutions, evidence, impact, gap, entries, checks, project] =
      await Promise.all([
        supabase
          .from("reports_public")
          .select("id, channel, district, village, lang, people_est, urgency, vulnerable, photo_urls, original_text, translated_text, created_at")
          .eq("cluster_id", challengeId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin()
          .from("verifications")
          .select("id, kind, method, note, evidence_url, source_urls, photo_paths, rejected_reason, created_at")
          .eq("challenge_id", challengeId)
          .order("created_at", { ascending: false }),
        supabase
          .from("matches")
          .select("org_id, score, reasons, status, organizations(name, type, district, verified)")
          .eq("challenge_id", challengeId)
          .order("score", { ascending: false })
          .limit(10),
        supabase
          .from("assignments")
          .select("org_id, role, accepted_at, organizations(name, type, district)")
          .eq("challenge_id", challengeId)
          .is("released_at", null),
        supabase.from("team_members").select("seat, filled, user_id, org_id").eq("challenge_id", challengeId),
        supabase
          .from("solutions")
          .select("id, title, approach, cost_estimate, deploy_days, risks, ratings, readiness, readiness_notes, status, created_at, organizations(name, type)")
          .eq("challenge_id", challengeId)
          .order("readiness", { ascending: false, nullsFirst: false }),
        supabase
          .from("evidence_files")
          .select("id, url, phase, caption, created_at")
          .eq("challenge_id", challengeId)
          .order("created_at", { ascending: true }),
        supabase.from("impact_records").select("*").eq("challenge_id", challengeId).maybeSingle(),
        challengeGap(supabase, challengeId),
        timeline(supabase, "challenge", challengeId, 200),
        supabaseAdmin()
          .from("external_checks")
          .select("provider, verdict, confidence, citations, reasoning, provider_error, model, checked_at")
          .eq("challenge_id", challengeId)
          .order("checked_at", { ascending: false })
          .limit(30),
        publicProject(challengeId),
      ]);

    const row = challenge as Record<string, unknown>;

    // The latest run per provider is the evidence; older runs are history.
    const latestChecks = new Map<string, Record<string, unknown>>();
    for (const c of checks.data ?? []) {
      if (!latestChecks.has(c.provider as string)) latestChecks.set(c.provider as string, c);
    }
    const external = [...latestChecks.values()];
    const supporting = external.filter((c) => c.verdict === "supports");

    // Field photos are evidence files; citizens and anonymous visitors see that they exist, not the files.
    const seesPhotos = Boolean(actor && actor.role !== "citizen");

    return ok({
      challenge: {
        ...row,
        band: priorityBand(Number(row.priority ?? 0)),
        // Every AI-assisted output carries this label, word for word.
        ai_disclaimer: AI_DISCLAIMER,
      },
      /** "31 reports from 12 villages", the line the cluster panel shows. */
      cluster: {
        reports: reports.data ?? [],
        report_count: row.report_count ?? 0,
        reporter_count: row.reporter_count ?? 0,
        villages: [...new Set((reports.data ?? []).map((r) => r.village).filter(Boolean))].length,
        photos: (reports.data ?? []).reduce((n, r) => n + (r.photo_urls?.length ?? 0), 0),
        via_sms: (reports.data ?? []).filter((r) => r.channel === "sms").length,
      },
      verifications: (verifications.data ?? []).map((v) => ({
        ...v,
        photo_paths: undefined,
        photo_count: ((v.photo_paths as string[]) ?? []).length,
        photos: seesPhotos ? ((v.photo_paths as string[]) ?? []).map((p) => fileUrl(p)) : [],
      })),
      external: {
        checked: external.length > 0,
        verdict: external.some((c) => c.verdict === "contradicts")
          ? "contradicts"
          : supporting.length > 0
            ? "supports"
            : "inconclusive",
        citation_count: supporting.reduce<number>((n, c) => n + ((c.citations as unknown[]) ?? []).length, 0),
        checks: external,
      },
      project,
      matches: matches.data ?? [],
      assignments: assignments.data ?? [],
      team: team.data ?? [],
      solutions: solutions.data ?? [],
      evidence: evidence.data ?? [],
      impact: impact.data ?? null,
      gap,
      timeline: readableTimeline(
        entries as Array<{ action: string; actor_role: string | null; payload: Record<string, unknown> | null; created_at: string }>,
      ),
      next_actions: actor ? (await availableActions(supabase, challengeId, actor.role)).actions : [],
      redacted: !isStaff,
    });
  },
);

/**
 * DELETE /api/challenges/:id - permanently delete a challenge/problem.
 * Restricted to administrators (statewide) and coordinators (own district).
 */
export const DELETE = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const actor = await requireRole("admin", "coordinator");
    const { id } = await params;
    const admin = supabaseAdmin();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const { data: challenge, error: findError } = await admin
      .from("challenges")
      .select("id, ref, title, district")
      .eq(isUuid ? "id" : "ref", id)
      .maybeSingle();

    if (findError) throw findError;
    if (!challenge) return fail(404, "No such challenge found.", "not_found");

    // Coordinators can only delete challenges within their assigned district
    if (actor.role === "coordinator" && actor.district && challenge.district !== actor.district) {
      return fail(
        403,
        `Coordinators can only delete problems in their own district (${actor.district}).`,
        "forbidden",
      );
    }

    // 1. Unlink clustered reports cleanly so reports are preserved
    await admin
      .from("reports")
      .update({ cluster_id: null })
      .eq("cluster_id", challenge.id);

    // 2. Unlink any other challenges merged into this one
    await admin
      .from("challenges")
      .update({ merged_into: null })
      .eq("merged_into", challenge.id);

    // 3. Delete the challenge (child rows cascade on delete)
    const { error: deleteError } = await admin
      .from("challenges")
      .delete()
      .eq("id", challenge.id);

    if (deleteError) throw deleteError;

    // 4. Record audit in ledger
    await appendLedger(admin, {
      entity: "challenge",
      entityId: challenge.id,
      action: "CHALLENGE_DELETED",
      actor: actor.id,
      actorRole: actor.role,
      payload: {
        ref: challenge.ref,
        title: challenge.title,
        district: challenge.district,
        deleted_by: actor.fullName ?? actor.id,
      },
    });

    return ok({
      deleted: true,
      id: challenge.id,
      ref: challenge.ref,
      title: challenge.title,
    });
  },
);

