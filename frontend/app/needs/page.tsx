"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { CATEGORY_LABEL, humanise, num, quantity, rupees } from "@/lib/format";
import type { NeedLine } from "@/types/database";

/**
 * The needs board.
 *
 * Every line a college published for a project it won, and not yet covered.
 * A company sees the material lines first; an NGO sees the funding lines.
 * Every line is divisible - 10 kg of steel can be 5 kg from one company and
 * 5 kg from another - and a fully covered line leaves the board. The college
 * behind each line can be asked anything before committing.
 */
export default function NeedsPage() {
  return (
    <RouteGuard>
      <NeedsBoard />
    </RouteGuard>
  );
}

type Group = "materials" | "funding" | "all";
type Lens = "open" | "nearly" | "untouched";

function NeedsBoard() {
  const { organisation, user, role } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group>(role === "ngo" ? "funding" : role === "industry" ? "materials" : "all");
  const [district, setDistrict] = useState("");
  const [lens, setLens] = useState<Lens>("open");
  const [pledging, setPledging] = useState<NeedLine | null>(null);
  const [messaging, setMessaging] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; thread?: string | null } | null>(null);

  const res = useResource(
    () => apiClient.fetchNeeds({ district: district || undefined, group, limit: 150 }),
    [district, group],
  );

  // Memoised so an unresolved fetch does not hand every useMemo below a
  // brand-new empty array on each render.
  const needs = useMemo(() => res.data?.needs ?? [], [res.data]);

  const districts = useMemo(
    () => [...new Set(needs.map((n) => n.challenge?.district).filter(Boolean) as string[])].sort(),
    [needs],
  );

  const remainingOf = (n: NeedLine) => n.qty_remaining ?? n.qty_open ?? n.qty_needed - n.qty_pledged;

  const counts = useMemo(() => {
    const untouched = needs.filter((n) => n.qty_pledged === 0);
    const nearly = needs.filter((n) => n.pct_closed >= 60 && remainingOf(n) > 0);
    const projects = new Set(needs.map((n) => n.challenge?.id)).size;
    const money = needs.filter((n) => n.kind === "money").reduce((s, n) => s + remainingOf(n), 0);
    return { untouched: untouched.length, nearly: nearly.length, projects, money };
  }, [needs]);

  const rows = useMemo(() => {
    const filtered =
      lens === "nearly"
        ? needs.filter((n) => n.pct_closed >= 60)
        : lens === "untouched"
          ? needs.filter((n) => n.qty_pledged === 0)
          : needs;
    // Nearly-closed lines first: finishing one delivers something, starting five delivers nothing.
    return filtered
      .slice()
      .sort((a, b) => b.pct_closed - a.pct_closed || (b.challenge?.priority ?? 0) - (a.challenge?.priority ?? 0));
  }, [needs, lens]);

  const canPledge = Boolean(organisation) && (role === "industry" || role === "ngo");

  async function messageCollege(need: NeedLine) {
    setMessaging(need.need_id);
    try {
      const t = await apiClient.openThread({ challenge_id: need.challenge.id });
      router.push(`/messages?thread=${t.thread_id}`);
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "The conversation could not be opened." });
    } finally {
      setMessaging(null);
    }
  }

  return (
    <>
      <PageHead
        eyebrow={role === "ngo" ? "NGO" : role === "industry" ? "Company" : "Needs board"}
        title={group === "funding" ? "Projects that need funding" : group === "materials" ? "Materials projects need" : "What projects need"}
        lede="Itemised lines from verified problems that a college won and is delivering. Give part of a line or all of it, and ask the college anything first — the conversation stays on the project's record."
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
            <ButtonLink href="/contributions" variant="secondary" icon="wallet">
              My contributions
            </ButtonLink>
          </div>
        }
      />

      <Main>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["materials", "Materials (companies)"],
              ["funding", "Funding (NGOs)"],
              ["all", "Everything"],
            ] as [Group, string][]
          ).map(([key, label]) => (
            <Toggle key={key} active={group === key} onClick={() => setGroup(key)}>
              <Icon name={key === "funding" ? "wallet" : key === "materials" ? "box" : "list"} size={13} />
              {label}
            </Toggle>
          ))}
        </div>

        {notice && (
          <div className="in-s flex flex-wrap items-center justify-between gap-3 p-3.5" role="status">
            <p className="text-[13px] leading-relaxed text-body">{notice.text}</p>
            <div className="flex items-center gap-2">
              {notice.thread && (
                <ButtonLink href={`/messages?thread=${notice.thread}`} variant="secondary" size="sm" icon="chat">
                  Open the conversation
                </ButtonLink>
              )}
              <button type="button" aria-label="Dismiss" className="text-mute" onClick={() => setNotice(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>
        )}

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
              <Stat label="Open lines" value={num(needs.length)} sub={`Across ${num(counts.projects)} project${counts.projects === 1 ? "" : "s"}`} />
              <Stat
                label="Funding still needed"
                value={rupees(counts.money)}
                sub={group === "materials" ? "Switch to Funding to see these lines" : "Summed across open funding lines"}
              />
              <Stat
                label="Nothing pledged yet"
                value={num(counts.untouched)}
                sub="No organisation has given anything"
                tone={counts.untouched > 0 ? "alert" : undefined}
              />
              <Stat
                label="Over 60% covered"
                value={num(counts.nearly)}
                sub="A small contribution finishes these"
                tone={counts.nearly > 0 ? "teal" : undefined}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["open", `Still open (${needs.length})`],
                  ["nearly", `Nearly there (${counts.nearly})`],
                  ["untouched", `Untouched (${counts.untouched})`],
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
                title={needs.length === 0 ? "Nothing open right now" : "Nothing under this lens"}
                why={
                  needs.length === 0
                    ? group === "funding"
                      ? "No project is short of money at the moment. Lines appear when a college that won a problem publishes its budget, and leave once they are fully covered."
                      : group === "materials"
                        ? "No project is short of materials at the moment. Lines appear when a college that won a problem publishes its bill of materials, and leave once they are fully covered."
                        : "No project is short of anything right now."
                    : "The lines are all still there, just not in this subset. Switch to Still open."
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {rows.map((n) => (
                  <NeedCard
                    key={n.need_id}
                    need={n}
                    onPledge={canPledge ? setPledging : undefined}
                    onMessage={organisation ? messageCollege : undefined}
                    messaging={messaging === n.need_id}
                  />
                ))}
              </div>
            )}

            {!canPledge && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-mute">
                  <Icon name="info" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  {!organisation
                    ? user?.role === "admin"
                      ? "You are signed in as the system owner, which is not attached to an organisation, so pledging is off. This is what companies and NGOs see."
                      : "This account is not linked to an organisation, so it cannot pledge. An administrator has to attach it first."
                    : "Only company and NGO accounts pledge. This view is read-only for your role."}
                </p>
              </Card>
            )}

            <Panel
              title="What happens after you pledge"
              lede="A pledge is a commitment tracked to delivery, not a donation that disappears."
              depth="in"
            >
              <ol className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-body">
                <li>
                  <strong className="text-ink">Pledged.</strong> The line shows your share and the
                  college is told. A conversation with the college opens so you can agree details.
                </li>
                <li>
                  <strong className="text-ink">Sent.</strong> You mark materials dispatched, or money
                  transferred, from My contributions.
                </li>
                <li>
                  <strong className="text-ink">Received.</strong> The college confirms it arrived,
                  with the date.
                </li>
                <li>
                  <strong className="text-ink">Afterwards.</strong> Once a project is fully funded it
                  leaves this board, but it stays on your contributions page — with its delivery
                  stages and the college&rsquo;s progress updates and photos — until the work is done
                  and after.
                </li>
              </ol>
            </Panel>
          </>
        )}
      </Main>

      {pledging && organisation && (
        <PledgeSheet
          need={pledging}
          onClose={() => setPledging(null)}
          onDone={(result) => {
            setPledging(null);
            setNotice({
              text: `Pledged ${result.amount} of ${result.item}. ${result.thread ? "The college has been told, and a conversation with them is open." : "The college has been told."}`,
              thread: result.thread,
            });
            res.reload();
          }}
        />
      )}
    </>
  );
}

/**
 * The pledge form. Defaults to the whole remaining amount but does not insist
 * on it — the part is what makes several contributors possible.
 */
function PledgeSheet({
  need,
  onClose,
  onDone,
}: {
  need: NeedLine;
  onClose: () => void;
  onDone: (r: { amount: string; item: string; thread: string | null }) => void;
}) {
  const money = need.kind === "money";
  const remaining = need.qty_remaining ?? need.qty_open ?? need.qty_needed - need.qty_pledged;
  const [qty, setQty] = useState(String(remaining));
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(qty);
  const valid = Number.isFinite(amount) && amount > 0 && amount <= remaining + 1e-9;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.pledge(need.challenge.id, {
        need_id: need.need_id,
        qty: amount,
        note: note.trim() || undefined,
        expected_delivery_date: !money && date ? date : undefined,
      });
      onDone({ amount: quantity(amount, need.unit, need.kind), item: need.item, thread: result.thread_id });
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
      <div className="up max-h-[92vh] w-full max-w-[480px] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="eyebrow">{money ? "Fund" : "Supply"}</span>
            <h2 className="mt-2 text-[20px] font-extrabold text-navy-dark">{need.item}</h2>
            <div className="mono mt-1.5 text-[10.5px] uppercase tracking-[0.1em] text-mute">
              {need.challenge?.ref} · {need.challenge?.district} ·{" "}
              {CATEGORY_LABEL[need.challenge?.category ?? ""] ?? humanise(need.challenge?.category ?? "")}
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
            <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">still open</span>
            <span className="mono text-[15px] font-semibold text-ink">{quantity(remaining, need.unit, need.kind)}</span>
          </div>
          {need.college && (
            <div className="mono mt-2 text-[10.5px] text-body">for {need.college.name}</div>
          )}
        </div>

        <label className="mt-4 flex flex-col gap-2">
          <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
            {money ? "Amount you can give (₹)" : `How much you can give (${need.unit})`}
          </span>
          <input
            className="field"
            type="number"
            min={money ? 1 : 0}
            step={money ? 1 : "any"}
            max={remaining}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          {valid && <span className="mono text-[11px] text-navy">{quantity(amount, need.unit, need.kind)}</span>}
        </label>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {[0.25, 0.5, 1].map((f) => {
            const v = money ? Math.max(1, Math.round(remaining * f)) : Math.max(0.01, Math.round(remaining * f * 100) / 100);
            return (
              <Toggle key={f} active={Number(qty) === v} onClick={() => setQty(String(v))}>
                {f === 1 ? "All of it" : `${Math.round(f * 100)}%`} · {quantity(v, need.unit, need.kind)}
              </Toggle>
            );
          })}
        </div>

        {!money && (
          <label className="mt-4 flex flex-col gap-2">
            <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
              Expected delivery date — optional
            </span>
            <input className="field max-w-[220px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}

        <label className="mt-4 flex flex-col gap-2">
          <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
            A note for the college — optional
          </span>
          <textarea
            className="field min-h-[84px]"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={money ? "Transfer through our CSR account after your acknowledgement." : "Can release from the Ranchi stockyard on Tuesday. Galvanised finish."}
          />
        </label>

        {!valid && qty !== "" && (
          <p className="mt-3 text-[12.5px] leading-relaxed text-alert-ink">
            Enter an amount above zero and no more than {quantity(remaining, need.unit, need.kind)} — pledging more
            than is needed would mislead everyone downstream.
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
            This records a commitment from your organisation, visible to the college and the
            district. It is not a payment — you mark it sent, and the college confirms receipt.
          </Caveat>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary" busy={busy} disabled={!valid} onClick={submit} icon="check">
            Pledge {valid ? quantity(amount, need.unit, need.kind) : ""}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Chip tone="neutral">{money ? "Funding" : humanise(need.kind)}</Chip>
          <ButtonLink href={`/projects/${need.challenge?.ref}`} variant="secondary" size="sm" icon="eye" className="ml-auto">
            See the project
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
