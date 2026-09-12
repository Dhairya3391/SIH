import React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Chip, Tag } from "@/components/ui/Chip";
import { Meter } from "@/components/ui/Surface";
import { bandOf, humanise, num, quantity } from "@/lib/format";
import type { Need, NeedLine } from "@/types/database";

/**
 * One itemised need, and how much of it is still open.
 *
 * Fractional by design: 10 kg of steel can be met by two companies giving 5 kg
 * each, and ₹2,00,000 by two NGOs giving half. The card names the college that
 * published it and how to reach them, because a contributor usually has a
 * question before they commit.
 */
export function NeedCard({
  need,
  onPledge,
  onMessage,
  messaging,
  showChallenge = true,
}: {
  need: NeedLine;
  onPledge?: (need: NeedLine) => void;
  onMessage?: (need: NeedLine) => void;
  messaging?: boolean;
  showChallenge?: boolean;
}) {
  const remaining = need.qty_remaining ?? need.qty_open ?? need.qty_needed - need.qty_pledged;
  const closed = remaining <= 0;
  const band = bandOf(need.challenge?.priority ?? 0);
  const money = need.kind === "money";

  return (
    <div className="up p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Tag icon={<Icon name={money ? "wallet" : "box"} size={11} />}>
              {money ? "Funding" : humanise(need.kind)}
            </Tag>
            {closed ? (
              <Chip tone="teal">Fully pledged</Chip>
            ) : need.contributor_count && need.contributor_count > 0 ? (
              <Chip tone="high">
                {need.contributor_count} contributor{need.contributor_count === 1 ? "" : "s"} so far
              </Chip>
            ) : (
              <Chip tone="neutral">Nothing pledged</Chip>
            )}
            {need.my_pledged > 0 && (
              <Chip tone="teal">You gave {quantity(need.my_pledged, need.unit, need.kind)}</Chip>
            )}
          </div>
          <h3 className="mt-2.5 text-[17px] font-bold text-navy-dark">{need.item}</h3>
        </div>

        <div className="flex-none text-right">
          <div className="mono text-[24px] font-semibold leading-none text-ink">
            {quantity(remaining, need.unit, need.kind)}
          </div>
          <div className="mono mt-1 text-[10px] uppercase tracking-[0.1em] text-mute">still open</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
            {quantity(need.qty_pledged, need.unit, need.kind)} of{" "}
            {quantity(need.qty_needed, need.unit, need.kind)} pledged
          </span>
          <span className="mono text-[11px] font-semibold text-navy">{need.pct_closed}%</span>
        </div>
        <Meter
          value={need.pct_closed}
          colour={closed ? "var(--color-teal)" : "var(--color-navy)"}
          className="mt-2"
        />
      </div>

      {need.college && (
        <div className="in-s mt-4 flex flex-wrap items-start justify-between gap-3 p-3.5">
          <div className="min-w-0">
            <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-mute">
              published by
              {need.project.proposal_score !== null ? ` · proposal scored ${need.project.proposal_score}` : ""}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
              <Icon name="grad" size={13} />
              {need.college.name}
            </div>
            {(need.college.contact_person || need.college.contact_email) && (
              <div className="mono mt-1 text-[10.5px] text-body">
                {[need.college.contact_person, need.college.contact_email].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          {need.project.stages_total > 0 && (
            <span className="mono flex-none text-[10px] uppercase tracking-[0.08em] text-mute">
              {need.project.stages_done}/{need.project.stages_total} stages done
            </span>
          )}
        </div>
      )}

      {showChallenge && need.challenge && (
        <Link
          href={`/projects/${need.challenge.ref}`}
          className="up-s up-hit mt-3 flex items-center justify-between gap-3 p-3.5"
        >
          <div className="min-w-0">
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
              {need.challenge.ref} · {need.challenge.district} · priority {need.challenge.priority} · open{" "}
              {num(need.challenge.age_days)}d
            </div>
            <div className="mt-1 truncate text-[13.5px] font-semibold text-ink">{need.challenge.title}</div>
            <div className="mono mt-1 text-[10px] text-mute">
              {num(need.challenge.people_est)} people affected · see the plan and its progress
            </div>
          </div>
          <span className="flex-none text-navy">
            <Icon name="chevRight" size={15} />
          </span>
        </Link>
      )}

      {(onPledge || onMessage) && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {onPledge && (
            <button type="button" className="btn" onClick={() => onPledge(need)} disabled={closed}>
              <Icon name={money ? "wallet" : "box"} size={15} />
              {closed ? "Nothing left to give" : money ? "Fund part of this" : "Supply part of this"}
            </button>
          )}
          {onMessage && need.college && (
            <button
              type="button"
              className="btn-2"
              onClick={() => onMessage(need)}
              disabled={messaging}
            >
              <Icon name="chat" size={15} />
              {messaging ? "Opening…" : "Ask the college"}
            </button>
          )}
          <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">band {humanise(band)}</span>
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
          {quantity(need.qty_pledged, need.unit, need.kind)} / {quantity(need.qty_needed, need.unit, need.kind)}
        </span>
      </div>
      <Meter
        value={need.pct_closed}
        colour={closed ? "var(--color-teal)" : "var(--color-navy)"}
        className="mt-2"
        height={7}
      />
      <div className="mono mt-1.5 text-[10px] uppercase tracking-[0.08em] text-mute">
        {need.kind === "money" ? "Funding" : humanise(need.kind)}
        {closed ? " · fully pledged" : ` · ${quantity(open, need.unit, need.kind)} still open`}
      </div>
    </div>
  );
}
