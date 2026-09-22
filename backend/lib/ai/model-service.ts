import "server-only";
import type { Category, DmPhase, VulnerabilityTag } from "@/lib/domain/types";

/**
 * Client for JharSetu's own trained models (ml/serve.py): the MiniLM report
 * classifier, the dedup embedder, and the Whisper fine-tune for rural Hindi.
 *
 * Set ML_SERVICE_URL to use them. They are transformer models of about half a
 * gigabyte each, so they do not fit in a serverless function; they run as a
 * sidecar (laptop on stage, or a small GPU box) and this file talks to it.
 *
 * Every call fails soft. If the sidecar is slow, down or not configured, the
 * caller drops to the in-process TypeScript classifier and then to the keyword
 * rules. AI_ENABLED=false switches this off along with everything else, so the
 * kill-switch demo still shows a working golden path.
 */

const TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS ?? 4000);

export function isModelServiceEnabled(): boolean {
  return process.env.AI_ENABLED !== "false" && Boolean(process.env.ML_SERVICE_URL);
}

async function call<T>(path: string, init: RequestInit): Promise<T | null> {
  if (!isModelServiceEnabled()) return null;
  const url = `${process.env.ML_SERVICE_URL!.replace(/\/$/, "")}${path}`;
  const stop = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: stop });
    if (!res.ok) return null;
    const body = (await res.json()) as T & { ok?: boolean };
    return body?.ok === false ? null : body;
  } catch {
    return null; // unreachable, timed out, or malformed: the caller falls back
  }
}

export interface ServiceClassification {
  model: string;
  category: Category;
  category_confidence: number;
  category_runner_up: { label: Category; prob: number };
  severity: number;
  severity_confidence: number;
  dm_phase: DmPhase;
  dm_phase_confidence: number;
  vulnerable: Record<VulnerabilityTag, number>;
}

/** null means "not available" - never an exception, never a guess. */
export function classifyWithService(text: string): Promise<ServiceClassification | null> {
  return call<ServiceClassification>("/classify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export interface ServiceEmbeddings {
  model: string;
  dim: number;
  merge_threshold: number;
  embeddings: number[][];
}

export function embedWithService(texts: string[]): Promise<ServiceEmbeddings | null> {
  return call<ServiceEmbeddings>("/embed", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts }),
  });
}

export interface ServiceTranscript {
  model: string;
  text: string;
  seconds: number;
}

export async function transcribeWithService(audio: Blob | File): Promise<ServiceTranscript | null> {
  const form = new FormData();
  form.append("file", audio, "report.webm");
  // Audio is slower than text: allow longer than the shared timeout.
  const url = `${process.env.ML_SERVICE_URL?.replace(/\/$/, "")}/transcribe`;
  if (!isModelServiceEnabled()) return null;
  try {
    const res = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as ServiceTranscript & { ok?: boolean };
    return body?.ok === false ? null : body;
  } catch {
    return null;
  }
}

export async function modelServiceHealth(): Promise<{ device: string; models: string[] } | null> {
  return call<{ device: string; models: string[] }>("/health", { method: "GET" });
}
