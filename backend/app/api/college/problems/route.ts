import { ok, route, readQuery } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opportunisticTick } from "@/lib/services/tick";
import { OPEN_FOR_PROPOSALS } from "@/lib/domain/types";

const query = z.object({
  district: z.string().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

/** Verified by the AI with sources, by a verifier, or by a coordinator. */
const LISTED_CONFIDENCE = ["externally_corroborated", "field_verified", "coordinator_approved"];

/**
 * GET /api/college/problems - what a college may propose against.
 *
 * The filter IS the feature: verified only, and not yet awarded. A college
 * never sees an unverified report, because a proposal written against a
 * report that turns out to be wrong wastes a semester of student work. Once a
 * problem is awarded it leaves this list.
 *
 * Each row carries how it was verified, the competition state, and whether
 * this college already has something in.
 */
export const GET = route(async (request: Request) => {
  const actor = await requireRole("university", "coordinator", "admin");
  const { district, category, limit } = readQuery(request, query);
  const supabase = supabaseAdmin();

  // This is the page that shows "closes in 4 hours", so it must not be lying.
  await opportunisticTick(supabase);

  let q = supabase
    .from("challenges")
    .select(
      "id, ref, title, district, block, category, dm_phase, severity, priority, confidence, status, people_est, report_count, reporter_count, brief, why_critical, capabilities, hazard_tags, created_at, verified_at",
    )
    .in("confidence", LISTED_CONFIDENCE)
    .in("status", OPEN_FOR_PROPOSALS)
    .order("priority", { ascending: false })
    .limit(limit);

  if (district) q = q.eq("district", district);
  if (category) q = q.eq("category", category);

  const { data: challenges, error } = await q;
  if (error) throw error;

  const ids = (challenges ?? []).map((c) => c.id as string);
  const windows = new Map<string, Record<string, unknown>>();
  const mine = new Map<string, Record<string, unknown>>();
  const verifiedBy = new Map<string, { method: string; sources: number; photos: number; at: string }>();

  if (ids.length > 0) {
    const [{ data: w }, { data: verifs }] = await Promise.all([
      supabase.from("proposal_competition_public").select("*").in("challenge_id", ids),
      supabase
        .from("verifications")
        .select("challenge_id, kind, method, source_urls, photo_paths, created_at")
        .in("challenge_id", ids)
        .order("created_at", { ascending: false }),
    ]);
    for (const row of w ?? []) windows.set(row.challenge_id as string, row);
    for (const v of verifs ?? []) {
      const key = v.challenge_id as string;
      const positive = v.method === "ai_external" || v.method === "coordinator" || v.kind === "field";
      if (!positive || verifiedBy.has(key)) continue;
      verifiedBy.set(key, {
        method: v.method === "ai_external" ? "ai" : v.method === "coordinator" ? "coordinator" : "verifier",
        sources: ((v.source_urls as string[]) ?? []).length,
        photos: ((v.photo_paths as string[]) ?? []).length,
        at: v.created_at as string,
      });
    }

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
      verification: verifiedBy.get(c.id as string) ?? null,
      competition: w
        ? {
            state: w.state,
            opened_at: w.opened_at,
            closes_at: w.closes_at,
            window_days: w.window_days,
            // The leading SCORE is public; the leading document and college are not, until award.
            leader_score: leaderScore,
            proposal_count: w.proposal_count,
            reopen_count: w.reopen_count,
          }
        : { state: "not_opened" },
      my_proposal: own
        ? {
            id: own.id,
            version: own.version,
            state: own.state,
            score: myScore,
            verdict: own.ai_verdict,
            is_leading:
              leaderScore !== null && myScore !== null && own.ai_verdict === "viable" ? myScore >= leaderScore : null,
          }
        : null,
    };
  });

  return ok({ problems: rows, count: rows.length });
});
