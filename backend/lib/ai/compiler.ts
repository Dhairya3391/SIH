import "server-only";
import { llmJson, MODEL_DRAFT, AiUnavailableError, isAiEnabled } from "./llm";
import { BRIEF_SCHEMA, COMPILER_SYSTEM, isCompiledBrief, type CompiledBrief } from "./brief";
import { compileWithRules, type FallbackInput } from "./fallback";
import { embed, type EmbeddingSource } from "./embeddings";
import { transcribe, isSttEnabled } from "./stt";
import type { VulnerabilityTag } from "@/lib/domain/types";

/**
 * The Challenge Compiler.
 *
 * A messy Hindi voice note becomes a clear project brief, and the brief says
 * what it is unsure about. This file runs the pipeline and records what each
 * step actually cost, which is what the trace panel shows on stage. Judges
 * cannot see AI unless you show it.
 *
 * The order is always: try the model, and on any failure run the rules. A
 * caller never has to handle "the AI was down", because a brief always comes
 * back. What changes is the `source` field and the quality of the wording.
 */

export interface TraceStep {
  step: string;
  label: string;
  ms: number;
  detail?: string;
  /** False when this step fell back to deterministic code. */
  usedAi: boolean;
}

export interface CompileResult {
  brief: CompiledBrief;
  embedding: number[];
  embeddingSource: EmbeddingSource;
  transcript: string | null;
  trace: TraceStep[];
  /** True when any step had to fall back, so the UI can say so plainly. */
  degraded: boolean;
  /**
   * Why transcription produced nothing, when audio was sent.
   *   "not_configured" - no GROQ_API_KEY on this deployment
   *   "failed"         - the transcriber was reachable and rejected the audio
   *   null             - it worked, or no audio was sent
   * The caller needs the distinction: telling a villager the service is down
   * when in fact their recording was unreadable sends them away for nothing.
   */
  transcriptionFailure: "not_configured" | "failed" | null;
}

export interface CompileInput {
  /** Raw text from the form, from an SMS, or empty when only audio was sent. */
  text?: string;
  audio?: File | Blob | null;
  languageHint?: string;
  peopleEst?: number | null;
  urgency?: number | null;
  vulnerable?: VulnerabilityTag[];
  district?: string | null;
  village?: string | null;
  /** Other reports already in the cluster, so a merge re-compiles on everything. */
  siblingTexts?: string[];
  /** Lower the model's trust in a plain SMS from an unknown number. */
  channel?: "web" | "sms" | "volunteer" | "ivr";
}

export async function compile(input: CompileInput): Promise<CompileResult> {
  const trace: TraceStep[] = [];
  let degraded = false;

  // --- 1. Transcribe ------------------------------------------------------
  let transcript: string | null = null;
  let transcriptionFailure: CompileResult["transcriptionFailure"] = null;
  let text = (input.text ?? "").trim();

  if (input.audio) {
    const started = Date.now();
    try {
      const result = await transcribe(input.audio as File, { languageHint: input.languageHint });
      transcript = result.text;
      if (transcript) text = text ? `${text}\n\n${transcript}` : transcript;
      trace.push({
        step: "transcribe",
        label: "Transcribe",
        ms: result.ms,
        detail: `${result.model}, detected ${result.language}`,
        usedAi: true,
      });
    } catch (err) {
      degraded = true;
      // isSttEnabled() is the only thing that distinguishes "we cannot do this
      // at all" from "we tried and this particular audio did not work".
      transcriptionFailure = isSttEnabled() ? "failed" : "not_configured";
      const detail =
        transcriptionFailure === "not_configured"
          ? "Speech to text is not configured on this deployment. The voice note is saved and the transcript is pending."
          : `The transcriber could not read this recording: ${
              err instanceof Error ? err.message : "unknown error"
            }`;
      trace.push({
        step: "transcribe",
        label: "Transcribe",
        ms: Date.now() - started,
        detail,
        usedAi: false,
      });
    }
  }

  const fallbackInput: FallbackInput = {
    text,
    peopleEst: input.peopleEst,
    urgency: input.urgency,
    vulnerable: input.vulnerable,
    district: input.district,
    village: input.village,
    lang: input.languageHint,
    reportCount: (input.siblingTexts?.length ?? 0) + 1,
  };

  // --- 2. Translate, extract and draft ------------------------------------
  // One model call does all three. Splitting them would look better in the
  // trace panel and would cost two extra round trips on stage, so it does not.
  let brief: CompiledBrief;
  const compileStarted = Date.now();

  if (!text) {
    brief = compileWithRules(fallbackInput);
    degraded = true;
    trace.push({
      step: "compile",
      label: "Translate, extract and draft",
      ms: Date.now() - compileStarted,
      detail: "No text to work from, so a placeholder brief was drafted from the form fields.",
      usedAi: false,
    });
  } else if (!isAiEnabled()) {
    brief = compileWithRules(fallbackInput);
    degraded = true;
    trace.push({
      step: "compile",
      label: "Translate, extract and draft",
      ms: Date.now() - compileStarted,
      detail: "AI is switched off. Rule-based compiler used.",
      usedAi: false,
    });
  } else {
    try {
      const result = await llmJson<Omit<CompiledBrief, "source">>({
        task: "compile_challenge_brief",
        system: COMPILER_SYSTEM,
        prompt: buildPrompt(input, text),
        schema: BRIEF_SCHEMA,
        model: MODEL_DRAFT,
        maxTokens: 4096,
        validate: isCompiledBrief,
      });
      brief = { ...result.value, source: "ai" };
      brief = applyFormOverrides(brief, input);
      trace.push({
        step: "compile",
        label: "Translate, extract and draft",
        ms: result.ms,
        detail: result.fromCache
          ? `Served from the demo cache (${result.model})`
          : `${result.model}, ${result.usage?.output ?? 0} output tokens`,
        usedAi: true,
      });
    } catch (error) {
      degraded = true;
      brief = compileWithRules(fallbackInput);
      trace.push({
        step: "compile",
        label: "Translate, extract and draft",
        ms: Date.now() - compileStarted,
        detail:
          error instanceof AiUnavailableError
            ? `${error.message} Rule-based compiler used instead.`
            : "Model call failed. Rule-based compiler used instead.",
        usedAi: false,
      });
    }
  }

  // A plain SMS from a basic phone names a village at best. Say so, rather than
  // letting a confident-sounding brief hide how little we actually know.
  if (input.channel === "sms" && !input.village && !brief.village) {
    brief.uncertainties = [
      ...brief.uncertainties,
      "This arrived as a plain SMS with no precise location, so the place is approximate.",
    ];
  }

  // --- 3. Embed -----------------------------------------------------------
  const embedTarget = [brief.translated_text || text, brief.title, brief.needs.join(", ")]
    .filter(Boolean)
    .join("\n");
  const embedding = await embed(embedTarget);
  if (embedding.source === "local") degraded = true;
  trace.push({
    step: "embed",
    label: "Embed",
    ms: embedding.ms,
    detail:
      embedding.source === "gemini"
        ? "gemini-embedding-001, 768 dimensions"
        : "Local hashing vectoriser, 768 dimensions (no network call)",
    usedAi: embedding.source === "gemini",
  });

  return {
    brief,
    embedding: embedding.vector,
    embeddingSource: embedding.source,
    transcript,
    trace,
    degraded,
    transcriptionFailure,
  };
}

function buildPrompt(input: CompileInput, text: string): string {
  const lines: string[] = [];

  lines.push("REPORT TO COMPILE");
  lines.push("");
  lines.push(text);
  lines.push("");

  if (input.siblingTexts?.length) {
    lines.push(`OTHER REPORTS ALREADY IN THIS CLUSTER (${input.siblingTexts.length})`);
    lines.push("Compile one brief that covers all of them, not just the newest.");
    lines.push("");
    input.siblingTexts.slice(0, 20).forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push("");
  }

  lines.push("WHAT THE REPORTER TICKED ON THE FORM");
  lines.push("These are stated facts. Do not contradict them.");
  lines.push(`- People affected: ${input.peopleEst ?? "not stated"}`);
  lines.push(`- Urgency (1-5): ${input.urgency ?? "not stated"}`);
  lines.push(`- Vulnerable groups: ${input.vulnerable?.length ? input.vulnerable.join(", ") : "none ticked"}`);
  lines.push(`- District: ${input.district ?? "not stated"}`);
  lines.push(`- Village: ${input.village ?? "not stated"}`);
  lines.push(`- Channel: ${input.channel ?? "web"}`);

  if (input.channel === "sms") {
    lines.push("");
    lines.push(
      "This arrived by SMS from a basic phone. It will be short and may name only a village. Be explicit in uncertainties about what is missing.",
    );
  }

  return lines.join("\n");
}

/**
 * What the reporter ticked always beats what the model inferred. The form is a
 * statement of fact from the person who was there.
 */
function applyFormOverrides(brief: CompiledBrief, input: CompileInput): CompiledBrief {
  const out = { ...brief };
  if (input.peopleEst != null && input.peopleEst > 0) out.people_est = input.peopleEst;
  if (input.urgency != null) out.urgency = input.urgency;
  if (input.district) out.district = input.district;
  if (input.village) out.village = input.village;
  if (input.vulnerable?.length) {
    out.vulnerable = [...new Set([...input.vulnerable, ...brief.vulnerable])];
  }
  return out;
}

/** Total wall time, for the "processed in Xs" line under the trace. */
export function traceTotalMs(trace: TraceStep[]): number {
  return trace.reduce((sum, s) => sum + s.ms, 0);
}
