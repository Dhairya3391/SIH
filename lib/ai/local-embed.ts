/**
 * The deterministic local embedding, with no network call and no server-only
 * guard, so the seed script and any test can use it directly.
 *
 * This is not a token gesture. It is what runs at the H9 checkpoint, when the
 * whole golden path has to work with no AI calls at all, and it is what keeps
 * clustering alive if the embedding API is rate-limited on stage. It is weaker
 * than a real model on paraphrase, and strong on the near-duplicate wording we
 * actually see when thirty people report the same blocked culvert.
 */

export const EMBEDDING_DIM = 768;

/** FNV-1a, 32-bit. Fast, stable across runs, and good enough for bucketing. */
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Words that carry no signal about *which* problem this is. Deliberately short:
 * over-trimming hurts more than it helps at this scale. Hindi stopwords are
 * included because plain SMS often arrives untranslated.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "of", "to", "for",
  "and", "or", "but", "we", "our", "us", "it", "this", "that", "there", "here",
  "has", "have", "had", "be", "been", "with", "from", "by", "as", "not", "no",
  "hai", "hain", "ka", "ki", "ke", "ko", "se", "me", "mein", "aur", "bhi", "hi",
  "ye", "yeh", "wo", "woh", "par", "nahi", "kya", "hum", "hamara", "hamare",
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * A hashing vectoriser over word unigrams, word bigrams and character 4-grams.
 * The character n-grams are what make it tolerant of the spelling variation you
 * get in transliterated Hindi, where "pani" and "paani" are the same word.
 */
export function localEmbed(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  const tokens = tokenise(text);

  const bump = (feature: string, weight: number) => {
    const h = hash32(feature);
    const idx = h % EMBEDDING_DIM;
    // The top bit decides the sign, which stops unrelated collisions from
    // always accumulating in the same direction.
    vec[idx] += (h & 0x80000000 ? -1 : 1) * weight;
  };

  for (const token of tokens) bump(`w:${token}`, 1);
  for (let i = 0; i + 1 < tokens.length; i++) bump(`b:${tokens[i]}_${tokens[i + 1]}`, 1.4);

  const joined = tokens.join(" ");
  for (let i = 0; i + 4 <= joined.length; i++) bump(`c:${joined.slice(i, i + 4)}`, 0.35);

  return l2Normalise(Array.from(vec));
}

export function l2Normalise(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

/** pgvector accepts a literal in this shape. */
export function toPgVector(v: number[]): string {
  return `[${v.map((x) => (Number.isFinite(x) ? x.toFixed(6) : "0")).join(",")}]`;
}
