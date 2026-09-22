import "server-only";
import { EMBEDDING_DIM, localEmbed, l2Normalise, toPgVector } from "./local-embed";
import { embedWithService, isModelServiceEnabled } from "./model-service";

/**
 * Embeddings, used for deduplication, the do-not-duplicate library, and the
 * capability-fit half of the matching score.
 *
 * Reports are translated to English before they are embedded, because mixing
 * languages inside one vector space makes duplicate detection unreliable. The
 * original text is kept for display; only the translation is embedded.
 *
 * Two backends, same 768-wide output: Gemini gemini-embedding-001 (truncated
 * to 768 dimensions, which matches the vector(768) columns), which has a
 * usable free tier, and the deterministic local vectoriser in ./local-embed,
 * which needs no network at all.
 */

export { EMBEDDING_DIM, localEmbed, toPgVector };

export type EmbeddingSource = "gemini" | "trained" | "local";

/**
 * Our own dedup model (ml/dedup, fine-tuned MiniLM) via the sidecar.
 *
 * Off by default and gated on its own flag, because vectors from different
 * models are not comparable: switching source without re-embedding every row
 * would silently break clustering. Turn it on, then re-seed or re-embed.
 */
export function isTrainedEmbeddingEnabled(): boolean {
  return process.env.ML_EMBEDDINGS === "true" && isModelServiceEnabled();
}

/** 384 dims from MiniLM into the DB's vector(768). Zeros do not change cosine. */
function padTo768(v: number[]): number[] {
  return v.length >= EMBEDDING_DIM ? v.slice(0, EMBEDDING_DIM) : [...v, ...new Array(EMBEDDING_DIM - v.length).fill(0)];
}

export interface EmbeddingResult {
  vector: number[];
  source: EmbeddingSource;
  ms: number;
}

export function isRemoteEmbeddingEnabled(): boolean {
  return process.env.AI_ENABLED !== "false" && Boolean(process.env.GEMINI_API_KEY);
}

export async function embed(text: string): Promise<EmbeddingResult> {
  const started = Date.now();
  const clean = text.trim();
  if (!clean) {
    return { vector: new Array(EMBEDDING_DIM).fill(0), source: "local", ms: 0 };
  }

  if (isTrainedEmbeddingEnabled()) {
    const own = await embedWithService([clean]).catch(() => null);
    if (own?.embeddings?.[0]) {
      return { vector: padTo768(own.embeddings[0]), source: "trained", ms: Date.now() - started };
    }
  }

  if (isRemoteEmbeddingEnabled()) {
    try {
      const vector = await geminiEmbed(clean);
      return { vector, source: "gemini", ms: Date.now() - started };
    } catch {
      // Fall through. A dead embedding API must never stop a report being filed.
    }
  }

  return { vector: localEmbed(clean), source: "local", ms: Date.now() - started };
}

export async function embedMany(texts: string[]): Promise<EmbeddingResult[]> {
  const out: EmbeddingResult[] = [];
  // Deliberately sequential with a small gap: free tiers rate-limit hard, and
  // a merge can re-embed a couple of hundred rows in one go.
  for (const t of texts) {
    out.push(await embed(t));
    if (isRemoteEmbeddingEnabled()) await new Promise((r) => setTimeout(r, 60));
  }
  return out;
}

async function geminiEmbed(text: string): Promise<number[]> {
  const key = process.env.GEMINI_API_KEY!;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: text.slice(0, 8000) }] },
        taskType: "SEMANTIC_SIMILARITY",
        // Matryoshka truncation: keep the DB's vector(768) shape.
        outputDimensionality: EMBEDDING_DIM,
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini embeddings returned ${res.status}`);

  const body = (await res.json()) as { embedding?: { values?: number[] } };
  const values = body.embedding?.values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(`Expected ${EMBEDDING_DIM} dimensions, got ${values?.length ?? 0}`);
  }
  return l2Normalise(values);
}
