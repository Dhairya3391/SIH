import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Every LLM call in JharSetu goes through this file.
 *
 * That is deliberate: the provider can be swapped in about five minutes, the
 * demo cache lives in one place, and there is exactly one spot where "the AI is
 * unavailable" is decided. Callers never talk to a vendor SDK directly, and
 * every caller is expected to have a deterministic fallback to run instead.
 *
 * Models come from the playbook: Haiku 4.5 for fast extraction, Sonnet 5 for
 * drafting the brief. Both are overridable through the environment.
 */

export const MODEL_FAST = process.env.LLM_MODEL_FAST || "claude-haiku-4-5";
export const MODEL_DRAFT = process.env.LLM_MODEL_DRAFT || "claude-sonnet-5";

/** Thrown whenever the model could not be reached or returned nothing usable. */
export class AiUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * The kill switch. Setting AI_ENABLED=false makes every call throw
 * AiUnavailableError, so the whole platform drops to its rule-based path.
 * This is what we flip on stage when a judge asks what happens if the AI dies.
 */
export function isAiEnabled(): boolean {
  if (process.env.AI_ENABLED === "false") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

// ---------------------------------------------------------------------------
// Demo cache
// ---------------------------------------------------------------------------
// The playbook's non-negotiable: AI responses are cached for the exact demo
// inputs, so a slow API cannot kill the demo. Reads are always allowed; writes
// only happen when we are deliberately warming the cache.

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "llm-responses.json");

type CacheMap = Record<string, unknown>;
let cacheMemo: CacheMap | null = null;

async function loadCache(): Promise<CacheMap> {
  if (cacheMemo) return cacheMemo;
  try {
    cacheMemo = JSON.parse(await readFile(CACHE_FILE, "utf8")) as CacheMap;
  } catch {
    cacheMemo = {};
  }
  return cacheMemo;
}

async function saveCache(map: CacheMap): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(map, null, 2), "utf8");
}

function cacheKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

export interface LlmJsonOptions<T> {
  /** A short name for this job, used in traces and as the tool name. */
  task: string;
  system: string;
  prompt: string;
  /** JSON Schema for the object we want back. Needs `required` on every field. */
  schema: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
  /**
   * Cache behaviour. "prefer" reads the cache and writes on a miss, which is
   * what the demo-warming script uses. "off" always calls the API.
   */
  cache?: "prefer" | "read" | "off";
  /** Last check before the value is handed back to the caller. */
  validate?: (value: unknown) => value is T;
}

export interface LlmResult<T> {
  value: T;
  model: string;
  fromCache: boolean;
  ms: number;
  usage?: { input: number; output: number };
}

/**
 * Asks the model for one structured object.
 *
 * Structured output is enforced with a strict tool: the schema is attached to a
 * single tool, `strict: true` guarantees the arguments validate, and
 * `tool_choice` forces the model to call it. That is far more reliable than
 * asking for JSON in prose and parsing whatever comes back.
 */
export async function llmJson<T>(opts: LlmJsonOptions<T>): Promise<LlmResult<T>> {
  const model = opts.model ?? MODEL_FAST;
  const cacheMode = opts.cache ?? "prefer";
  const key = cacheKey({ model, task: opts.task, system: opts.system, prompt: opts.prompt });
  const started = Date.now();

  if (cacheMode !== "off") {
    const cache = await loadCache();
    if (key in cache) {
      const value = cache[key];
      if (!opts.validate || opts.validate(value)) {
        return { value: value as T, model, fromCache: true, ms: Date.now() - started };
      }
    }
  }

  if (!isAiEnabled()) {
    throw new AiUnavailableError(
      "AI is switched off or ANTHROPIC_API_KEY is missing. The caller should use its deterministic fallback.",
    );
  }

  const toolName = opts.task.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);

  let response;
  try {
    response = await anthropic().messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
      tools: [
        {
          name: toolName,
          description: `Return the structured result for: ${opts.task}`,
          input_schema: opts.schema as Anthropic.Tool.InputSchema,
          strict: true,
        },
      ],
      tool_choice: { type: "tool", name: toolName },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiUnavailableError("Rate limited by the model provider.", error);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiUnavailableError("The Anthropic API key was rejected.", error);
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiUnavailableError(`Model provider returned ${error.status}.`, error);
    }
    throw new AiUnavailableError("Could not reach the model provider.", error);
  }

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new AiUnavailableError(`Model did not call the ${toolName} tool.`);
  }

  const value = block.input as T;
  if (opts.validate && !opts.validate(value)) {
    throw new AiUnavailableError(`Model output failed validation for ${opts.task}.`);
  }

  if (cacheMode === "prefer") {
    const cache = await loadCache();
    cache[key] = value;
    cacheMemo = cache;
    // A failed cache write must never fail the request.
    await saveCache(cache).catch(() => {});
  }

  return {
    value,
    model,
    fromCache: false,
    ms: Date.now() - started,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
  };
}

/** Plain text out, for the one or two places that do not need a schema. */
export async function llmText(opts: {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}): Promise<{ text: string; ms: number; model: string }> {
  if (!isAiEnabled()) throw new AiUnavailableError("AI is switched off.");
  const model = opts.model ?? MODEL_FAST;
  const started = Date.now();
  try {
    const response = await anthropic().messages.create({
      model,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { text, ms: Date.now() - started, model };
  } catch (error) {
    throw new AiUnavailableError("Could not reach the model provider.", error);
  }
}

/** Used by scripts/warm-cache.ts to pre-fill the demo responses. */
export async function primeCache(entries: Array<{ key: string; value: unknown }>): Promise<void> {
  const cache = await loadCache();
  for (const { key, value } of entries) cache[key] = value;
  cacheMemo = cache;
  await saveCache(cache);
}

export { cacheKey };
