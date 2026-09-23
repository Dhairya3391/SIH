/** Export the 50 benchmark cases so the Python models can be scored on them too. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { GROUND_TRUTH_BENCHMARK } from "../lib/ai/eval-benchmark";

const out = GROUND_TRUTH_BENCHMARK.map((b) =>
  JSON.stringify({ text: b.text, category: b.expectedCategory, severity: b.expectedSeverity, vulnerable: b.expectedVulnerable }),
).join("\n");
const path = join(__dirname, "..", "..", "ml", "classifier", "testset_team50.jsonl");
writeFileSync(path, out + "\n", "utf8");
console.log(`wrote ${GROUND_TRUTH_BENCHMARK.length} cases -> ${path}`);
