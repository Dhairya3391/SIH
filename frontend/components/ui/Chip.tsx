import React from "react";
import { BAND_LABEL, CONFIDENCE_LABEL, STATUS_LABEL, humanise } from "@/lib/format";
import type { Band, ConfidenceLevel } from "@/types/database";

/**
 * Status chips.
 *
 * The one rule these enforce: COLOUR NEVER SPEAKS ALONE. Every chip is a dot
 * plus a word, because the band steps (violet / amber / blue / teal) are not
 * separable for every reader, and a coordinator misreading critical as
 * moderate is a real-world consequence, not a cosmetic one.
 */

const TONES = {
  critical: { dot: "var(--color-critical)", ink: "var(--color-critical-ink)" },
  high: { dot: "var(--color-high)", ink: "var(--color-high-ink)" },
  moderate: { dot: "var(--color-moderate)", ink: "var(--color-moderate-ink)" },
  long_term: { dot: "var(--color-long)", ink: "var(--color-long-ink)" },
  teal: { dot: "var(--color-teal)", ink: "var(--color-teal-ink)" },
  alert: { dot: "var(--color-alert)", ink: "var(--color-alert-ink)" },
  neutral: { dot: "#8DA0B5", ink: "var(--color-mute)" },
  navy: { dot: "var(--color-moderate)", ink: "var(--color-navy)" },
} as const;

export type ChipTone = keyof typeof TONES;

export function Chip({
  tone = "neutral",
  children,
  title,
  className,
}: {
  tone?: ChipTone;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={["chip", className].filter(Boolean).join(" ")}
      style={{ color: t.ink }}
      title={title}
    >
      <span className="dot" style={{ background: t.dot }} />
      {children}
    </span>
  );
}

/** The severity band. Always the colour AND the word. */
export function BandChip({ band, className }: { band: Band | string; className?: string }) {
  const key = (band === "long-term" ? "long_term" : band) as ChipTone;
  const tone: ChipTone = key in TONES ? key : "neutral";
  return (
    <Chip tone={tone} className={className} title="Priority band, from the computed score">
      {BAND_LABEL[band] ?? humanise(band)}
    </Chip>
  );
}

/** Where a claim sits on the confidence ladder. */
export function ConfidenceChip({
  confidence,
  className,
}: {
  confidence: ConfidenceLevel | string | null | undefined;
  className?: string;
}) {
  if (!confidence) return null;
  const tone: ChipTone =
    confidence === "unverified"
      ? "alert"
      : confidence === "community_corroborated"
        ? "high"
        : confidence === "externally_corroborated"
          ? "moderate"
          : "teal";
  return (
    <Chip tone={tone} className={className} title="How well corroborated this is">
      {CONFIDENCE_LABEL[confidence] ?? humanise(confidence)}
    </Chip>
  );
}

export function StatusChip({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return null;
  const done = status === "DEPLOYED" || status === "IMPACT_VERIFIED";
  return (
    <Chip tone={done ? "teal" : "navy"} className={className}>
      {STATUS_LABEL[status] ?? humanise(status)}
    </Chip>
  );
}

/** A plain labelled flag: hazard tags, capabilities, channels. */
export function Tag({
  children,
  className,
  icon,
}: {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={[
        "in-s mono inline-flex items-center gap-1.5 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-mute",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      {children}
    </span>
  );
}

/** A number the reader should be able to open. Renders as a monospace pill. */
export function Figure({
  children,
  tone = "ink",
  className,
}: {
  children: React.ReactNode;
  tone?: "ink" | "navy" | "teal" | "alert";
  className?: string;
}) {
  const colour =
    tone === "navy"
      ? "text-navy"
      : tone === "teal"
        ? "text-teal-ink"
        : tone === "alert"
          ? "text-alert-ink"
          : "text-ink";
  return (
    <span className={["mono font-semibold", colour, className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
