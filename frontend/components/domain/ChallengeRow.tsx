import React from "react";
import Link from "next/link";
import { Icon, CATEGORY_ICON } from "@/components/ui/Icon";
import { BandChip, ConfidenceChip, StatusChip, Tag } from "@/components/ui/Chip";
import { Meter } from "@/components/ui/Surface";
import { CATEGORY_LABEL, bandOf, humanise, num, relative } from "@/lib/format";

/**
 * One problem in a list.
 *
 * Built so a coordinator can scan forty of them: the score and its band on the
 * left where the eye lands, the place and the people in the middle, and the
 * evidence state on the right. The whole row is the link — a 44px target is
 * the minimum, and this is 96.
 */
export function ChallengeRow({
  href,
  // NOT named `ref`: React reserves that prop, so a challenge reference passed
  // as `ref` would be swallowed as an element ref instead of reaching here.
  reference,
  title,
  district,
  block,
  category,
  priority,
  band,
  people,
  reports,
  reporters,
  confidence,
  status,
  hazards,
  updatedAt,
  right,
  note,
  selected,
  onSelect,
}: {
  href?: string;
  reference: string;
  title: string;
  district?: string | null;
  block?: string | null;
  category?: string;
  priority: number;
  band?: string;
  people?: number | null;
  reports?: number | null;
  reporters?: number | null;
  confidence?: string | null;
  status?: string | null;
  hazards?: string[];
  updatedAt?: string | null;
  right?: React.ReactNode;
  note?: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const theBand = band ?? bandOf(priority);
  const colour = `var(--color-${theBand === "long_term" || theBand === "long-term" ? "long" : theBand})`;

  const body = (
    <>
      {/* score */}
      <div className="flex flex-none items-center gap-3 sm:w-[112px] sm:flex-col sm:items-start sm:gap-1.5">
        <div className="flex items-end gap-1">
          <span className="mono text-[26px] font-semibold leading-none text-ink">{priority}</span>
          <span className="mono pb-0.5 text-[11px] text-mute">/100</span>
        </div>
        <BandChip band={theBand} />
        <Meter value={priority} colour={colour} height={5} className="hidden w-full sm:block" />
      </div>

      {/* the problem */}
      <div className="min-w-0 flex-1">
        <div className="mono flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] uppercase tracking-[0.1em] text-mute">
          <span className="text-navy">{reference}</span>
          {(block || district) && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Icon name="pin" size={11} />
                {[block, district].filter(Boolean).join(", ")}
              </span>
            </>
          )}
          {category && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Icon name={CATEGORY_ICON[category] ?? "info"} size={11} />
                {CATEGORY_LABEL[category] ?? humanise(category)}
              </span>
            </>
          )}
        </div>

        <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-navy-dark sm:text-[16px]">
          {title}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {typeof people === "number" && people > 0 && (
            <span className="mono text-[11px] text-body">{num(people)} people</span>
          )}
          {typeof reports === "number" && reports > 0 && (
            <span className="mono text-[11px] text-body">
              {num(reports)} report{reports === 1 ? "" : "s"}
              {typeof reporters === "number" && reporters !== reports
                ? ` · ${num(reporters)} reporters`
                : ""}
            </span>
          )}
          {updatedAt && (
            <span className="mono text-[11px] text-mute">moved {relative(updatedAt)}</span>
          )}
          {(hazards ?? []).slice(0, 2).map((h) => (
            <Tag key={h}>{humanise(h)}</Tag>
          ))}
        </div>

        {note && <div className="mt-2.5">{note}</div>}
      </div>

      {/* evidence state */}
      <div className="flex flex-none flex-col items-start gap-2 sm:items-end">
        {confidence && <ConfidenceChip confidence={confidence} />}
        {status && <StatusChip status={status} />}
        {right}
      </div>
    </>
  );

  const shape =
    "flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5";

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`${selected ? "press" : "up up-hit"} ${shape} w-full text-left`}
      >
        {body}
      </button>
    );
  }

  if (!href) return <div className={`up ${shape}`}>{body}</div>;

  return (
    <Link href={href} className={`up up-hit ${shape}`}>
      {body}
    </Link>
  );
}
