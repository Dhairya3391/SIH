"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Meter, Well } from "@/components/ui/Surface";
import { countdown, dateTime, humanise } from "@/lib/format";
import type { CompetitionState, ProposalRubric } from "@/types/database";

/**
 * The proposal window.
 *
 * The design decision worth defending: while a window is open the leading
 * SCORE is public but the leading document and the leading college are not.
 * A college competes against a number, not against a rival it can read and
 * copy — and it always knows exactly what it has to beat.
 */
export function WindowState({
  competition,
  myScore,
  compact,
}: {
  competition: CompetitionState | null | undefined;
  myScore?: number | null;
  compact?: boolean;
}) {
  const [, tick] = useState(0);

  // The countdown is the one live number on the page; a stale "2h left" on a
  // window that shut ten minutes ago is a college submitting into a closed box.
  useEffect(() => {
    if (competition?.state !== "open") return;
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [competition?.state]);

  if (!competition || competition.state === "not_opened") {
    return (
      <div className={compact ? "in-s p-3" : "in p-4"}>
        <div className="flex items-center gap-2">
          <Chip tone="neutral">No window yet</Chip>
        </div>
        {!compact && (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-body">
            Nobody has submitted for this problem. The first proposal opens the window, and its
            length is set by the severity band — so being first does not win, it starts the clock.
          </p>
        )}
      </div>
    );
  }

  const closed = competition.state !== "open";
  const c = countdown(competition.closes_at);
  const leader = competition.leader_score ?? null;
  const leading = myScore !== null && myScore !== undefined && leader !== null && myScore >= leader;

  return (
    <div className={compact ? "in-s p-3" : "in p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {closed ? (
            <Chip tone={competition.state === "awarded" ? "teal" : "neutral"}>
              {competition.state === "awarded" ? "Awarded" : humanise(competition.state)}
            </Chip>
          ) : (
            <Chip tone={c.urgent ? "alert" : "moderate"}>
              <Icon name="clock" size={11} />
              {c.text}
            </Chip>
          )}
          {leader !== null && (
            <span className="mono text-[11px] font-semibold text-ink">
              score to beat {leader}
              <span className="text-mute">/100</span>
            </span>
          )}
          {myScore !== null && myScore !== undefined && (
            <Chip tone={leading ? "teal" : "high"}>
              {leading ? "You are leading" : `Yours ${myScore}`}
            </Chip>
          )}
        </div>
        {competition.window_days ? (
          <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
            {competition.window_days}-day window
          </span>
        ) : null}
      </div>

      {leader !== null && <Meter value={leader} className="mt-3" height={8} />}

      {!compact && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-body">
          {closed
            ? `The window closed ${dateTime(competition.closed_at ?? competition.closes_at)} and the highest scoring proposal was awarded the work.`
            : `The leading score is public; the leading document and the college behind it are not, so you compete against a number rather than against a proposal you could copy. Closes ${dateTime(competition.closes_at)}.`}
          {competition.reopen_count ? ` Reopened ${competition.reopen_count} time(s).` : ""}
        </p>
      )}
    </div>
  );
}

/**
 * The seven rubric criteria, summing to 100, each with the reason the reviewer
 * gave. The viability floor is drawn on purpose: a proposal under 40 is not
 * "third place", it is refused, and a college is owed that distinction plainly.
 */
export const VIABILITY_FLOOR = 40;
export const NEEDS_CHANGES_CEILING = 55;

export function RubricBreakdown({
  rubric,
  score,
  verdict,
  model,
  funding,
  currency,
  durationDays,
}: {
  rubric: ProposalRubric | null | undefined;
  score: number | null;
  verdict?: string | null;
  model?: string | null;
  funding?: number | null;
  currency?: string | null;
  durationDays?: number | null;
}) {
  if (score === null) {
    return (
      <div className="in p-4">
        <p className="text-[13px] leading-relaxed text-body">
          This proposal has not been scored yet. Scoring runs as a separate job on purpose — a
          college uploading a twenty-page document should not have to wait on a model call, and a
          crash mid-score is recoverable because the job is idempotent.
        </p>
      </div>
    );
  }

  const notViable = verdict === "not_viable" || score < VIABILITY_FLOOR;
  const needsChanges = !notViable && (verdict === "needs_changes" || score < NEEDS_CHANGES_CEILING);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2.5">
          <span
            className={`mono text-[42px] font-semibold leading-none ${notViable ? "text-alert-ink" : "text-ink"}`}
          >
            {score}
          </span>
          <span className="mono pb-1.5 text-[15px] text-mute">/100</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={notViable ? "alert" : needsChanges ? "high" : "teal"}>
            {notViable ? "Not viable" : needsChanges ? "Needs changes" : "Viable"}
          </Chip>
        </div>
      </div>

      {/* The floor, drawn where it actually sits. */}
      <div className="relative mt-3">
        <Meter
          value={score}
          height={12}
          colour={notViable ? "var(--color-alert)" : "var(--color-navy)"}
        />
        <span
          className="absolute -top-1 h-[20px] w-[2px] bg-[var(--color-alert-ink)]"
          style={{ left: `${VIABILITY_FLOOR}%` }}
          aria-hidden="true"
        />
        <span
          className="mono absolute top-[18px] text-[9.5px] uppercase tracking-[0.08em] text-alert-ink"
          style={{ left: `calc(${VIABILITY_FLOOR}% - 26px)` }}
        >
          floor {VIABILITY_FLOOR}
        </span>
      </div>

      <p className="mt-8 text-[12.5px] leading-relaxed text-body">
        Below {VIABILITY_FLOOR} a proposal is refused outright rather than ranked — it cannot lead
        a window even if it is the only submission, because being unopposed is not the same as
        being buildable.
      </p>

      {rubric?.summary && (
        <Well className="mt-4">
          <p className="text-[13.5px] leading-relaxed text-ink">{rubric.summary}</p>
        </Well>
      )}

      {rubric?.criteria && rubric.criteria.length > 0 && (
        <ul className="mt-4 flex flex-col">
          {rubric.criteria.map((c, i) => (
            <li key={c.key} className={`py-3.5 ${i > 0 ? "hairline" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-bold text-ink">{c.label}</span>
                <span className="mono flex-none text-[12px] font-semibold text-navy">
                  {c.points}
                  <span className="text-mute">/{c.max}</span>
                </span>
              </div>
              <Meter value={c.points} max={c.max} height={6} className="mt-2" />
              {c.reason && (
                <p className="mt-2 text-[12.5px] leading-relaxed text-body">{c.reason}</p>
              )}
              {c.pages && c.pages.length > 0 && (
                <p className="mono mt-1.5 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                  from page{c.pages.length === 1 ? "" : "s"} {c.pages.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {rubric?.required_changes && rubric.required_changes.length > 0 && (
        <div className="mt-4">
          <PointList
            title="What has to change"
            items={rubric.required_changes}
            tone={notViable ? "alert" : "high"}
            icon="alert"
          />
        </div>
      )}

      {(funding !== null && funding !== undefined) ||
      (durationDays !== null && durationDays !== undefined) ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="up-s p-4">
            <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
              Funding the document asks for
            </div>
            <div className="mono mt-1.5 text-[18px] font-semibold text-ink">
              {funding !== null && funding !== undefined
                ? `${currency === "INR" || !currency ? "₹" : `${currency} `}${funding.toLocaleString("en-IN")}`
                : "—"}
            </div>
            <p className="mt-1 text-[11.5px] leading-snug text-body">
              Read out of the proposal itself, not entered on a form.
            </p>
          </div>
          <div className="up-s p-4">
            <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
              Duration it claims
            </div>
            <div className="mono mt-1.5 text-[18px] font-semibold text-ink">
              {durationDays !== null && durationDays !== undefined ? `${durationDays} days` : "—"}
            </div>
            <p className="mt-1 text-[11.5px] leading-snug text-body">
              Scored for credibility, not taken at face value.
            </p>
          </div>
        </div>
      ) : null}

      <p className="mono mt-4 text-[10px] uppercase tracking-[0.1em] text-mute">
        scored by {model ?? "the review model"} · seven criteria summing to 100 · a coordinator
        still signs off the award
      </p>
    </div>
  );
}

function PointList({
  title,
  items,
  tone,
  icon,
}: {
  title: string;
  items: string[] | null | undefined;
  tone: "teal" | "high" | "alert";
  icon: "check" | "alert" | "x";
}) {
  const colour =
    tone === "teal" ? "text-teal-ink" : tone === "high" ? "text-high-ink" : "text-alert-ink";
  return (
    <div className="up-s p-4">
      <div className={`mono flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${colour}`}>
        <Icon name={icon} size={12} />
        {title}
      </div>
      {items && items.length > 0 ? (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {items.map((s, i) => (
            <li key={i} className="text-[12.5px] leading-relaxed text-body">
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-[12px] leading-relaxed text-mute">
          The reviewer listed none.
        </p>
      )}
    </div>
  );
}
