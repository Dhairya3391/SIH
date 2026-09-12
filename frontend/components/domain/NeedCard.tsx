import React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Chip, Tag } from "@/components/ui/Chip";
import { Meter } from "@/components/ui/Surface";
import { bandOf, humanise, num } from "@/lib/format";
import type { Need, NeedLine } from "@/types/database";

/**
 * One itemised need, and how much of it is still open.
 *
 * Fractional by design: a need for twelve siren units can be met by six
 * organisations giving two each. That is the whole point of the board — a
 * company with ₹8,000 of CSR budget is a useful contributor here, and a board
 * that only accepts whole needs turns them away.
 */
export function NeedCard({
  need,
  onPledge,
  showChallenge = true,
}: {
  need: NeedLine;
  onPledge?: (need: NeedLine) => void;
  showChallenge?: boolean;
}) {
  const remaining = need.qty_remaining ?? need.qty_open ?? need.qty_needed - need.qty_pledged;
  const closed = remaining <= 0;
  const band = bandOf(need.challenge?.priority ?? 0);

  return (
    <div className="up p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Tag icon={<Icon name="box" size={11} />}>{humanise(need.kind)}</Tag>
            {need.capability && <Tag>{humanise(need.capability)}</Tag>}
            {closed ? (
              <Chip tone="teal">Fully pledged</Chip>
            ) : need.contributor_count && need.contributor_count > 0 ? (
              <Chip tone="high">
                {need.contributor_count} contributor{need.contributor_count === 1 ? "" : "s"} so far
              </Chip>
            ) : (
              <Chip tone="neutral">Nothing pledged</Chip>
            )}
          </div>
          <h3 className="mt-2.5 text-[17px] font-bold text-navy-dark">{need.item}</h3>
        </div>

        <div className="flex-none text-right">
          <div className="mono text-[24px] font-semibold leading-none text-ink">
            {num(remaining)}
          </div>
          <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
            {need.unit}
            {need.unit.endsWith("s") ? "" : "s"} still open
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
            {num(need.qty_pledged)} of {num(need.qty_needed)} {need.unit} pledged
          </span>
          <span className="mono text-[11px] font-semibold text-navy">{need.pct_closed}%</span>
        </div>
        <Meter
          value={need.pct_closed}
          colour={closed ? "var(--color-teal)" : "var(--color-navy)"}
          className="mt-2"
        />
      </div>

      {showChallenge && need.challenge && (
        <Link
          href={`/challenge/${need.challenge.ref}`}
          className="up-s up-hit mt-4 flex items-center justify-between gap-3 p-3.5"
        >
          <div className="min-w-0">
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
              {need.challenge.ref} · {need.challenge.district} · priority{" "}
              {need.challenge.priority} · open {num(need.challenge.age_days)}d
            </div>
            <div className="mt-1 truncate text-[13.5px] font-semibold text-ink">
              {need.challenge.title}
            </div>
            <div className="mono mt-1 text-[10px] text-mute">
              {num(need.challenge.people_est)} people affected
            </div>
          </div>
          <span className="flex-none text-navy">
            <Icon name="chevRight" size={15} />
          </span>
        </Link>
      )}

      {onPledge && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="btn"
            onClick={() => onPledge(need)}
            disabled={closed}
          >
            <Icon name="box" size={15} />
            {closed ? "Nothing left to give" : `Give some of the ${need.unit}`}
          </button>
          <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
            band {humanise(band)}
          </span>
        </div>
      )}
    </div>
  );
}

/** The compact version used inside a challenge brief. */
export function NeedLineRow({ need }: { need: Need }) {
  const open = need.qty_open ?? need.qty_remaining ?? need.qty_needed - need.qty_pledged;
  const closed = open <= 0;
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-ink">{need.item}</span>
        <span className="mono flex-none text-[11px] text-mute">
          {num(need.qty_pledged)}/{num(need.qty_needed)} {need.unit}
        </span>
      </div>
      <Meter
        value={need.pct_closed}
        colour={closed ? "var(--color-teal)" : "var(--color-navy)"}
        className="mt-2"
        height={7}
      />
      <div className="mono mt-1.5 text-[10px] uppercase tracking-[0.08em] text-mute">
        {humanise(need.kind)}
        {closed ? " · fully pledged" : ` · ${num(open)} ${need.unit} still open`}
      </div>
    </div>
  );
}
