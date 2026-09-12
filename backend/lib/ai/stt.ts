import "server-only";
import { AiUnavailableError } from "./llm";

/**
 * Speech to text. Whisper large-v3 on Groq, which is fast and has a free tier.
 *
 * Voice is the first rung of the whole product: Somra will never fill in a form
 * but he will send a voice note. Bhashini or Sarvam for Santali, Mundari and Ho
 * is on the roadmap; Hindi is what we demo.
 *
 * There is no clever fallback for audio. If this fails the report still saves,
 * carrying its audio file and an empty transcript, and the screen says the
 * transcript is pending so nobody thinks the report was lost.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3";

export interface TranscriptResult {
  text: string;
  language: string;
  ms: number;
  model: string;
  /**
   * Mean no_speech_prob across segments, 0-1. Whisper fabricates text from
   * silence - a genuinely silent clip comes back as a movie disclaimer or
   * "Thanks for watching", scored with a high no_speech_prob. Verified on a
   * silent file: it returned "The following video is a work of fiction. Any
   * resemblance to actual persons, living or dead, is coincidental."
   */
  noSpeechProb: number;
  /** True when the transcript looks fabricated rather than spoken. */
  likelyHallucination: boolean;
}

export function isSttEnabled(): boolean {
  return process.env.AI_ENABLED !== "false" && Boolean(process.env.GROQ_API_KEY);
}

export async function transcribe(
  audio: Blob | File,
  opts: { languageHint?: string } = {},
): Promise<TranscriptResult> {
  if (!isSttEnabled()) {
    throw new AiUnavailableError("Speech to text is switched off or GROQ_API_KEY is missing.");
  }

  const started = Date.now();
  const form = new FormData();
  form.append("file", audio, "report.webm");
  form.append("model", MODEL);
  form.append("response_format", "verbose_json");
  // A hint helps, but it must not be a hard constraint: a reporter may answer in
  // Nagpuri or Khortha even when the interface is set to Hindi.
  if (opts.languageHint) form.append("language", opts.languageHint);
  form.append(
    "prompt",
    "A citizen in Jharkhand, India reporting a local problem: lightning, flood, drinking water, road, school, crops, or health.",
  );

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
    });
  } catch (error) {
    throw new AiUnavailableError("Could not reach the speech-to-text service.", error);
  }

  if (!res.ok) {
    throw new AiUnavailableError(`Speech to text returned ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as {
    text?: string;
    language?: string;
    segments?: Array<{ no_speech_prob?: number }>;
  };

  const text = (body.text ?? "").trim();
  const segments = body.segments ?? [];
  const noSpeechProb =
    segments.length > 0
      ? segments.reduce((sum, seg) => sum + (seg.no_speech_prob ?? 0), 0) / segments.length
      : 0;

  return {
    text,
    // Whisper reports language names ("hindi"), not ISO codes.
    language: normaliseLanguage(body.language),
    ms: Date.now() - started,
    model: MODEL,
    noSpeechProb,
    likelyHallucination: isLikelyHallucination(text, noSpeechProb),
  };
}

/**
 * Whisper's canned outputs for silence. It has been trained on a lot of
 * subtitled video, so with nothing to transcribe it reaches for the phrases
 * that end them. Matching these is crude but it is the difference between a
 * villager being told "say that again" and a fabricated report being filed
 * in their name.
 */
const HALLUCINATION_PATTERNS = [
  /work of fiction/i,
  /resemblance to actual persons/i,
  /thanks?\s+(you\s+)?for watching/i,
  /please subscribe/i,
  /subtitles? by/i,
  /amara\.org/i,
  /transcription by/i,
  /^\s*(thank you|thanks)[.!]?\s*$/i,
  /^\s*bye[.!]?\s*$/i,
  /copyright \d{4}/i,
];

export function isLikelyHallucination(text: string, noSpeechProb: number): boolean {
  if (!text) return false;
  // Whisper is confident there was no speech, yet returned words.
  if (noSpeechProb >= 0.6) return true;
  if (HALLUCINATION_PATTERNS.some((re) => re.test(text))) return true;
  // A real report is more than one or two words, in any of our languages.
  if (text.split(/\s+/).filter(Boolean).length < 3) return true;
  return false;
}

const LANGUAGE_CODES: Record<string, string> = {
  hindi: "hi",
  english: "en",
  bengali: "bn",
  urdu: "ur",
  nepali: "ne",
  marathi: "mr",
  gujarati: "gu",
  punjabi: "pa",
  odia: "or",
  oriya: "or",
};

function normaliseLanguage(raw: string | undefined): string {
  if (!raw) return "hi";
  const key = raw.toLowerCase().trim();
  return LANGUAGE_CODES[key] ?? (key.length === 2 ? key : "hi");
}

/** Audio limits, checked before the file is sent anywhere. */
export const AUDIO_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  allowedTypes: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a"],
} as const;

export function checkAudio(file: File): string | null {
  if (file.size > AUDIO_LIMITS.maxBytes) return "That voice note is larger than 10 MB.";
  const type = file.type.split(";")[0];
  if (type && !AUDIO_LIMITS.allowedTypes.includes(type as (typeof AUDIO_LIMITS.allowedTypes)[number])) {
    return `Unsupported audio type: ${type}.`;
  }
  return null;
}
