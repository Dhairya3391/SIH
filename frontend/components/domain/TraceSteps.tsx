import React from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { humanise } from "@/lib/format";
import type { TraceStep } from "@/types/database";

/**
 * What the pipeline actually did, step by step, with the model that answered
 * and how long it took.
 *
 * This is shown to the citizen, not hidden in a developer panel. Somebody who
 * has just handed over a description of a death in their village is owed a
 * plain account of what the machine did with it — including "the model was
 * unavailable, so a rule wrote this instead", which is what `ok: false` and
 * the degraded flag mean.
 */

const STEP_ICON: Record<string, IconName> = {
  transcribe: "mic",
  translate: "chat",
  compile: "spark",
  brief: "spark",
  embed: "signal",
  dedup: "search",
  score: "gauge",
  persist: "check",
  corroborate: "cloud",
};

function iconFor(step: string): IconName {
  const key = Object.keys(STEP_ICON).find((k) => step.toLowerCase().includes(k));
  return key ? STEP_ICON[key] : "chev";
}

export function TraceSteps({
  trace,
  totalMs,
  degraded,
}: {
  trace: TraceStep[] | null | undefined;
  totalMs?: number | null;
  degraded?: boolean;
}) {
  if (!trace || trace.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-body">
        The service did not return a step-by-step trace for this submission, so there is nothing
        to show here rather than a reconstruction.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {trace.map((step, i) => {
        const name = String(step.step ?? `step ${i + 1}`);
        const failed = step.ok === false;
        return (
          <div key={i} className="flex items-start gap-3">
            <span
              className={`in-s mt-px grid h-8 w-8 flex-none place-items-center ${
                failed ? "text-alert-ink" : "text-mute"
              }`}
            >
              <Icon name={failed ? "alert" : iconFor(name)} size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span className="text-[13.5px] font-semibold text-ink">{humanise(name)}</span>
                {step.model && (
                  <span className="mono text-[10.5px] text-mute">{String(step.model)}</span>
                )}
                {typeof step.ms === "number" && (
                  <span className="mono text-[10.5px] text-mute">{Math.round(step.ms)} ms</span>
                )}
                {failed && (
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-alert-ink">
                    fell back
                  </span>
                )}
              </div>
              {step.note && (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-body">
                  {String(step.note)}
                </p>
              )}
            </div>
          </div>
        );
      })}

      <div className="hairline mt-1 flex flex-wrap items-center justify-between gap-2 pt-3">
        <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
          {trace.length} steps
          {typeof totalMs === "number" ? ` · ${(totalMs / 1000).toFixed(1)}s total` : ""}
        </span>
        {degraded && (
          <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-alert-ink">
            wrote this without AI
          </span>
        )}
      </div>
    </div>
  );
}
