/**
 * JharSetu's own trained report classifier, run in plain TypeScript.
 *
 * Trained in ml/classifier/train_classifier.py: character n-gram TF-IDF
 * (robust to Hinglish spellings like pani/paani/panee) feeding logistic
 * regression heads for category, severity, DM phase and each vulnerable group.
 * The weights ship as JSON, so this runs offline with no AI key and no Python.
 *
 * It is the middle tier of the cascade: LLM -> this model -> keyword rules.
 * Its measured accuracy is in ml/RESULTS.md; callers should only trust a
 * category at or above CONFIDENT.
 *
 * The featuriser mirrors scikit-learn's `char_wb` analyzer exactly; the parity
 * check in backend/scripts/check-classifier-parity.ts proves it.
 */
import model from "./models/report-classifier.json";
import type { Category, DmPhase, VulnerabilityTag } from "@/lib/domain/types";

/** At or above this, the category is trusted without a human flag. */
export const CONFIDENT = 0.7;
export const CLASSIFIER_VERSION = `report-classifier v${model.version}`;

interface MultiHead {
  labels: (string | number)[];
  coef: number[][];
  intercept: number[];
}
interface BinaryHead {
  coef: number[];
  intercept: number;
}
interface ModelFile {
  version: number;
  ngram: [number, number];
  vocab: Record<string, number>;
  idf: number[];
  heads: {
    category: MultiHead;
    severity: MultiHead;
    dm_phase: MultiHead;
    vulnerable: Record<string, BinaryHead>;
  };
}

const M = model as unknown as ModelFile;
const [MIN_N, MAX_N] = M.ngram;

/** scikit-learn char_wb: pad each whitespace-separated word with spaces, emit n-grams. */
function charWbNgrams(text: string): string[] {
  const out: string[] = [];
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const w = Array.from(` ${word} `); // code points, like Python str
    for (let n = MIN_N; n <= MAX_N; n++) {
      let offset = 0;
      out.push(w.slice(offset, offset + n).join(""));
      while (offset + n < w.length) {
        offset++;
        out.push(w.slice(offset, offset + n).join(""));
      }
      if (offset === 0) break; // a word shorter than n is counted once
    }
  }
  return out;
}

/** Sparse TF-IDF vector: sublinear tf, idf, L2-normalised. */
function vectorise(text: string): Map<number, number> {
  const counts = new Map<number, number>();
  for (const g of charWbNgrams(text.normalize("NFC").toLowerCase())) {
    const i = M.vocab[g];
    if (i !== undefined) counts.set(i, (counts.get(i) ?? 0) + 1);
  }
  let norm = 0;
  for (const [i, tf] of counts) {
    const v = (1 + Math.log(tf)) * M.idf[i];
    counts.set(i, v);
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [i, v] of counts) counts.set(i, v / norm);
  return counts;
}

function dot(x: Map<number, number>, coef: number[]): number {
  let s = 0;
  for (const [i, v] of x) s += v * coef[i];
  return s;
}

function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

function multi(x: Map<number, number>, h: MultiHead) {
  const p = softmax(h.coef.map((row, k) => dot(x, row) + h.intercept[k]));
  const ranked = p.map((prob, k) => ({ label: h.labels[k], prob })).sort((a, b) => b.prob - a.prob);
  return { label: ranked[0].label, confidence: ranked[0].prob, runnerUp: ranked[1], probs: p };
}

export interface Classification {
  category: Category;
  categoryConfidence: number;
  categoryRunnerUp: { label: Category; prob: number };
  severity: number;
  severityConfidence: number;
  dmPhase: DmPhase;
  dmPhaseConfidence: number;
  /** Probability per vulnerable group; >= 0.5 counts as detected. */
  vulnerable: Record<VulnerabilityTag, number>;
  /** False when the text shares no n-grams with training data at all. */
  hasSignal: boolean;
  ms: number;
}

export function classifyReport(text: string): Classification {
  const started = performance.now();
  const x = vectorise(text || "");
  const cat = multi(x, M.heads.category);
  const sev = multi(x, M.heads.severity);
  const phase = multi(x, M.heads.dm_phase);
  const vulnerable = {} as Record<VulnerabilityTag, number>;
  for (const [tag, h] of Object.entries(M.heads.vulnerable)) {
    vulnerable[tag as VulnerabilityTag] = 1 / (1 + Math.exp(-(dot(x, h.coef) + h.intercept)));
  }
  return {
    category: cat.label as Category,
    categoryConfidence: cat.confidence,
    categoryRunnerUp: { label: cat.runnerUp.label as Category, prob: cat.runnerUp.prob },
    severity: Number(sev.label),
    severityConfidence: sev.confidence,
    dmPhase: phase.label as DmPhase,
    dmPhaseConfidence: phase.confidence,
    vulnerable,
    hasSignal: x.size > 0,
    ms: Math.round((performance.now() - started) * 10) / 10,
  };
}

/** For the parity check: raw probabilities per head. */
export function classifyProbs(text: string) {
  const x = vectorise(text || "");
  return {
    category: multi(x, M.heads.category).probs,
    severity: multi(x, M.heads.severity).probs,
    dm_phase: multi(x, M.heads.dm_phase).probs,
  };
}
