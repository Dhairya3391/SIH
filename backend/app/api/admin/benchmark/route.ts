import { ok, route } from "@/lib/http";
import { evaluateBenchmark } from "@/lib/ai/eval-benchmark";

/**
 * GET /api/admin/benchmark
 *
 * Runs the live ground-truth evaluation benchmark against the 50 curated
 * Jharkhand field incidents, returning verified accuracy, F1, and confusion matrix.
 */
export const GET = route(async () => {
  const metrics = evaluateBenchmark();
  return ok(metrics);
});
