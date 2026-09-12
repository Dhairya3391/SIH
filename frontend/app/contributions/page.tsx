"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/useResource";
import { PLEDGE_STATE_LABEL, STAGE_STATUS_LABEL, STATUS_LABEL, dateOnly, humanise, money, num, relative } from "@/lib/format";
import type { Contribution, FundedProject } from "@/types/database";

/**
 * What this organisation gave, and what became of it.
 *
 * Fully funded and finished projects leave the needs board and the main lists,
 * but they stay here: the delivery stages, the college's progress updates and
 * photos, and a line to the college. That record is what makes the next pledge
 * credible.
 */
export default function ContributionsPage() {
  return (
    <RouteGuard>
      <Contributions />
    </RouteGuard>
  );
}

const STATE_TONE: Record<string, "teal" | "high" | "neutral" | "alert"> = {
  received: "teal",
  dispatched: "high",
  committed: "high",
  offered: "neutral",
  withdrawn: "alert",
};

function Contributions() {
  const { organisation, role } = useAuth();
  const res = useResource(() => apiClient.fetchMyContributions(), []);

  const contributions = res.data?.contributions ?? [];
  const projects = res.data?.projects ?? [];
  const totals = res.data?.totals ?? null;

  return (
    <>
      <PageHead
        eyebrow={role === "ngo" ? "NGO" : "Company"}
        title="What you gave, and what it did"
        lede={
          organisation
            ? `Everything ${organisation.name} has pledged, where each contribution is, and how far the work it went into has got — including projects that are fully funded or finished.`
            : "Everything this organisation has pledged, where each contribution is, and how far the work has got."
        }
        right={
          <ButtonLink href="/needs" variant="primary" icon={role === "ngo" ? "wallet" : "box"}>
            Needs board
          </ButtonLink>
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={3} height={160} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : contributions.length === 0 ? (
          <Empty
            icon="wallet"
            title="You have not pledged anything yet"
            why={
              organisation
                ? "The needs board lists what projects need, line by line. You can take part of a line — most contributions here are partial."
                : "This account is not linked to an organisation, so it has nothing to show. Pledges belong to an organisation, not to an individual."
            }
            action={
              <ButtonLink href="/needs" variant="primary" icon="box">
                See what is needed
              </ButtonLink>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Contributions"
                value={num(totals?.lines ?? contributions.length)}
                sub={`Across ${num(projects.length)} project${projects.length === 1 ? "" : "s"}`}
              />
              <Stat label="Money pledged" value={money(totals?.money ?? 0)} sub="Funding lines only" />
              <Stat
                label="Received by the college"
                value={num(totals?.delivered ?? 0)}
                sub="Confirmed with a date"
                tone={(totals?.delivered ?? 0) > 0 ? "teal" : undefined}
              />
              <Stat
                label="Waiting on you"
                value={num(totals?.awaiting_dispatch ?? 0)}
                sub="Pledged but not marked sent"
                tone={(totals?.awaiting_dispatch ?? 0) > 0 ? "alert" : undefined}
              />
            </div>

            {(totals?.awaiting_dispatch ?? 0) > 0 && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-alert-ink">
                  <Icon name="alert" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  <strong className="text-ink">
                    {num(totals?.awaiting_dispatch ?? 0)} pledge{(totals?.awaiting_dispatch ?? 0) === 1 ? "" : "s"} not sent yet.
                  </strong>{" "}
                  Mark each one sent when the materials leave or the money is transferred, so the
                  college knows what is coming.
                </p>
              </Card>
            )}

            {projects.length > 0 && (
              <Panel title="The projects you contributed to" lede="Stages and updates are the college's own record.">
                <div className="grid gap-3 lg:grid-cols-2">
                  {projects.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              </Panel>
            )}

            <Panel title="Every contribution" lede="Newest first, with each step's date.">
              <div className="flex flex-col gap-3">
                {contributions.map((c) => (
                  <ContributionRow key={c.id} contribution={c} onChanged={res.reload} />
                ))}
              </div>
            </Panel>
          </>
        )}
      </Main>
    </>
  );
}

function ProjectCard({ project: p }: { project: FundedProject }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const stale = !p.closed && (p.days_since_update ?? 0) > 7;

  async function message() {
    if (p.thread_id) {
      router.push(`/messages?thread=${p.thread_id}`);
      return;
    }
    setOpening(true);
    try {
      const t = await apiClient.openThread({ challenge_id: p.id });
      router.push(`/messages?thread=${t.thread_id}`);
    } catch {
      setOpening(false);
    }
  }

  return (
    <div className={`${p.closed ? "in" : "up-s"} flex flex-col p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
            {p.ref} · {p.district ?? "—"}
          </div>
          <Link href={`/projects/${p.ref}`} className="mt-1 block text-[14.5px] font-bold leading-snug text-navy-dark hover:text-navy">
            {p.title}
          </Link>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <Chip tone={p.closed ? "teal" : "neutral"}>{STATUS_LABEL[p.status] ?? humanise(p.status)}</Chip>
          <span className="mono text-[10px] text-mute">{num(p.my_contributions)} from you</span>
        </div>
      </div>

      {p.college && (
        <div className="mono mt-2 text-[10.5px] text-body">
          <Icon name="grad" size={11} /> {p.college.name}
          {p.college.contact_email ? ` · ${p.college.contact_email}` : ""}
        </div>
      )}

      {p.progress_pct !== null ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
              {p.stages_done} of {p.stages_total} stages done
            </span>
            <span className="mono text-[11px] font-semibold text-navy">{p.progress_pct}%</span>
          </div>
          <Meter
            value={p.progress_pct}
            className="mt-2"
            height={8}
            colour={p.progress_pct === 100 ? "var(--color-teal)" : "var(--color-navy)"}
          />
          <ul className="mt-2 flex flex-col gap-1">
            {p.stages.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
                <span className={`truncate ${s.status === "done" ? "text-teal-ink" : "text-body"}`}>
                  {s.seq}. {s.title}
                </span>
                <span className="mono flex-none text-[9.5px] uppercase tracking-[0.06em] text-mute">
                  {STAGE_STATUS_LABEL[s.status] ?? s.status}
                  {s.completed_at ? ` · ${dateOnly(s.completed_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] leading-relaxed text-body">No delivery plan on record for this project yet.</p>
      )}

      {p.recent_updates.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {p.recent_updates.map((u, i) => (
            <Well small key={i}>
              <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                update {relative(u.at)}
                {i === 0 && stale ? " · overdue" : ""}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink">{u.note}</p>
              {u.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {u.photos.map((ph) => (
                    <a key={ph} href={ph} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph} alt="Progress" className="h-[52px] w-[72px] rounded-md object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </Well>
          ))}
        </div>
      ) : (
        <p className={`mt-3 text-[12.5px] leading-relaxed ${stale ? "text-alert-ink" : "text-body"}`}>
          The college has not posted a progress update yet.
        </p>
      )}

      {p.my_money > 0 && (
        <div className="mono mt-3 text-[10px] uppercase tracking-[0.1em] text-mute">
          your money in this project: {money(p.my_money)}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <ButtonLink href={`/projects/${p.ref}`} variant="secondary" size="sm" icon="eye">
          Open project
        </ButtonLink>
        {p.college && (
          <Button variant="secondary" size="sm" icon="chat" busy={opening} onClick={message}>
            Message the college
          </Button>
        )}
      </div>
    </div>
  );
}

function ContributionRow({ contribution: c, onChanged }: { contribution: Contribution; onChanged: () => void }) {
  const tone = STATE_TONE[c.state] ?? "neutral";
  const [mode, setMode] = useState<"none" | "dispatch" | "withdraw">("none");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMoney = c.kind === "money";

  async function act() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "dispatch") {
        await apiClient.dispatchPledge(c.id, { expected_delivery_date: date || undefined, note: note.trim() || undefined });
      } else if (mode === "withdraw") {
        await apiClient.withdrawPledge(c.id);
      }
      setMode("none");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="up-s p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.1em] text-mute">
            <span>{dateOnly(c.created_at)}</span>
            {c.challenge && (
              <>
                <span>·</span>
                <Link href={`/projects/${c.challenge.ref}`} className="text-navy hover:underline">
                  {c.challenge.ref}
                </Link>
              </>
            )}
            <span>·</span>
            <span>{isMoney ? "funding" : humanise(c.kind)}</span>
          </div>

          <div className="mt-1.5 text-[14.5px] font-bold text-navy-dark">
            {c.amount}
            {c.need ? ` of ${c.need.item}` : ""}
          </div>

          {c.challenge && <div className="mt-1 text-[12.5px] leading-snug text-body">{c.challenge.title}</div>}

          {c.note && (
            <Well small className="mt-2.5">
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{c.note}</p>
            </Well>
          )}

          {c.receipt_note && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-teal-ink">
              <span className="mono text-[9.5px] uppercase tracking-[0.1em]">college noted </span>
              {c.receipt_note}
            </p>
          )}
        </div>

        <div className="flex flex-none flex-col items-end gap-1.5">
          <Chip tone={tone}>{PLEDGE_STATE_LABEL[c.state] ?? humanise(c.state)}</Chip>
          {c.awaiting && (
            <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-alert-ink">awaiting {c.awaiting}</span>
          )}
          {c.challenge?.closed && <Tag>project finished</Tag>}
        </div>
      </div>

      <div className="scroll-x mt-3.5">
        <ol className="flex min-w-[420px] gap-2">
          {[
            { label: "Pledged", at: c.created_at },
            { label: isMoney ? "Transfer expected" : "Expected", at: c.expected_delivery_date },
            { label: isMoney ? "Transferred" : "Sent", at: c.dispatched_at },
            { label: "Received", at: c.received_at },
          ].map((s) => (
            <li key={s.label} className={`flex-1 ${s.at ? "press" : "in-s"} p-2.5`}>
              <div className={`mono text-[9px] font-semibold uppercase tracking-[0.08em] ${s.at ? "text-navy" : "text-mute"}`}>
                {s.label}
              </div>
              <div className={`mono mt-1 text-[10.5px] ${s.at ? "text-ink" : "text-mute"}`}>{s.at ? dateOnly(s.at) : "—"}</div>
            </li>
          ))}
        </ol>
      </div>

      {mode === "none" && (c.can_dispatch || c.can_withdraw) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {c.can_dispatch && (
            <Button variant="primary" size="sm" icon="upload" onClick={() => setMode("dispatch")}>
              {isMoney ? "Mark transferred" : "Mark sent"}
            </Button>
          )}
          {c.can_withdraw && (
            <Button variant="secondary" size="sm" icon="x" onClick={() => setMode("withdraw")}>
              Withdraw
            </Button>
          )}
        </div>
      )}

      {mode === "dispatch" && (
        <div className="mt-3 flex flex-col gap-2">
          {!isMoney && (
            <input className="field max-w-[220px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Expected delivery date" />
          )}
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isMoney ? "UTR 4821-93, transferred to the college account." : "Dispatched by truck, invoice 118."}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" icon="check" busy={busy} onClick={act}>
              Confirm
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMode("none")}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "withdraw" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-semibold text-alert-ink">Withdraw this pledge? The college is relying on it.</span>
          <Button variant="danger" size="sm" busy={busy} onClick={act}>
            Yes, withdraw
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMode("none")}>
            Keep it
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-[12.5px] text-alert-ink">{error}</p>}
    </div>
  );
}
