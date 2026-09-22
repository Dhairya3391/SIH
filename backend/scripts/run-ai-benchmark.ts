import { evaluateBenchmark } from "../lib/ai/eval-benchmark";

async function main() {
  console.log("===============================================================================");
  console.log("   JharSetu (SIH26043) — Model & Classifier Ground-Truth Benchmark Evaluation");
  console.log("   Dataset: 50 team-written cases across Jharkhand (not collected from citizens)");
  console.log("===============================================================================\n");

  const started = Date.now();
  const metrics = evaluateBenchmark();
  const duration = Date.now() - started;

  console.log(`Scored the real offline Compiler on ${metrics.totalCases} team-written cases in ${duration}ms.\n`);
  console.log("OVERALL PERFORMANCE SUMMARY:");
  console.log(`  • Category accuracy:                  ${metrics.categoryAccuracyPct}%`);
  console.log(`  • Vulnerability tag F1:               ${metrics.vulnerabilityF1Pct}%`);
  console.log(`  • Dedup precision / recall:           ${metrics.deduplicationPrecisionPct}% / ${metrics.deduplicationRecallPct}%  (${metrics.duplicatePairs} duplicate pairs, offline embedding)`);
  console.log(`  • Composite Reliability Score:        ${metrics.overallScorePct}%\n`);

  console.log("CATEGORY-BY-CATEGORY BREAKDOWN:");
  console.log("-------------------------------------------------------------------------------");
  console.log(" Category                  | Evaluated | Correct | Accuracy");
  console.log("-------------------------------------------------------------------------------");
  for (const [cat, b] of Object.entries(metrics.categoryBreakdown)) {
    const padCat = cat.padEnd(26, " ");
    const padTotal = String(b.total).padStart(9, " ");
    const padCorrect = String(b.correct).padStart(7, " ");
    const padAcc = `${b.accuracy}%`.padStart(8, " ");
    console.log(` ${padCat}|${padTotal} |${padCorrect} | ${padAcc}`);
  }
  console.log("-------------------------------------------------------------------------------\n");

  console.log(`RESULT: ${metrics.categoryAccuracyPct}% category accuracy on this set.`);
  console.log("These are measured numbers for the offline path. With an AI key the");
  console.log("LLM answers first; see ml/RESULTS.md for the per-model breakdown.");
}

main().catch(console.error);
