import React from "react";
import { Icon, PROVIDER_ICON } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Well } from "@/components/ui/Surface";
import { PROVIDER_LABEL, VERDICT_LABEL, dateTime, humanise } from "@/lib/format";
import type { ExternalSummary } from "@/types/database";

/**
 * What the outside world says about a citizen's claim.
 *
 * Three independent checks — weather records, a news archive, the open web —
 * each with its own verdict and its own citations. The model is handed numbered
 * passages and must answer with indices, never URLs, so it cannot invent a
 * source: an index that maps to nothing fails the whole check to inconclusive
 * rather than producing a plausible link.
 *
 * And the thing this panel is careful never to do: decide. Corroboration is
 * evidence placed beside the reporter's words. A human verifier decides.
 */
export function Corroboration({
  external,
  onRun,
  running,
}: {
  external: ExternalSummary | null | undefined;
  onRun?: () => void;
  running?: boolean;
}) {
  if (!external || !external.checked) {
    return (
      <div className="in p-4">
        <p className="text-[13px] leading-relaxed text-body">
          No outside check has been run on this report yet. Until one is, the only evidence is
          what the reporters themselves said.
        </p>
        {onRun && (
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            className="btn-2 btn-sm mt-3"
          >
            <Icon name={running ? "refresh" : "search"} size={14} />
            {running ? "Checking weather, news and web…" : "Look for independent proof"}
          </button>
        )}
      </div>
    );
  }

  const tone =
    external.verdict === "supports"
      ? "teal"
      : external.verdict === "contradicts"
        ? "alert"
        : "high";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Chip tone={tone}>
            {VERDICT_LABEL[external.verdict] ?? humanise(external.verdict)}
          </Chip>
          <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
            {external.citation_count} citation{external.citation_count === 1 ? "" : "s"} ·{" "}
            {external.checks.length} check{external.checks.length === 1 ? "" : "s"}
          </span>
        </div>
        {onRun && (
          <button type="button" onClick={onRun} disabled={running} className="btn-2 btn-sm">
            <Icon name="refresh" size={13} />
            {running ? "Re-checking…" : "Check again"}
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {external.checks.map((check, i) => {
          const failed = Boolean(check.provider_error);
          const t =
            check.verdict === "supports"
              ? "teal"
              : check.verdict === "contradicts"
                ? "alert"
                : "high";
          return (
            <div key={`${check.provider}-${i}`} className="up-s p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="in-s grid h-8 w-8 place-items-center text-mute">
                    <Icon name={PROVIDER_ICON[check.provider] ?? "search"} size={14} />
                  </span>
                  <div>
                    <div className="text-[13.5px] font-bold text-ink">
                      {PROVIDER_LABEL[check.provider] ?? humanise(check.provider)}
                    </div>
                    <div className="mono text-[10px] uppercase tracking-[0.08em] text-mute">
                      {dateTime(check.checked_at)}
                    </div>
                  </div>
                </div>
                {failed ? (
                  <Chip tone="neutral">Unavailable</Chip>
                ) : (
                  <div className="flex items-center gap-2">
                    <Chip tone={t}>
                      {VERDICT_LABEL[check.verdict] ?? humanise(check.verdict)}
                    </Chip>
                    <span className="mono text-[10.5px] text-mute">
                      {Math.round((check.confidence ?? 0) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {failed ? (
                <p className="mt-3 text-[12.5px] leading-relaxed text-body">
                  This source could not be reached: {check.provider_error}. It is recorded as
                  unavailable rather than as a negative result, because not finding a source is
                  not the same as a source disagreeing.
                </p>
              ) : (
                <>
                  {check.reasoning && (
                    <Well small className="mt-3">
                      <p className="text-[12.5px] leading-relaxed text-ink">{check.reasoning}</p>
                    </Well>
                  )}

                  {check.citations.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {check.citations.map((cite, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <span className="mono mt-0.5 flex-none text-[10px] text-mute">
                            [{j + 1}]
                          </span>
                          {cite.url ? (
                            <a
                              href={cite.url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="text-[12.5px] font-semibold leading-snug text-navy hover:underline"
                            >
                              {cite.title ?? cite.url}
                              <span className="ml-1 inline-block align-middle">
                                <Icon name="link" size={11} />
                              </span>
                            </a>
                          ) : (
                            <span className="text-[12.5px] leading-snug text-body">
                              {cite.title ?? "Untitled passage"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[12px] leading-relaxed text-mute">
                      No passage was specific enough to cite, which is why this check came back
                      inconclusive rather than supporting.
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="in-s mt-4 flex items-start gap-2.5 p-3">
        <span className="mt-px text-mute">
          <Icon name="info" size={14} />
        </span>
        <p className="text-[12px] leading-relaxed text-body">
          Corroboration is evidence, not a decision. It can move a report to{" "}
          <em>externally corroborated</em> on the confidence ladder; only a person can field
          verify it.
        </p>
      </div>
    </div>
  );
}

/** The confidence ladder, with the current rung marked and the rest explained. */
export function ConfidenceLadder({
  current,
  rungs,
}: {
  current: string | null | undefined;
  rungs: { key: string; label: string; meaning: string }[];
}) {
  const index = rungs.findIndex((r) => r.key === current);
  return (
    <ol className="flex flex-col gap-1.5">
      {rungs.map((rung, i) => {
        const reached = index >= 0 && i <= index;
        const isCurrent = i === index;
        return (
          <li
            key={rung.key}
            className={`flex items-start gap-3 p-3 ${isCurrent ? "press" : reached ? "up-s" : "in-s"}`}
          >
            <span
              className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${
                reached ? "text-teal-ink" : "text-mute"
              }`}
            >
              <Icon name={reached ? "check" : "chev"} size={13} />
            </span>
            <div>
              <div
                className={`text-[13px] ${isCurrent ? "font-bold text-navy" : reached ? "font-semibold text-ink" : "font-medium text-mute"}`}
              >
                {rung.label}
                {isCurrent && (
                  <span className="mono ml-2 text-[9.5px] uppercase tracking-[0.1em] text-navy">
                    now
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-body">{rung.meaning}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
