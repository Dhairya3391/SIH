"use client";

import React, { useMemo, useState } from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat } from "@/components/ui/Surface";
import { Button, ButtonLink, Toggle } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Caveat, Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { NeedCard } from "@/components/domain/NeedCard";
import * as apiClient from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/useResource";
import { CATEGORY_LABEL, humanise, num } from "@/lib/format";
import type { NeedLine } from "@/types/database";

/**
 * The needs board.
 *
 * Every line is itemised and every line is divisible. A need for twelve siren
 * units can be closed by six organisations giving two each — which is the
 * entire point, because most CSR budgets in the state are small and a board
 * that only accepts whole needs turns those donors away.
 */
export default function NeedsPage() {
  return (
    <RouteGuard>
      <NeedsBoard />
    </RouteGuard>
  );
}

type Lens = "all" | "open" | "nearly" | "untouched";

function NeedsBoard() {
  const { organisation, user } = useAuth();
  const [district, setDistrict] = useState("");
  const [kind, setKind] = useState("");
  const [lens, setLens] = useState<Lens>("open");
  const [pledging, setPledging] = useState<NeedLine | null>(null);

  const res = useResource(
    () =>
      apiClient.fetchNeeds({
        district: district || undefined,
        kind: kind || undefined,
        limit: 120,
      }),
    [district, kind],
  );

  // Memoised so an unresolved fetch does not hand every useMemo below a
  // brand-new empty array on each render.
  const needs = useMemo(() => res.data?.needs ?? [], [res.data]);

  const districts = useMemo(
    () =>
      [
        ...new Set(needs.map((n) => n.challenge?.district).filter(Boolean) as string[]),
      ].sort(),
    [needs],
  );
  const kinds = useMemo(
    () => [...new Set(needs.map((n) => n.kind).filter(Boolean))].sort(),
    [needs],
  );

  const remainingOf = (n: NeedLine) =>
    n.qty_remaining ?? n.qty_open ?? n.qty_needed - n.qty_pledged;

  const counts = useMemo(() => {
    const open = needs.filter((n) => remainingOf(n) > 0);
    const untouched = needs.filter((n) => n.qty_pledged === 0);
    const nearly = needs.filter((n) => n.pct_closed >= 60 && remainingOf(n) > 0);
    const people = [
      ...new Map(
        open.filter((n) => n.challenge).map((n) => [n.challenge.id, n.challenge.people_est]),
      ).values(),
    ].reduce((a, b) => a + b, 0);
    return { open: open.length, untouched: untouched.length, nearly: nearly.length, people };
  }, [needs]);

  const rows = useMemo(() => {
    const filtered =
      lens === "open"
        ? needs.filter((n) => remainingOf(n) > 0)
        : lens === "nearly"
          ? needs.filter((n) => n.pct_closed >= 60 && remainingOf(n) > 0)
          : lens === "untouched"
            ? needs.filter((n) => n.qty_pledged === 0)
            : needs;
    // Nearly-closed lines first: finishing one delivers something, starting
    // five delivers nothing.
    return filtered
      .slice()
      .sort(
        (a, b) =>
          b.pct_closed - a.pct_closed ||
          (b.challenge?.priority ?? 0) - (a.challenge?.priority ?? 0),
      );
  }, [needs, lens]);

  return (
    <>
      <PageHead
        eyebrow="Company / NGO"
        title="What is actually needed"
        lede="Itemised lines from problems that a person verified and a college is building against. Give part of a line or all of it — six organisations closing one need together is the normal case, not a fallback."
        right={
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              className="field max-w-[180px]"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              aria-label="Filter by district"
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className="field max-w-[170px]"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="Filter by kind"
            >
              <option value="">All kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {humanise(k)}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={4} height={220} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Open lines"
                value={num(counts.open)}
                sub={district ? `In ${district}` : "Across Jharkhand"}
              />
              <Stat
                label="Nothing pledged yet"
                value={num(counts.untouched)}
                sub="No organisation has given anything"
                tone={counts.untouched > 0 ? "alert" : undefined}
              />
              <Stat
                label="Over 60% closed"
                value={num(counts.nearly)}
                sub="A small contribution finishes these"
                tone={counts.nearly > 0 ? "teal" : undefined}
              />
              <Stat
                label="People behind them"
                value={num(counts.people)}
                sub="Across the problems with open lines"
              />
            </div>

            {counts.nearly > 0 && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-teal-ink">
                  <Icon name="box" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  <strong className="text-ink">
                    {counts.nearly} line{counts.nearly === 1 ? " is" : "s are"} more than 60%
                    closed.
                  </strong>{" "}
                  Those are the cheapest deliveries in the state right now — a partial line blocks
                  the same execution stage as an empty one, so finishing one is worth more than
                  starting three.
                </p>
              </Card>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["open", `Still open (${counts.open})`],
                  ["nearly", `Nearly there (${counts.nearly})`],
                  ["untouched", `Untouched (${counts.untouched})`],
                  ["all", `Everything (${needs.length})`],
                ] as [Lens, string][]
              ).map(([key, label]) => (
                <Toggle key={key} active={lens === key} onClick={() => setLens(key)}>
                  {label}
                </Toggle>
              ))}
            </div>

            {rows.length === 0 ? (
              <Empty
                icon="box"
                title={needs.length === 0 ? "No open needs right now" : "Nothing under this lens"}
                why={
                  needs.length === 0
                    ? "Needs appear here when a college's awarded proposal is broken into itemised lines. If the board is empty, no awarded project is currently short of anything."
                    : "The lines are all still there, just not in this subset. Switch to Everything."
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {rows.map((n) => (
                  <NeedCard
                    key={n.need_id}
                    need={n}
                    onPledge={organisation ? setPledging : undefined}
                  />
                ))}
              </div>
            )}

            {!organisation && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-alert-ink">
                  <Icon name="alert" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  {user?.role === "admin"
                    ? "You are signed in as the system owner, which is not attached to an organisation. Pledging is disabled because a pledge has to belong to somebody — the button is shown as unavailable rather than hidden so you can see what a company would see."
                    : "This account is not linked to an organisation, so it cannot pledge. An administrator has to attach it first."}
                </p>
              </Card>
            )}

            <Panel
              title="What happens after you pledge"
              lede="A pledge is a commitment that gets tracked to delivery, not a donation that disappears."
              depth="in"
            >
              <ol className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-body">
                <li>
                  <strong className="text-ink">Offered.</strong> The line shows your quantity as
                  pledged and the college can plan around it.
                </li>
                <li>
                  <strong className="text-ink">Dispatched.</strong> You mark it sent. The college
                  sees what is coming and when.
                </li>
                <li>
                  <strong className="text-ink">Received.</strong> The college confirms. Only then
                  does the stage that depended on it unblock.
                </li>
                <li>
                  <strong className="text-ink">Afterwards.</strong> It stays on your contributions
                  page permanently, with the stage it unlocked and any photograph the college
                  filed — including after the project closes.
                </li>
              </ol>
            </Panel>
          </>
        )}
      </Main>

      {pledging && organisation && (
        <PledgeSheet
          need={pledging}
          orgId={organisation.id}
          onClose={() => setPledging(null)}
          onDone={() => {
            setPledging(null);
            res.reload();
          }}
        />
      )}
    </>
  );
}

/**
 * The pledge form. Defaults to the whole remaining quantity but does not
 * insist on it — the quantity field is the fractional part of "fractional
 * sponsorship", so it has to be first-class rather than an advanced option.
 */
function PledgeSheet({
  need,
  orgId,
  onClose,
  onDone,
}: {
  need: NeedLine;
  orgId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const remaining = need.qty_remaining ?? need.qty_open ?? need.qty_needed - need.qty_pledged;
  const [qty, setQty] = useState(String(remaining));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(qty);
  const valid = Number.isFinite(amount) && amount > 0 && amount <= remaining;

  async function submit() {
    if (!need.challenge) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.pledge(need.challenge.id, {
        need_id: need.need_id,
        org_id: orgId,
        qty: amount,
        kind: need.kind,
        note: note.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The pledge was not recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(11,42,74,0.28)] p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Pledge towards ${need.item}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="up w-full max-w-[480px] p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Pledge</span>
            <h2 className="mt-2 text-[20px] font-extrabold text-navy-dark">{need.item}</h2>
            <div className="mono mt-1.5 text-[10.5px] uppercase tracking-[0.1em] text-mute">
              {need.challenge?.ref} · {need.challenge?.district} ·{" "}
              {CATEGORY_LABEL[need.challenge?.category ?? ""] ??
                humanise(need.challenge?.category ?? "")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="up-s up-hit grid h-9 w-9 place-items-center rounded-xl text-mute"
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="in mt-5 p-4">
          <div className="flex items-baseline justify-between">
            <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
              still open
            </span>
            <span className="mono text-[15px] font-semibold text-ink">
              {num(remaining)} {need.unit}
            </span>
          </div>
        </div>

        <label className="mt-4 flex flex-col gap-2">
          <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
            How much you can give ({need.unit})
          </span>
          <input
            className="field"
            type="number"
            min={1}
            max={remaining}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {[0.25, 0.5, 1].map((f) => {
            const v = Math.max(1, Math.round(remaining * f));
            return (
              <Toggle
                key={f}
                active={Number(qty) === v}
                onClick={() => setQty(String(v))}
              >
                {f === 1 ? "All of it" : `${Math.round(f * 100)}%`} · {num(v)} {need.unit}
              </Toggle>
            );
          })}
        </div>

        <label className="mt-4 flex flex-col gap-2">
          <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
            A note for the college — optional
          </span>
          <textarea
            className="field min-h-[84px]"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Can release from the Ranchi stockyard on Tuesday. Galvanised finish."
          />
        </label>

        {!valid && qty !== "" && (
          <p className="mt-3 text-[12.5px] leading-relaxed text-alert-ink">
            Enter between 1 and {num(remaining)} {need.unit}. Pledging more than is needed would
            show a line as over-closed and mislead everyone downstream.
          </p>
        )}

        {error && (
          <div className="in-s mt-3 flex items-start gap-2.5 p-3.5" role="alert">
            <span className="mt-px text-alert-ink">
              <Icon name="alert" size={15} />
            </span>
            <p className="text-[13px] leading-relaxed text-body">{error}</p>
          </div>
        )}

        <div className="mt-5">
          <Caveat icon="shield">
            This records a commitment against your organisation, visible to the college and to the
            district. It is not a payment — delivery is confirmed separately by the college.
          </Caveat>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary" busy={busy} disabled={!valid} onClick={submit} icon="check">
            Pledge {valid ? `${num(amount)} ${need.unit}` : ""}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Chip tone="neutral">{humanise(need.kind)}</Chip>
          {need.capability && <Chip tone="neutral">{humanise(need.capability)}</Chip>}
          <ButtonLink
            href={`/challenge/${need.challenge?.ref}`}
            variant="secondary"
            size="sm"
            icon="eye"
            className="ml-auto"
          >
            Read the brief
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
