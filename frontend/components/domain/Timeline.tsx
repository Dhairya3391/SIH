"use client";

import React from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { Meter } from "@/components/ui/Surface";
import { STAGE_STATUS_LABEL, dateTime, gap, hours, humanise, num } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { ExecutionStage, TimelineEvent } from "@/types/database";

/**
 * The record, and the time between each entry.
 *
 * The question this answers is the one a review panel always asks: not "what
 * happened" but "how long did each step take". So the gap is a first-class
 * column, drawn to scale in the strip above, and anything over two days is
 * flagged — because the interesting number in this system is never the total,
 * it is where the total went.
 */

const SLOW_GAP_HOURS = 48;

const KIND: Record<string, { tone: ChipTone; icon: IconName; label: string }> = {
  report: { tone: "neutral", icon: "mic", label: "Citizen report" },
  reported: { tone: "neutral", icon: "mic", label: "Citizen report" },
  external: { tone: "moderate", icon: "cloud", label: "AI corroboration" },
  corroborated: { tone: "moderate", icon: "cloud", label: "AI corroboration" },
  verified: { tone: "teal", icon: "shield", label: "Human verification" },
  rejected: { tone: "alert", icon: "x", label: "Rejected" },
  proposal: { tone: "high", icon: "file", label: "Proposal submitted" },
  scored: { tone: "high", icon: "gauge", label: "Proposal scored" },
  lead: { tone: "critical", icon: "trophy", label: "Lead changed" },
  awarded: { tone: "critical", icon: "trophy", label: "Window awarded" },
  contribution: { tone: "teal", icon: "box", label: "Contribution" },
  pledge: { tone: "teal", icon: "box", label: "Contribution" },
  update: { tone: "teal", icon: "check", label: "Progress update" },
  stage: { tone: "navy", icon: "list", label: "Stage" },
  transition: { tone: "navy", icon: "arrow", label: "Status change" },
};

function kindOf(kind: string) {
  const key = Object.keys(KIND).find((k) => kind.toLowerCase().includes(k));
  return key ? KIND[key] : { tone: "neutral" as ChipTone, icon: "chev" as IconName, label: humanise(kind) };
}

/** The gap strip: bar width IS the gap, to scale. */
export function GapStrip({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="scroll-x -mx-1 px-1">
      <div className="flex min-w-[520px] items-start gap-1">
        {events.map((e, i) => {
          const g = e.gap_hours ?? 0.6;
          const slow = (e.gap_hours ?? 0) > SLOW_GAP_HOURS;
          const meta = kindOf(e.kind);
          const colour = slow
            ? "var(--color-alert)"
            : meta.tone === "teal"
              ? "var(--color-teal)"
              : meta.tone === "critical"
                ? "var(--color-critical)"
                : meta.tone === "high"
                  ? "var(--color-high)"
                  : meta.tone === "moderate"
                    ? "var(--color-moderate)"
                    : "#8DA0B5";
          return (
            <div
              key={i}
              style={{ flex: Math.max(g, 0.6), minWidth: 3 }}
              title={`${meta.label} · ${gap(e.gap_hours)}`}
            >
              <div
                className="h-3 rounded-[3px]"
                style={{ background: colour, boxShadow: "2px 2px 4px rgba(11,42,74,.16)" }}
              />
              <div
                className={`mono mt-1.5 truncate text-[8.5px] ${slow ? "font-semibold text-alert-ink" : "text-mute"}`}
              >
                {gap(e.gap_hours)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineList({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-body">
        The ledger has no entries for this problem yet. Entries are appended as things happen;
        an empty record means nothing has happened, not that nothing was recorded.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {events.map((e, i) => {
        const meta = kindOf(e.kind);
        const slow = (e.gap_hours ?? 0) > SLOW_GAP_HOURS;
        return (
          <li
            key={i}
            className={`flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:gap-3.5 ${i > 0 ? "hairline" : ""}`}
          >
            <div className="flex-none sm:w-[152px]">
              <Chip tone={meta.tone}>
                <Icon name={meta.icon} size={11} />
                {meta.label}
              </Chip>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] leading-relaxed text-ink">{e.summary}</p>
              <div className="mono mt-1 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                {dateTime(e.at)} IST
                {e.actor ? ` · ${e.actor}` : ""}
              </div>
            </div>

            <span
              className={`mono flex-none text-[10.5px] sm:w-[90px] sm:text-right ${
                slow ? "font-semibold text-alert-ink" : "text-mute"
              }`}
            >
              {gap(e.gap_hours)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The execution plan the model generated from the winning proposal: ordered
 * stages, each with its own definition of done, and the need that blocks it.
 */
export function StageTracker({ stages }: { stages: ExecutionStage[] }) {
  if (stages.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-body">
        No execution plan has been generated. Stages are created from the winning proposal once
        the window is awarded, so an empty plan means the competition has not resolved yet.
      </p>
    );
  }

  const done = stages.filter((s) => s.status === "done").length;
  const totalDays = stages.reduce((sum, s) => sum + (s.expected_days ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="mono text-[11px] font-semibold text-ink">
          {done} of {stages.length} done
        </span>
        <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
          {num(totalDays)} days planned
        </span>
      </div>
      <Meter
        value={done}
        max={stages.length}
        colour="var(--color-teal)"
        className="mt-2.5"
        height={8}
      />

      <ol className="mt-4 flex flex-col gap-2.5">
        {stages
          .slice()
          .sort((a, b) => a.seq - b.seq)
          .map((s) => {
            const tone: ChipTone =
              s.status === "done"
                ? "teal"
                : s.status === "blocked"
                  ? "alert"
                  : s.status === "in_progress"
                    ? "moderate"
                    : "neutral";
            return (
              <li key={s.id} className={`${s.status === "done" ? "press" : "up-s"} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mono mt-0.5 flex-none text-[11px] font-semibold text-mute">
                      {String(s.seq).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-bold leading-snug text-navy-dark">
                        {s.title}
                      </h4>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-body">
                        <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-mute">
                          done when{" "}
                        </span>
                        {s.definition_of_done}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1.5">
                    <Chip tone={tone}>{STAGE_STATUS_LABEL[s.status] ?? humanise(s.status)}</Chip>
                    <span className="mono text-[10px] text-mute">{s.expected_days}d</span>
                  </div>
                </div>

                {s.blocked_on_need_id && (
                  <p className="mt-2.5 text-[12px] font-semibold leading-relaxed text-alert-ink">
                    Blocked until a contributor closes the need this stage depends on.
                  </p>
                )}
                {(s.started_at || s.completed_at) && (
                  <p className="mono mt-2 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                    {s.started_at ? `started ${dateTime(s.started_at)}` : ""}
                    {s.completed_at ? ` · completed ${dateTime(s.completed_at)}` : ""}
                  </p>
                )}
              </li>
            );
          })}
      </ol>

      <p className="mono mt-3 text-[10px] uppercase tracking-[0.1em] text-mute">
        AI-generated plan · a coordinator can rewrite any stage before it locks
      </p>
    </div>
  );
}

/** Report-to-now, with the worst single gap called out. */
export function DurationSummary({
  from,
  to,
  longestGapHours,
}: {
  from: string | null | undefined;
  to?: string | null;
  longestGapHours: number | null | undefined;
}) {
  // Refreshed every minute so an open challenge's age does not go stale while
  // somebody has the page up during an incident.
  const now = useNow(60_000);
  if (!from) return null;
  const end = to ? new Date(to).getTime() : now;
  const totalHours =
    end === null ? null : (end - new Date(from).getTime()) / 3_600_000;
  const slow = (longestGapHours ?? 0) > SLOW_GAP_HOURS;

  return (
    <div className="up p-4 sm:p-5">
      <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
        {to ? "Report to closure" : "Report to now"}
      </div>
      <div className="mono mt-2 text-[24px] font-semibold leading-none text-ink">
        {hours(totalHours)}
      </div>
      <div
        className={`mono mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] ${
          slow ? "text-alert-ink" : "text-mute"
        }`}
      >
        longest gap {hours(longestGapHours)}
      </div>
    </div>
  );
}
