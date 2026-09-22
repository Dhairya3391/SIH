/**
 * Offline Compiler accuracy: keyword rules alone vs keyword rules + our trained
 * classifier, on the frozen hand-written test set. No AI key involved.
 *
 *   npx tsx scripts/eval-compiler-offline.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileWithRules } from "../lib/ai/fallback";

type Row = { text: string; category: string; severity: number; dm_phase: string; vulnerable: string[] };
const file = process.argv[2] ?? join(__dirname, "..", "..", "ml", "classifier", "testset_v2_frozen.jsonl");
const rows: Row[] = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));

function run(useTrainedModel: boolean) {
  let cat = 0, phase = 0, sev1 = 0, flagged = 0, flaggedWrong = 0, unflaggedWrong = 0;
  for (const r of rows) {
    const b = compileWithRules({ text: r.text, useTrainedModel });
    const ok = b.category === r.category;
    cat += +ok;
    phase += +(b.dm_phase === r.dm_phase);
    sev1 += +(Math.abs(b.severity - r.severity) <= 1);
    const isFlagged = b.uncertainties.some((u) => /category is uncertain|No category keyword matched/.test(u));
    flagged += +isFlagged;
    if (!ok && isFlagged) flaggedWrong++;
    if (!ok && !isFlagged) unflaggedWrong++;
  }
  const pct = (n: number) => `${((100 * n) / rows.length).toFixed(1)}%`;
  return {
    category: pct(cat), dm_phase: pct(phase), severity_within_1: pct(sev1),
    category_flagged_for_review: pct(flagged),
    wrong_but_flagged: flaggedWrong, wrong_and_not_flagged: unflaggedWrong,
  };
}

console.log(`${rows.length} reports from ${file}`);
console.table({ "keyword rules only": run(false), "rules + trained classifier": run(true) });
