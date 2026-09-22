import { evaluateBenchmark } from "../lib/ai/eval-benchmark";

async function main() {
  console.log("===============================================================================");
  console.log("   JharSetu (SIH26043) — Model & Classifier Ground-Truth Benchmark Evaluation");
  console.log("   Dataset: 50 Human-Verified Field Incident Cases across Jharkhand's 24 Districts");
  console.log("===============================================================================\n");

  const started = Date.now();
  const metrics = evaluateBenchmark();
  const duration = Date.now() - started;

  console.log(`Evaluated ${metrics.totalCases} authentic incident reports in ${duration}ms.\n`);
  console.log("OVERALL PERFORMANCE SUMMARY:");
  console.log(`  • Category Classification Accuracy:  ${metrics.categoryAccuracyPct}%  (Target: >= 95%)`);
  console.log(`  • Vulnerability Entity Extraction F1: ${metrics.vulnerabilityF1Pct}%  (Target: >= 92%)`);
  console.log(`  • Semantic Deduplication Precision:   ${metrics.deduplicationPrecisionPct}%  (Target: >= 95%)`);
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

  if (metrics.categoryAccuracyPct >= 95.0) {
    console.log("RESULT: BENCHMARK PASSED WITH EXCELLENCE (>=95% Accuracy achieved).");
  } else {
    console.log(`RESULT: BENCHMARK COMPLETED with ${metrics.categoryAccuracyPct}% accuracy.`);
  }
}

main().catch(console.error);
