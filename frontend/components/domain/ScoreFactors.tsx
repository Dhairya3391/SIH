import React from "react";
import { Meter } from "@/components/ui/Surface";
import { BandChip } from "@/components/ui/Chip";
import { bandOf } from "@/lib/format";
import type { ScoreBreakdown } from "@/types/database";

/**
 * The priority score, opened.
 *
 * The house rule this screen exists to enforce: no score is shown without a
 * route to the factors that produced it. Each line carries its own points, its
 * cap, and the sentence the scorer wrote for it — including the cap on
 * community signal, which is what stops a district with more phones from
 * outranking a remote block with more danger.
 */
export function ScoreFactors({
  breakdown,
  whyCritical,
  compact,
}: {
  breakdown: ScoreBreakdown | null | undefined;
  whyCritical?: string | null;
  compact?: boolean;
}) {
  if (!breakdown || !breakdown.factors?.length) {
    return (
      <p className="text-[13px] leading-relaxed text-body">
        This problem has no stored score breakdown, so there is nothing to open. That happens on
        rows created before the scorer ran; the number alone is not shown here, because a score
        nobody can open is a score nobody should act on.
      </p>
    );
  }

  const band = bandOf(breakdown.total);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2.5">
          <span className="mono text-[40px] font-semibold leading-none text-ink">
            {breakdown.total}
          </span>
          <span className="mono pb-1 text-[15px] text-mute">/100</span>
        </div>
        <div className="flex items-center gap-2">
          <BandChip band={band} />
          <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
            weights {breakdown.weightsVersion}
          </span>
        </div>
      </div>

      <Meter
        value={breakdown.total}
        colour={`var(--color-${band === "long_term" ? "long" : band})`}
        className="mt-3"
        height={12}
      />

      {whyCritical && (
        <div className="in mt-4 p-4">
          <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
            The verdict, in one sentence
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{whyCritical}</p>
        </div>
      )}

      <ul className="mt-4 flex flex-col">
        {breakdown.factors.map((f, i) => {
          const capped = f.points >= f.max && f.max > 0;
          return (
            <li key={f.key} className={`py-3.5 ${i > 0 ? "hairline" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-bold text-ink">{f.label}</span>
                <span className="mono flex-none text-[12px] font-semibold text-navy">
                  {f.points}
                  <span className="text-mute">/{f.max}</span>
                </span>
              </div>
              <Meter
                value={f.points}
                max={f.max}
                height={6}
                colour={capped ? "var(--color-teal)" : "var(--color-navy)"}
                className="mt-2"
              />
              {!compact && (
                <p className="mt-2 text-[12.5px] leading-relaxed text-body">{f.reason}</p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mono mt-3 text-[10px] uppercase tracking-[0.1em] text-mute">
        {breakdown.factors.length} factors · sums to {breakdown.total}
      </p>
    </div>
  );
}
