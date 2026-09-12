import { ok, route, readQuery } from "@/lib/http";
import { challengeListSchema } from "@/lib/validation/schemas";
import { supabaseServer, currentActor } from "@/lib/supabase/server";
import { priorityBand } from "@/lib/domain/types";

/** What the list view returns. The public variant swaps geom for geom_fuzzed. */
interface ChallengeListRow {
  id: string;
  ref: string | null;
  priority: number;
  [key: string]: unknown;
}

/**
 * GET /api/challenges - the coordinator queue, the map and the public board.
 *
 * Anonymous and partner callers read the redacted view, where locations are
 * fuzzed to roughly 500 m and reporter details are gone. Coordinators and
 * admins read the table itself, with exact coordinates. That distinction is
 * enforced in Postgres, not here; this route just picks the right source.
 */
export const GET = route(async (request: Request) => {
  const query = readQuery(request, challengeListSchema);
  const actor = await currentActor();
  const supabase = await supabaseServer();

  const isStaff = actor?.role === "coordinator" || actor?.role === "admin";
  const source = isStaff ? "challenges" : "challenges_public";

  // Kept as plain `string` on purpose. supabase-js parses select literals at the
  // type level, and two long alternatives blow past the instantiation depth
  // limit. Widening costs us nothing here: the rows are shaped by the view.
  const columns: string = isStaff
    ? "id, ref, region_id, title, category, dm_phase, district, block, people_est, severity, priority, score_breakdown, why_critical, confidence, status, mode, capabilities, hazard_tags, report_count, reporter_count, ai_uncertainties, is_simulated, created_at, updated_at"
    : "id, ref, region_id, title, category, dm_phase, district, block, geom_fuzzed, people_est, severity, priority, score_breakdown, why_critical, confidence, status, mode, capabilities, hazard_tags, report_count, reporter_count, ai_uncertainties, is_simulated, created_at, updated_at";

  let builder = supabase
    .from(source)
    .select(columns, { count: "exact" })
    .order("priority", { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);

  if (query.region_id) builder = builder.eq("region_id", query.region_id);
  if (query.district) builder = builder.eq("district", query.district);
  if (query.category) builder = builder.eq("category", query.category);
  if (query.status) builder = builder.eq("status", query.status);
  if (query.mode) builder = builder.eq("mode", query.mode);
  if (query.q) builder = builder.ilike("title", `%${query.q}%`);

  // Bands are the map legend: critical 75+, high 50-74, moderate 25-49,
  // long-term below 25.
  if (query.band) {
    const ranges: Record<string, [number, number]> = {
      critical: [75, 100],
      high: [50, 74],
      moderate: [25, 49],
      long_term: [0, 24],
    };
    const [lo, hi] = ranges[query.band];
    builder = builder.gte("priority", lo).lte("priority", hi);
  }

  const { data, error, count } = await builder;
  if (error) throw error;

  // The select list is a runtime string, so the row shape is asserted here.
  let rows = (data ?? []) as unknown as ChallengeListRow[];

  // Filtering by the organisation assigned to a challenge needs a second pass,
  // because the view does not carry assignments.
  if (query.org_id) {
    const { data: assigned } = await supabase
      .from("assignments")
      .select("challenge_id")
      .eq("org_id", query.org_id)
      .is("released_at", null);
    const ids = new Set((assigned ?? []).map((a) => a.challenge_id));
    rows = rows.filter((r) => ids.has(r.id));
  }

  return ok({
    challenges: rows.map((r) => ({ ...r, band: priorityBand(r.priority ?? 0) })),
    total: count ?? rows.length,
    limit: query.limit,
    offset: query.offset,
    /** True when the caller is seeing fuzzed locations and redacted fields. */
    redacted: !isStaff,
  });
});
