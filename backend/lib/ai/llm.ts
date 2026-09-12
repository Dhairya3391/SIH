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

/** Extracts all available Gemini API keys from the environment. */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  const clean = (s: string) => s.trim().replace(/^["']|["']$/g, "");
  if (process.env.GEMINI_API_KEYS) {
    keys.push(...process.env.GEMINI_API_KEYS.split(",").map(clean).filter(Boolean));
  }
  for (let i = 1; i <= 10; i++) {
    const raw = process.env[`GEMINI_API_KEY_${i}`];
    if (raw) {
      const k = clean(raw);
      if (k && !keys.includes(k)) keys.push(k);
    }
  }
  if (process.env.GEMINI_API_KEY) {
    const k = clean(process.env.GEMINI_API_KEY);
    if (k && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

/**
 * Model cascade: 3.8 flash -> 3.7 flash -> 3.6 flash -> 3.5 flash -> 3.5 flash lite.
 */
export const GEMINI_MODEL_CASCADE = process.env.GEMINI_MODELS
  ? process.env.GEMINI_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
  : [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
    ];

/**
 * The kill switch. Setting AI_ENABLED=false makes every call throw
 * AiUnavailableError, so the whole platform drops to its rule-based path.
 */
export function isAiEnabled(): boolean {
  if (process.env.AI_ENABLED === "false") return false;
  return getGeminiApiKeys().length > 0 || Boolean(process.env.ANTHROPIC_API_KEY);
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
const suspendedKeys = new Set<string>();

async function callGeminiJson<T>(opts: LlmJsonOptions<T>, started: number): Promise<LlmResult<T>> {
  const apiKeys = getGeminiApiKeys().filter((k) => !suspendedKeys.has(k));
  if (!apiKeys.length) {
    throw new AiUnavailableError("No active Gemini API keys configured (all keys suspended or missing).");
  }

  const models = GEMINI_MODEL_CASCADE;
  let lastError: Error | null = null;

  for (const model of models) {
    for (const key of apiKeys) {
      if (suspendedKeys.has(key)) continue;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `${opts.system}\n\nTask: ${opts.task}\n\nRespond ONLY with a valid JSON object matching this schema: ${JSON.stringify(opts.schema)}\n\nInput:\n${opts.prompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              maxOutputTokens: opts.maxTokens ?? 4096,
            },
          }),
        });

        if (res.status === 403) {
          console.warn(`[gemini] key ${key.slice(0, 8)}... suspended (403), marking inactive`);
          suspendedKeys.add(key);
          continue;
        }

        if (res.status === 503) {
          console.warn(`[gemini] model ${model} experiencing high demand (503), cascading to next model`);
          lastError = new AiUnavailableError(`Gemini model ${model} experiencing high demand (503)`);
          break; // break key loop and try next model in cascade
        }

        if (res.status === 429) {
          console.warn(`[gemini] key ${key.slice(0, 8)}... rate limited (429) on ${model}, trying next key`);
          lastError = new AiUnavailableError(`Gemini key rate limited on ${model}`);
          continue;
        }

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          lastError = new AiUnavailableError(`Gemini model ${model} error ${res.status}: ${errBody.slice(0, 100)}`);
          continue;
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          lastError = new AiUnavailableError(`Gemini model ${model} returned empty candidate`);
          continue;
        }

        const cleanJson = rawText.replace(/^```json\s*|^```\s*|```$/g, "").trim();
        const value = JSON.parse(cleanJson) as T;
        if (opts.validate && !opts.validate(value)) {
          lastError = new AiUnavailableError(`Gemini model ${model} output failed schema validation`);
          continue;
        }

        return {
          value,
          model,
          fromCache: false,
          ms: Date.now() - started,
          usage: {
            input: data.usageMetadata?.promptTokenCount ?? 0,
            output: data.usageMetadata?.candidatesTokenCount ?? 0,
          },
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }
  }

  throw lastError ?? new AiUnavailableError("All Gemini models and keys exhausted.");
}

async function callGeminiText(
  opts: { system: string; prompt: string; maxTokens?: number },
  started: number,
): Promise<{ text: string; ms: number; model: string }> {
  const apiKeys = getGeminiApiKeys();
  if (!apiKeys.length) {
    throw new AiUnavailableError("No Gemini API keys configured.");
  }

  const models = GEMINI_MODEL_CASCADE;
  let lastError: Error | null = null;

  for (const model of models) {
    for (const key of apiKeys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${opts.system}\n\n${opts.prompt}` }],
              },
            ],
            generationConfig: {
              maxOutputTokens: opts.maxTokens ?? 2048,
            },
          }),
        });

        if (res.status === 429 || res.status === 403 || res.status === 503) {
          lastError = new AiUnavailableError(`Gemini model ${model} returned ${res.status}`);
          continue;
        }

        if (!res.ok) {
          lastError = new AiUnavailableError(`Gemini model ${model} error ${res.status}`);
          continue;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
        return { text, ms: Date.now() - started, model };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }
  }

  throw lastError ?? new AiUnavailableError("All Gemini models and keys exhausted.");
}

/**
 * Asks the model for one structured object.
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
      "AI is switched off or no API keys are available. The caller should use its deterministic fallback.",
    );
  }

  // 1. Try Gemini first if keys exist
  if (getGeminiApiKeys().length > 0) {
    try {
      const result = await callGeminiJson<T>(opts, started);
      if (cacheMode === "prefer") {
        const cache = await loadCache();
        cache[key] = result.value;
        cacheMemo = cache;
        await saveCache(cache).catch(() => {});
      }
      return result;
    } catch (err) {
      console.warn("[llm] Gemini cascade failed, checking Anthropic fallback...", err);
      if (!process.env.ANTHROPIC_API_KEY) throw err;
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiUnavailableError("No AI provider available.");
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
  const started = Date.now();

  if (getGeminiApiKeys().length > 0) {
    try {
      return await callGeminiText(opts, started);
    } catch {
      if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("Gemini failed and no Anthropic key.");
    }
  }

  const model = opts.model ?? MODEL_FAST;
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
