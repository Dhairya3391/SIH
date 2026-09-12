import { ok, fail, route } from "@/lib/http";
import { supabaseServer, currentActor, requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { priorityBand } from "@/lib/domain/types";
import { AI_DISCLAIMER } from "@/lib/ai/brief";
import { challengeGap } from "@/lib/services/swarm";
import { availableActions } from "@/lib/services/lifecycle";
import { timeline, appendLedger } from "@/lib/services/ledger";

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

    const [reports, verifications, matches, assignments, team, solutions, evidence, impact, gap, entries] =
      await Promise.all([
        supabase
          .from("reports_public")
          .select("id, channel, district, village, lang, people_est, urgency, vulnerable, photo_urls, original_text, translated_text, created_at")
          .eq("cluster_id", challengeId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("verifications")
          .select("id, kind, note, evidence_url, created_at")
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
        timeline(supabase, "challenge", challengeId, 60),
      ]);

    const row = challenge as Record<string, unknown>;

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
      verifications: verifications.data ?? [],
      matches: matches.data ?? [],
      assignments: assignments.data ?? [],
      team: team.data ?? [],
      solutions: solutions.data ?? [],
      evidence: evidence.data ?? [],
      impact: impact.data ?? null,
      gap,
      timeline: entries,
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

