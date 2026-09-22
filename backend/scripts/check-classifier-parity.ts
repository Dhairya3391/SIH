/**
 * Proves the TypeScript classifier gives the same probabilities as the Python
 * model it was exported from. Run after every re-train:
 *
 *   python ml/classifier/export_parity.py
 *   npx tsx scripts/check-classifier-parity.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyProbs } from "../lib/ai/trained-classifier";

type Row = { text: string; category: number[]; severity: number[]; dm_phase: number[] };
const rows: Row[] = JSON.parse(readFileSync(join(__dirname, "..", "..", "ml", "classifier", "parity.json"), "utf8"));

let worst = 0;
let argmaxMismatch = 0;
for (const r of rows) {
  const ts = classifyProbs(r.text);
  for (const head of ["category", "severity", "dm_phase"] as const) {
    const py = r[head];
    const js = ts[head];
    for (let k = 0; k < py.length; k++) worst = Math.max(worst, Math.abs(py[k] - js[k]));
    if (py.indexOf(Math.max(...py)) !== js.indexOf(Math.max(...js))) argmaxMismatch++;
  }
}
console.log(`${rows.length} texts, max |p_py - p_ts| = ${worst.toExponential(2)}, argmax mismatches = ${argmaxMismatch}`);
if (worst > 1e-3 || argmaxMismatch > 0) {
  console.error("PARITY FAILED");
  process.exit(1);
}
console.log("PARITY OK");
