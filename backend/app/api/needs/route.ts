import { ok, route, readQuery } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const query = z.object({
  district: z.string().optional(),
  category: z.string().optional(),
  kind: z.enum(["money", "equipment", "people", "expertise"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

/**
 * GET /api/needs - the contribution marketplace.
 *
 * Open material lines and funding gaps across every challenge. Until this
 * existed a company could only pledge if it already knew which challenge to
 * open, which is not how a CSR team looks for something to fund.
 *
 * Every line reports what REMAINS, not what was originally asked for, so two
 * contributors can close one line between them: 12 units needed, 5 taken,
 * 7 left.
 */
export const GET = route(async (request: Request) => {
  await requireRole("industry", "university", "coordinator", "admin");
  const { district, category, kind, limit } = readQuery(request, query);
  const supabase = supabaseAdmin();

  const { data: needs, error } = await supabase
    .from("resource_needs")
    .select("id, challenge_id, item, qty_needed, unit, kind, capability, created_at")
    .limit(limit * 3);
  if (error) throw error;
  if (!needs || needs.length === 0) return ok({ needs: [], count: 0 });

  const challengeIds = [...new Set(needs.map((n) => n.challenge_id as string))];
  const { data: challenges } = await supabase
    .from("challenges")
    .select(
      "id, ref, title, district, category, priority, severity, status, people_est, created_at, closed_at",
    )
    .in("id", challengeIds);
  const byId = new Map((challenges ?? []).map((c) => [c.id as string, c]));

  const { data: pledges } = await supabase
    .from("pledges")
    .select("need_id, qty, state, status, org_id")
    .in(
      "need_id",
      needs.map((n) => n.id as string),
    );

  const pledgedByNeed = new Map<string, number>();
  const contributorsByNeed = new Map<string, Set<string>>();
  for (const p of pledges ?? []) {
    const st = ((p.state as string) ?? (p.status as string) ?? "offered").toString();
    if (st === "withdrawn") continue;
    const k = p.need_id as string;
    pledgedByNeed.set(k, (pledgedByNeed.get(k) ?? 0) + Number(p.qty ?? 0));
    if (!contributorsByNeed.has(k)) contributorsByNeed.set(k, new Set());
    contributorsByNeed.get(k)!.add(p.org_id as string);
  }

  const rows = needs
    .map((n) => {
      const challenge = byId.get(n.challenge_id as string);
      const needed = Number(n.qty_needed ?? 0);
      const pledged = pledgedByNeed.get(n.id as string) ?? 0;
      const remaining = Math.max(needed - pledged, 0);
      return {
        need_id: n.id as string,
        item: n.item as string,
        unit: n.unit as string | null,
        kind: n.kind as string,
        capability: n.capability as string | null,
        qty_needed: needed,
        qty_pledged: pledged,
        qty_remaining: remaining,
        pct_closed: needed > 0 ? Math.round((pledged / needed) * 100) : 100,
        contributor_count: contributorsByNeed.get(n.id as string)?.size ?? 0,
        challenge: challenge
          ? {
              id: challenge.id as string,
              ref: challenge.ref as string,
              title: challenge.title as string,
              district: challenge.district as string,
              category: challenge.category as string,
              priority: challenge.priority as number,
              people_est: challenge.people_est as number,
              age_days: Math.floor(
                (Date.now() - new Date(challenge.created_at as string).getTime()) / 86_400_000,
              ),
            }
          : null,
      };
    })
    // A closed line is not an opportunity, and a closed challenge is not either.
    .filter((r) => r.qty_remaining > 0 && r.challenge !== null)
    .filter((r) => !district || r.challenge!.district === district)
    .filter((r) => !category || r.challenge!.category === category)
    .filter((r) => !kind || r.kind === kind)
    .sort((a, b) => b.challenge!.priority - a.challenge!.priority)
    .slice(0, limit);

  return ok({ needs: rows, count: rows.length });
});
