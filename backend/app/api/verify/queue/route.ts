import { ok, route, readQuery } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AWAITING_VERIFICATION, UNVERIFIED_CONFIDENCE } from "@/lib/domain/types";

const query = z.object({
  district: z.string().optional(),
  hazard: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

/**
 * GET /api/verify/queue - the verifier desk.
 *
 * Problems nobody has verified yet, ranked, each carrying whatever the AI
 * corroboration found so a verifier sees the evidence before opening anything.
 * A problem the AI verified with cited sources has already left this queue and
 * opened to colleges; those appear in `recently_verified_by_ai`, so a verifier
 * can audit them and overturn any that do not stand.
 */
export const GET = route(async (request: Request) => {
  await requireRole("verifier", "volunteer", "coordinator", "admin");
  const { district, hazard, limit } = readQuery(request, query);
  const supabase = supabaseAdmin();

  const COLUMNS =
    "id, ref, title, district, block, category, hazard_tags, severity, priority, confidence, status, people_est, report_count, reporter_count, brief, why_critical, created_at, verified_at";

  let q = supabase
    .from("challenges")
    .select(COLUMNS)
    .in("confidence", UNVERIFIED_CONFIDENCE)
    .in("status", AWAITING_VERIFICATION)
    .order("priority", { ascending: false })
    .limit(limit);
  if (district) q = q.eq("district", district);
  if (hazard) q = q.contains("hazard_tags", [hazard]);

  const { data: challenges, error } = await q;
  if (error) throw error;

  // What the AI verified on its own in the last fortnight, for audit.
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data: aiRows } = await supabase
    .from("verifications")
    .select("challenge_id, source_urls, note, created_at")
    .eq("method", "ai_external")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(30);
  const aiIds = [...new Set((aiRows ?? []).map((r) => r.challenge_id as string))];
  const { data: aiChallenges } = aiIds.length
    ? await supabase.from("challenges").select(COLUMNS).in("id", aiIds)
    : { data: [] as Record<string, unknown>[] };
  const aiById = new Map((aiChallenges ?? []).map((c) => [c.id as string, c]));

  const ids = [...(challenges ?? []).map((c) => c.id as string), ...aiIds];
  const checksByChallenge = new Map<string, unknown[]>();
  if (ids.length > 0) {
    const { data: checks } = await supabase
      .from("external_checks")
      .select("challenge_id, provider, verdict, confidence, citations, reasoning, provider_error, model, checked_at")
      .in("challenge_id", ids)
      .order("checked_at", { ascending: false });
    for (const c of checks ?? []) {
      const key = c.challenge_id as string;
      if (!checksByChallenge.has(key)) checksByChallenge.set(key, []);
      checksByChallenge.get(key)!.push(c);
    }
  }

  const summarise = (challengeId: string) => {
    // Only the most recent run per provider; older runs are history, not evidence.
    const all = (checksByChallenge.get(challengeId) ?? []) as Array<{ provider?: string; verdict?: string; citations?: unknown[] }>;
    const latest = new Map<string, (typeof all)[number]>();
    for (const c of all) if (c.provider && !latest.has(c.provider)) latest.set(c.provider, c);
    const checks = [...latest.values()];
    const supporting = checks.filter((x) => x.verdict === "supports");
    const contradicting = checks.filter((x) => x.verdict === "contradicts");
    return {
      checked: checks.length > 0,
      // A contradiction is a flag for the verifier to weigh, never a rejection.
      verdict: contradicting.length > 0 ? "contradicts" : supporting.length > 0 ? "supports" : "inconclusive",
      citation_count: supporting.reduce<number>((n, x) => n + (x.citations?.length ?? 0), 0),
      checks,
    };
  };

  const rows = (challenges ?? []).map((c) => ({ ...c, external: summarise(c.id as string) }));

  const recentlyVerifiedByAi = aiIds
    .map((cid) => {
      const c = aiById.get(cid);
      const v = (aiRows ?? []).find((r) => r.challenge_id === cid);
      if (!c) return null;
      return {
        ...c,
        external: summarise(cid),
        ai_verification: {
          sources: (v?.source_urls as string[]) ?? [],
          note: (v?.note as string) ?? null,
          at: (v?.created_at as string) ?? null,
        },
      };
    })
    .filter(Boolean);

  return ok({ queue: rows, count: rows.length, recently_verified_by_ai: recentlyVerifiedByAi });
});
