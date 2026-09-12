import { ok, fail, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/reports/:id/trace - the pipeline trace panel.
 *
 * Judges cannot see AI unless you show it. This returns each step of the
 * Compiler with the time it actually took on this build, and says which steps
 * used a model and which fell back to deterministic code.
 */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const supabase = await supabaseServer();

    const { data: report, error } = await supabase
      .from("reports")
      .select("id, cluster_id, channel, processed_at, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!report) return fail(404, "No such report.", "not_found");

    // The trace was written to the ledger when the report was compiled or merged.
    const { data: entries } = await supabase
      .from("ledger")
      .select("action, payload, created_at")
      .eq("entity", "challenge")
      .eq("entity_id", report.cluster_id)
      .in("action", ["compiled", "report_merged", "brief_recompiled"])
      .order("id", { ascending: true });

    const own = (entries ?? []).find(
      (e) => (e.payload as Record<string, unknown>)?.report_id === id,
    );
    const payload = (own?.payload ?? {}) as Record<string, unknown>;
    const trace = (Array.isArray(payload.trace) ? payload.trace : []) as Array<{ ms?: number }>;

    return ok({
      report_id: id,
      challenge_id: report.cluster_id,
      channel: report.channel,
      action: own?.action ?? null,
      trace,
      total_ms: trace.reduce((sum, step) => sum + (step.ms ?? 0), 0),
      dedup: {
        decision: payload.decision ?? (own?.action === "report_merged" ? "merge" : null),
        reason: payload.reason ?? null,
        similarity: payload.similarity ?? null,
        distance_km: payload.distance_km ?? null,
      },
      processed_at: report.processed_at,
    });
  },
);
