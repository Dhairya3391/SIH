import { ok, fail, route } from "@/lib/http";
import { supabaseServer, currentActor } from "@/lib/supabase/server";
import { priorityBand } from "@/lib/domain/types";
import { AI_DISCLAIMER } from "@/lib/ai/brief";
import { challengeGap } from "@/lib/services/swarm";
import { availableActions } from "@/lib/services/lifecycle";
import { timeline } from "@/lib/services/ledger";

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

    const { data: challenge, error } = await supabase
      .from(isStaff ? "challenges" : "challenges_public")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!challenge) return fail(404, "No such challenge.", "not_found");

    const [reports, verifications, matches, assignments, team, solutions, evidence, impact, gap, entries] =
      await Promise.all([
        supabase
          .from("reports_public")
          .select("id, channel, district, village, lang, people_est, urgency, vulnerable, photo_urls, original_text, translated_text, created_at")
          .eq("cluster_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("verifications")
          .select("id, kind, note, evidence_url, created_at")
          .eq("challenge_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("matches")
          .select("org_id, score, reasons, status, organizations(name, type, district, verified)")
          .eq("challenge_id", id)
          .order("score", { ascending: false })
          .limit(10),
        supabase
          .from("assignments")
          .select("org_id, role, accepted_at, organizations(name, type, district)")
          .eq("challenge_id", id)
          .is("released_at", null),
        supabase.from("team_members").select("seat, filled, user_id, org_id").eq("challenge_id", id),
        supabase
          .from("solutions")
          .select("id, title, approach, cost_estimate, deploy_days, risks, ratings, readiness, readiness_notes, status, created_at, organizations(name, type)")
          .eq("challenge_id", id)
          .order("readiness", { ascending: false, nullsFirst: false }),
        supabase
          .from("evidence_files")
          .select("id, url, phase, caption, created_at")
          .eq("challenge_id", id)
          .order("created_at", { ascending: true }),
        supabase.from("impact_records").select("*").eq("challenge_id", id).maybeSingle(),
        challengeGap(supabase, id),
        timeline(supabase, "challenge", id, 60),
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
      next_actions: actor ? (await availableActions(supabase, id, actor.role)).actions : [],
      redacted: !isStaff,
    });
  },
);
