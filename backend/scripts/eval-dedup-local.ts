/**
 * Baseline for ml/dedup: the current offline embedding (local hashing
 * vectoriser) scored on the frozen hand-written pair set, same metrics as
 * ml/dedup/train_dedup.py.
 *
 *   npx tsx scripts/eval-dedup-local.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { localEmbed } from "../lib/ai/local-embed";

type Row = { group: number; category: string; a: string; b: string };
const rows: Row[] = readFileSync(join(__dirname, "..", "..", "ml", "dedup", "testset_pairs_frozen.jsonl"), "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));

const cos = (x: number[], y: number[]) => {
  let d = 0, nx = 0, ny = 0;
  for (let i = 0; i < x.length; i++) { d += x[i] * y[i]; nx += x[i] * x[i]; ny += y[i] * y[i]; }
  return d / (Math.sqrt(nx * ny) || 1);
};

const pairs: { s: number; y: number; hard: boolean }[] = [];
for (const r of rows) pairs.push({ s: cos(localEmbed(r.a), localEmbed(r.b)), y: 1, hard: false });
for (const r of rows) for (const q of rows) {
  if (r.group !== q.group) pairs.push({ s: cos(localEmbed(r.a), localEmbed(q.b)), y: 0, hard: r.category === q.category });
}

function at(th: number) {
  const tp = pairs.filter((p) => p.s >= th && p.y === 1).length;
  const fp = pairs.filter((p) => p.s >= th && p.y === 0).length;
  return { threshold: th, precision: +(tp / Math.max(1, tp + fp)).toFixed(3), recall: +(tp / rows.length).toFixed(3),
    false_merges: fp, false_merges_same_category: pairs.filter((p) => p.s >= th && p.y === 0 && p.hard).length };
}
function auc(ps: typeof pairs) {
  const pos = ps.filter((p) => p.y === 1), neg = ps.filter((p) => p.y === 0);
  let wins = 0;
  for (const a of pos) for (const b of neg) wins += a.s > b.s ? 1 : a.s === b.s ? 0.5 : 0;
  return +(wins / (pos.length * neg.length)).toFixed(4);
}
const res = {
  model: "local hashing vectoriser (current offline dedup)",
  positives: rows.length, negatives: pairs.length - rows.length, hard_negatives: pairs.filter((p) => p.hard).length,
  roc_auc: auc(pairs), roc_auc_hard_only: auc(pairs.filter((p) => p.y === 1 || p.hard)),
  "at_0.85": at(0.85), "at_0.75": at(0.75),
  mean_similarity_same_problem: +(pairs.filter((p) => p.y === 1).reduce((a, p) => a + p.s, 0) / rows.length).toFixed(3),
};
console.log(JSON.stringify(res, null, 1));
writeFileSync(join(__dirname, "..", "..", "ml", "dedup", "baseline_local.json"), JSON.stringify(res, null, 1));
