import { ok, route, readQuery } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgContacts } from "@/lib/services/contacts";

const query = z.object({
  district: z.string().optional(),
  category: z.string().optional(),
  kind: z.enum(["money", "equipment", "people", "expertise"]).optional(),
  /** "materials" is everything that is not money; "funding" is money. */
  group: z.enum(["materials", "funding", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

/** Once work is complete or the problem is closed, its lines are no longer an opportunity. */
const FINISHED = ["DEPLOYED", "IMPACT_VERIFIED", "CLOSED_NOT_ACTIONABLE", "DUPLICATE"];

/**
 * GET /api/needs - the contribution board.
 *
 * Every line a college has published and not yet fully covered. Companies
 * read the material lines, NGOs the funding lines. Every line reports what
 * REMAINS, so two contributors can close one between them: 10 kg needed, 5 kg
 * taken, 5 kg left. A fully covered line leaves the board; the project stays
 * on each contributor's own page.
 *
 * Each line carries the college behind it and how to reach them.
 */
export const GET = route(async (request: Request) => {
  const actor = await requireRole("industry", "ngo", "university", "coordinator", "admin");
  const { district, category, kind, group, limit } = readQuery(request, query);
  const supabase = supabaseAdmin();

  const { data: needs, error } = await supabase
    .from("resource_needs")
    .select("id, challenge_id, item, qty_needed, unit, kind, capability, created_at")
    .order("created_at", { ascending: false })
    .limit(600);
  if (error) throw error;
  if (!needs || needs.length === 0) return ok({ needs: [], count: 0 });

  const challengeIds = [...new Set(needs.map((n) => n.challenge_id as string))];
  const [{ data: challenges }, { data: pledges }, { data: winners }, { data: stages }] = await Promise.all([
    supabase
      .from("challenges")
      .select("id, ref, title, district, category, priority, severity, status, people_est, created_at, verified_at")
      .in("id", challengeIds),
    supabase
      .from("pledges")
      .select("need_id, qty, state, status, org_id")
      .in("need_id", needs.map((n) => n.id as string)),
    supabase
      .from("proposals")
      .select("challenge_id, org_id, ai_score")
      .eq("state", "winner")
      .in("challenge_id", challengeIds),
    supabase.from("progress_stages").select("challenge_id, status").in("challenge_id", challengeIds),
  ]);
  const byId = new Map((challenges ?? []).map((c) => [c.id as string, c]));
  const winnerBy = new Map((winners ?? []).map((w) => [w.challenge_id as string, w]));
  const contacts = await orgContacts(supabase, (winners ?? []).map((w) => w.org_id as string));

  const pledgedByNeed = new Map<string, number>();
  const mineByNeed = new Map<string, number>();
  const contributorsByNeed = new Map<string, Set<string>>();
  for (const p of pledges ?? []) {
    const st = ((p.state as string) ?? (p.status as string) ?? "offered").toString();
    if (st === "withdrawn") continue;
    const k = p.need_id as string;
    pledgedByNeed.set(k, (pledgedByNeed.get(k) ?? 0) + Number(p.qty ?? 0));
    if (actor.orgId && p.org_id === actor.orgId) mineByNeed.set(k, (mineByNeed.get(k) ?? 0) + Number(p.qty ?? 0));
    if (!contributorsByNeed.has(k)) contributorsByNeed.set(k, new Set());
    contributorsByNeed.get(k)!.add(p.org_id as string);
  }

  const rows = needs
    .map((n) => {
      const challenge = byId.get(n.challenge_id as string);
      const needed = Number(n.qty_needed ?? 0);
      const pledged = pledgedByNeed.get(n.id as string) ?? 0;
      const remaining = Math.max(needed - pledged, 0);
      const won = winnerBy.get(n.challenge_id as string);
      const college = won ? (contacts.get(won.org_id as string) ?? null) : null;
      const cs = (stages ?? []).filter((s) => s.challenge_id === n.challenge_id);
      return {
        need_id: n.id as string,
        item: n.item as string,
        unit: n.unit as string | null,
        kind: n.kind as string,
        capability: n.capability as string | null,
        qty_needed: needed,
        qty_pledged: pledged,
        qty_remaining: remaining,
        pct_closed: needed > 0 ? Math.min(100, Math.round((pledged / needed) * 100)) : 100,
        contributor_count: contributorsByNeed.get(n.id as string)?.size ?? 0,
        my_pledged: mineByNeed.get(n.id as string) ?? 0,
        college,
        project: {
          proposal_score: (won?.ai_score as number) ?? null,
          stages_total: cs.length,
          stages_done: cs.filter((s) => s.status === "done").length,
        },
        challenge: challenge
          ? {
              id: challenge.id as string,
              ref: challenge.ref as string,
              title: challenge.title as string,
              district: challenge.district as string,
              category: challenge.category as string,
              status: challenge.status as string,
              priority: challenge.priority as number,
              people_est: challenge.people_est as number,
              age_days: Math.floor(
                (Date.now() - new Date(challenge.created_at as string).getTime()) / 86_400_000,
              ),
            }
          : null,
      };
    })
    .filter((r) => r.qty_remaining > 0 && r.challenge !== null && !FINISHED.includes(r.challenge.status))
    .filter((r) => group === "all" || (group === "funding" ? r.kind === "money" : r.kind !== "money"))
    .filter((r) => !district || r.challenge!.district === district)
    .filter((r) => !category || r.challenge!.category === category)
    .filter((r) => !kind || r.kind === kind)
    .sort((a, b) => b.challenge!.priority - a.challenge!.priority)
    .slice(0, limit);

  return ok({ needs: rows, count: rows.length });
});
