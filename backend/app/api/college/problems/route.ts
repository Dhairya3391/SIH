import { ok, route, readQuery } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const query = z.object({
  district: z.string().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

/**
 * GET /api/college/problems - what a college may propose against.
 *
 * The filter IS the feature: verified only. A college must never see an
 * unverified report, because a proposal written against a report that turns
 * out to be wrong wastes a semester of student work.
 *
 * Each row carries the competition state - whether a window is open, when it
 * closes, the leading score, and whether this college already has something
 * in - because that is what a college actually decides on.
 */
export const GET = route(async (request: Request) => {
  const actor = await requireRole("university", "coordinator", "admin");
  const { district, category, limit } = readQuery(request, query);
  const supabase = supabaseAdmin();

  let q = supabase
    .from("challenges")
    .select(
      "id, ref, title, district, block, category, dm_phase, severity, priority, confidence, status, people_est, report_count, brief, why_critical, capabilities, hazard_tags, created_at, verified_at",
    )
    .in("confidence", ["field_verified", "coordinator_approved"])
    .in("status", ["VERIFIED", "OPEN", "TEAM_FORMED"])
    .order("priority", { ascending: false })
    .limit(limit);

  if (district) q = q.eq("district", district);
  if (category) q = q.eq("category", category);

  const { data: challenges, error } = await q;
  if (error) throw error;

  const ids = (challenges ?? []).map((c) => c.id as string);
  const windows = new Map<string, Record<string, unknown>>();
  const mine = new Map<string, Record<string, unknown>>();

  if (ids.length > 0) {
    // The competition view is tolerant of the migration not being applied yet:
    // without it, every problem simply reads as "no window opened".
    const { data: w } = await supabase
      .from("proposal_competition_public")
      .select("*")
      .in("challenge_id", ids);
    for (const row of w ?? []) windows.set(row.challenge_id as string, row);

    if (actor.orgId) {
      const { data: own } = await supabase
        .from("proposals")
        .select("id, challenge_id, version, state, ai_score, ai_verdict")
        .in("challenge_id", ids)
        .eq("org_id", actor.orgId)
        .order("version", { ascending: false });
      for (const row of own ?? []) {
        if (!mine.has(row.challenge_id as string)) mine.set(row.challenge_id as string, row);
      }
    }
  }

  const rows = (challenges ?? []).map((c) => {
    const w = windows.get(c.id as string);
    const own = mine.get(c.id as string);
    const leaderScore = typeof w?.leader_score === "number" ? (w.leader_score as number) : null;
    const myScore = typeof own?.ai_score === "number" ? (own.ai_score as number) : null;
    return {
      ...c,
      competition: w
        ? {
            state: w.state,
            opened_at: w.opened_at,
            closes_at: w.closes_at,
            window_days: w.window_days,
            // The leading SCORE is public; the leading document and the leading
            // college's name are not, until the window closes.
            leader_score: leaderScore,
            proposal_count: w.proposal_count,
          }
        : { state: "not_opened" },
      my_proposal: own
        ? {
            id: own.id,
            version: own.version,
            state: own.state,
            score: myScore,
            verdict: own.ai_verdict,
            is_leading: leaderScore !== null && myScore !== null ? myScore >= leaderScore : null,
          }
        : null,
    };
  });

  return ok({ problems: rows, count: rows.length });
});
