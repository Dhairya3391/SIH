"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { BackLink, Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BandChip, Chip, ConfidenceChip, StatusChip } from "@/components/ui/Chip";
import { ErrorNote, Skeleton } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import {
  DurationSummary,
  GapStrip,
  StageTracker,
  TimelineList,
} from "@/components/domain/Timeline";
import { WindowState } from "@/components/domain/Competition";
import { ScoreFactors } from "@/components/domain/ScoreFactors";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { bandOf, dateTime, humanise, num } from "@/lib/format";

/**
 * One challenge, every entry, with the gaps.
 *
 * The question a review panel always asks is not "what happened" but "how long
 * did each step take". So the gap between events is a column of its own and a
 * strip drawn to scale, and anything over two days is flagged — the
 * interesting number in this system is never the total, it is where the total
 * went.
 */
export default function ChallengeHistoryPage() {
  return (
    <RouteGuard>
      <History />
    </RouteGuard>
  );
}

const COUNT_LABEL: Record<string, string> = {
  reports: "Reports",
  external_checks: "AI checks",
  verifications: "Verifications",
  proposals: "Proposals",
  contributions: "Contributions",
  progress_updates: "Updates",
  ledger_entries: "Ledger",
  threads: "Threads",
};

function History() {
  const router = useRouter();
  const params = useParams<{ ref: string }>();
  const reference = params?.ref ?? "";
  const res = useResource(() => apiClient.fetchChallengeHistory(reference), [reference], {
    enabled: Boolean(reference),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const d = res.data;
  const c = d?.challenge;

  async function onDelete() {
    if (!c) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.deleteChallenge(c.id);
      router.replace("/admin");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this challenge.");
      setDeleting(false);
    }
  }

  if (res.loading && !res.settled) {
    return (
      <>
        <BackLink href="/admin" label="Command centre" />
        <Main className="pt-6">
          <Skeleton height={110} rounded={18} />
          <Skeleton height={160} rounded={18} />
          <Skeleton height={420} rounded={18} />
        </Main>
      </>
    );
  }

  if (res.error || !c || !d) {
    return (
      <>
        <BackLink href="/admin" label="Command centre" />
        <Main className="pt-6">
          <ErrorNote
            message={res.error ?? `No record is filed under ${reference}.`}
            code={res.code}
            onRetry={res.reload}
          />
        </Main>
      </>
    );
  }

  const counts = Object.entries(d.counts ?? {});

  return (
    <>
      <BackLink href="/admin" label="Command centre" trail={c.ref} />

      <PageHead
        eyebrow="Complete record"
        title={`${c.ref} — every entry, in order`}
        lede={`${c.title} Read from the same endpoint the narrator uses, so this page and the narration can never disagree.`}
        right={
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <DurationSummary
              from={c.created_at}
              to={c.closed_at ?? null}
              longestGapHours={d.longest_gap_hours}
            />
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href={`/challenge/${c.ref}`} variant="secondary" size="sm" icon="eye">
                The brief
              </ButtonLink>
              {!confirmDelete ? (
                <Button
                  variant="danger"
                  size="sm"
                  icon="trash"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete problem
                </Button>
              ) : (
                <div className="in-s flex items-center gap-1.5 rounded-xl p-1">
                  <span className="px-2 text-[11.5px] font-bold text-alert-ink">
                    Permanently delete?
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    busy={deleting}
                    onClick={onDelete}
                  >
                    Yes, delete
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {deleteError && (
        <div className="shell pt-4">
          <ErrorNote message={deleteError} />
        </div>
      )}

      <Main>
        <div className="flex flex-wrap items-center gap-2">
          <BandChip band={c.band ?? bandOf(c.priority)} />
          <ConfidenceChip confidence={c.confidence} />
          <StatusChip status={c.status} />
          {c.is_simulated && <Chip tone="neutral">Seeded row</Chip>}
        </div>

        {/* ---- counts ------------------------------------------------- */}
        {counts.length > 0 && (
          <div className="scroll-x">
            <div
              className="grid gap-2.5"
              style={{
                gridTemplateColumns: `repeat(${Math.min(counts.length, 8)}, minmax(96px, 1fr))`,
                minWidth: counts.length > 4 ? 680 : undefined,
              }}
            >
              {counts.map(([key, value]) => (
                <div key={key} className="up-s p-3">
                  <div className="mono text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] text-mute">
                    {COUNT_LABEL[key] ?? humanise(key)}
                  </div>
                  <div className="mono mt-1 text-[20px] font-semibold text-ink">
                    {num(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- the gap strip ------------------------------------------ */}
        <Panel
          title="Time between each step"
          lede="Bar width is the gap, to scale. Anything over two days is flagged."
          right={
            <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
              {num(d.timeline.length)} entries
            </span>
          }
        >
          {d.timeline.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-body">
              No entries yet, so there are no gaps to draw.
            </p>
          ) : (
            <GapStrip events={d.timeline} />
          )}
        </Panel>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="flex flex-col gap-5">
            <Panel
              title="The record"
              lede="Every entry names its actor. The gap column is the time since the previous entry."
            >
              <TimelineList events={d.timeline} />
            </Panel>

            {d.stages.length > 0 && (
              <Panel
                title="Execution plan"
                lede="Generated from the awarded proposal, then worked through stage by stage."
              >
                <StageTracker stages={d.stages} />
              </Panel>
            )}
          </div>

          <aside className="flex flex-col gap-5">
            <Panel title="The proposal window">
              <WindowState
                competition={
                  d.window
                    ? {
                        state: d.window.state,
                        opened_at: d.window.opened_at,
                        closes_at: d.window.closes_at,
                        closed_at: d.window.closed_at,
                        window_days: d.window.window_days,
                        leader_score: d.window.leader_score,
                        leader_changed_at: d.window.leader_changed_at,
                        awarded_proposal_id: d.window.awarded_proposal_id,
                        reopen_count: d.window.reopen_count,
                      }
                    : { state: "not_opened" }
                }
              />
              {d.window && (
                <dl className="mt-4 flex flex-col">
                  <Row label="Opened" value={dateTime(d.window.opened_at)} />
                  <Row label="Length" value={`${d.window.window_days} days`} />
                  <Row label="Closes" value={dateTime(d.window.closes_at)} />
                  <Row
                    label="Closed"
                    value={d.window.closed_at ? dateTime(d.window.closed_at) : "still open"}
                  />
                  <Row
                    label="Lead last changed"
                    value={
                      d.window.leader_changed_at
                        ? dateTime(d.window.leader_changed_at)
                        : "never changed"
                    }
                  />
                  <Row label="Reopened" value={`${d.window.reopen_count} time(s)`} />
                </dl>
              )}
            </Panel>

            {d.needs.length > 0 && (
              <Panel
                title="Itemised needs"
                lede="What the awarded proposal broke down into."
                depth="in"
              >
                <ul className="flex flex-col gap-2">
                  {d.needs.map((n) => (
                    <li key={n.id} className="up-s p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-semibold text-ink">{n.item}</span>
                        <span className="mono flex-none text-[11px] text-mute">
                          {num(n.qty_needed)} {n.unit}
                        </span>
                      </div>
                      <div className="mono mt-1 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                        {humanise(n.kind)}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="Score at the time of ranking">
              <ScoreFactors
                breakdown={c.score_breakdown}
                whyCritical={c.why_critical}
                compact
              />
            </Panel>

            <Card depth="in" className="p-4">
              <div className="flex items-start gap-2.5">
                <span className="mt-px text-mute">
                  <Icon name="shield" size={14} />
                </span>
                <p className="text-[12px] leading-relaxed text-body">
                  This is the whole record for one challenge, including entries your role would
                  not normally see. Nothing here is editable — the record is append-only, which is
                  what makes the gap column trustworthy.
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Longest gap"
                value={
                  d.longest_gap_hours === null || d.longest_gap_hours === undefined
                    ? "—"
                    : `${Math.round(d.longest_gap_hours)}h`
                }
                sub="Between two consecutive entries"
                tone={(d.longest_gap_hours ?? 0) > 48 ? "alert" : undefined}
              />
              <Stat
                label="Reports behind it"
                value={num(c.report_count)}
                sub={`${num(c.reporter_count)} separate reporters`}
              />
            </div>
          </aside>
        </div>
      </Main>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="hairline flex items-baseline justify-between gap-3 py-2 first:border-t-0">
      <dt className="mono text-[10px] uppercase tracking-[0.1em] text-mute">{label}</dt>
      <dd className="mono text-right text-[11px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
