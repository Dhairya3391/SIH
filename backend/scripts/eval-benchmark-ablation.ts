/**
 * What does our trained classifier add on the 50-case benchmark?
 * Same cases, same code path, trained model on vs off.
 *
 *   npx tsx scripts/eval-benchmark-ablation.ts
 */
import { GROUND_TRUTH_BENCHMARK } from "../lib/ai/eval-benchmark";
import { compileWithRules } from "../lib/ai/fallback";

function run(useTrainedModel: boolean) {
  let cat = 0;
  let tp = 0, fp = 0, fn = 0;
  for (const b of GROUND_TRUTH_BENCHMARK) {
    const brief = compileWithRules({ text: b.text, useTrainedModel });
    if (brief.category === b.expectedCategory) cat++;
    const pred = new Set(brief.vulnerable as string[]);
    for (const t of pred) (b.expectedVulnerable.includes(t) ? tp++ : fp++);
    for (const t of b.expectedVulnerable) if (!pred.has(t)) fn++;
  }
  const p = tp / (tp + fp || 1), r = tp / (tp + fn || 1);
  return {
    category: `${((100 * cat) / GROUND_TRUTH_BENCHMARK.length).toFixed(1)}%`,
    vulnerable_f1: `${((200 * p * r) / (p + r || 1)).toFixed(1)}%`,
  };
}

console.log(`${GROUND_TRUTH_BENCHMARK.length} team-written cases, offline path (no AI key)`);
console.table({ "keyword rules only": run(false), "rules + trained classifier": run(true) });
