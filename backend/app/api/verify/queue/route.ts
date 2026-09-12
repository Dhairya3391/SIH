import { ok, route, readQuery } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const query = z.object({
  district: z.string().optional(),
  hazard: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

/**
 * GET /api/verify/queue - the verifier desk.
 *
 * Reports that no human has confirmed yet, ranked, each carrying whatever the
 * AI corroboration engine found so a verifier sees the evidence before opening
 * anything. An externally corroborated report is still in this queue: the model
 * earns its own confidence rung and nothing more.
 */
export const GET = route(async (request: Request) => {
  await requireRole("verifier", "volunteer", "coordinator", "admin");
  const { district, hazard, limit } = readQuery(request, query);
  const supabase = supabaseAdmin();

  let q = supabase
    .from("challenges")
    .select(
      "id, ref, title, district, block, category, hazard_tags, severity, priority, confidence, status, people_est, report_count, reporter_count, brief, why_critical, created_at",
    )
    .in("confidence", ["unverified", "externally_corroborated", "community_corroborated"])
    .order("priority", { ascending: false })
    .limit(limit);

  if (district) q = q.eq("district", district);
  if (hazard) q = q.contains("hazard_tags", [hazard]);

  const { data: challenges, error } = await q;
  if (error) throw error;

  const ids = (challenges ?? []).map((c) => c.id as string);
  const checksByChallenge = new Map<string, unknown[]>();

  if (ids.length > 0) {
    const { data: checks } = await supabase
      .from("external_checks")
      .select("challenge_id, provider, verdict, confidence, citations, reasoning, provider_error, checked_at")
      .in("challenge_id", ids)
      .order("checked_at", { ascending: false });
    for (const c of checks ?? []) {
      const key = c.challenge_id as string;
      if (!checksByChallenge.has(key)) checksByChallenge.set(key, []);
      checksByChallenge.get(key)!.push(c);
    }
  }

  const rows = (challenges ?? []).map((c) => {
    const checks = checksByChallenge.get(c.id as string) ?? [];
    const supporting = checks.filter(
      (x) => (x as { verdict?: string }).verdict === "supports",
    );
    const contradicting = checks.filter(
      (x) => (x as { verdict?: string }).verdict === "contradicts",
    );
    return {
      ...c,
      external: {
        checked: checks.length > 0,
        // A contradiction is a flag for the verifier to weigh, never a rejection.
        verdict: contradicting.length > 0 ? "contradicts" : supporting.length > 0 ? "supports" : "inconclusive",
        citation_count: supporting.reduce<number>(
          (n, x) => n + ((x as { citations?: unknown[] }).citations?.length ?? 0),
          0,
        ),
        checks,
      },
    };
  });

  return ok({ queue: rows, count: rows.length });
});
