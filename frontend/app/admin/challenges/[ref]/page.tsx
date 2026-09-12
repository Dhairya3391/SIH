"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { BackLink, Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BandChip, Chip, ConfidenceChip, StatusChip, Tag } from "@/components/ui/Chip";
import { ErrorNote, Skeleton } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { DurationSummary, GapStrip, StageTracker, TimelineList } from "@/components/domain/Timeline";
import { WindowState } from "@/components/domain/Competition";
import { ScoreFactors } from "@/components/domain/ScoreFactors";
import { AssistantPanel } from "@/components/domain/Assistant";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { PLEDGE_STATE_LABEL, bandOf, dateTime, humanise, money, num, quantity } from "@/lib/format";

/**
 * One challenge, every entry, with the gaps.
 *
 * The questions a review always asks are "what happened" and "how long did
 * each step take". So every event carries its actor and the gap since the one
 * before; the college's progress updates have their own cadence panel; every
 * contribution shows when it was pledged, sent and received; and the assistant
 * explains the whole thing in words from the same record.
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
  messages: "Messages",
  ledger_entries: "Ledger",
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
  const [awarding, setAwarding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const d = res.data;
  const c = d?.challenge;

  async function onDelete() {
    if (!c) return;
    setDeleting(true);
    setNotice(null);
    try {
      await apiClient.deleteChallenge(c.id);
      router.replace("/admin");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete this challenge.");
      setDeleting(false);
    }
  }

  async function onAward() {
    if (!c) return;
    setAwarding(true);
    setNotice(null);
    try {
      const out = await apiClient.awardWindow(c.id);
      setNotice(out.outcome === "awarded" ? `Awarded. ${out.stages_created} delivery stage(s) created.` : "No viable proposal: the window reopened.");
      res.reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The window could not be closed.");
    } finally {
      setAwarding(false);
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
          <ErrorNote message={res.error ?? `No record is filed under ${reference}.`} code={res.code} onRetry={res.reload} />
        </Main>
      </>
    );
  }

  const counts = Object.entries(d.counts ?? {});
  const windowOpen = d.window?.state === "open";
  const cadence = d.progress_cadence;

  return (
    <>
      <BackLink href="/admin" label="Command centre" trail={c.ref} />

      <PageHead
        eyebrow="Complete record"
        title={`${c.ref} — every entry, in order`}
        lede={c.title}
        right={
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <DurationSummary from={c.created_at} to={c.closed_at ?? c.deployed_at ?? null} longestGapHours={d.longest_gap_hours} />
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href={`/challenge/${c.ref}`} variant="secondary" size="sm" icon="eye">
                The brief
              </ButtonLink>
              {d.stages.length > 0 && (
                <ButtonLink href={`/projects/${c.ref}`} variant="secondary" size="sm" icon="box">
                  Project
                </ButtonLink>
              )}
              {windowOpen && (
                <Button variant="primary" size="sm" icon="trophy" busy={awarding} onClick={onAward}>
                  Close and award now
                </Button>
              )}
              {!confirmDelete ? (
                <Button variant="danger" size="sm" icon="trash" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              ) : (
                <div className="in-s flex items-center gap-1.5 rounded-xl p-1">
                  <span className="px-2 text-[11.5px] font-bold text-alert-ink">Permanently delete?</span>
                  <Button variant="danger" size="sm" busy={deleting} onClick={onDelete}>
                    Yes, delete
                  </Button>
                  <Button variant="secondary" size="sm" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        }
      />

      <Main>
        {notice && (
          <div className="in-s flex items-center justify-between p-3.5" role="status">
            <span className="text-[13px] font-medium text-ink">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-mute" aria-label="Dismiss">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <BandChip band={c.band ?? bandOf(c.priority)} />
          <ConfidenceChip confidence={c.confidence} />
          <StatusChip status={c.status} />
          {c.is_simulated && <Chip tone="neutral">Seeded row</Chip>}
        </div>

        {counts.length > 0 && (
          <div className="scroll-x">
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: `repeat(${Math.min(counts.length, 8)}, minmax(96px, 1fr))`, minWidth: counts.length > 4 ? 680 : undefined }}
            >
              {counts.map(([key, value]) => (
                <div key={key} className="up-s p-3">
                  <div className="mono text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] text-mute">
                    {COUNT_LABEL[key] ?? humanise(key)}
                  </div>
                  <div className="mono mt-1 text-[20px] font-semibold text-ink">{num(value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <AssistantPanel
          title="Explain this problem"
          challengeRef={c.ref}
          suggestions={[
            `Explain everything that happened to ${c.ref}`,
            "What did the colleges propose, and how was each scored?",
            "How long did each contribution take to arrive?",
            "How regular are the college's progress updates?",
          ]}
        />

        <Panel
          title="Time between each step"
          lede="Bar width is the gap, to scale. Anything over two days is flagged."
          right={<span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">{num(d.timeline.length)} entries</span>}
        >
          {d.timeline.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-body">No entries yet, so there are no gaps to draw.</p>
          ) : (
            <GapStrip events={d.timeline} />
          )}
        </Panel>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <div className="flex flex-col gap-5">
            <Panel title="The record" lede="Every entry names its actor. The gap column is the time since the previous entry.">
              <TimelineList events={d.timeline} />
            </Panel>

            <Panel
              title="Progress updates from the college"
              lede={
                cadence.updates.length === 0
                  ? "None posted yet."
                  : `${cadence.updates.length} update(s) · every ${cadence.average_gap_days ?? "—"} days on average · longest gap ${cadence.longest_gap_days ?? "—"} days · last one ${cadence.days_since_last_update ?? "—"} days ago`
              }
            >
              {cadence.updates.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-body">
                  Updates appear here with the time since the previous one as the college posts them.
                </p>
              ) : (
                <ol className="flex flex-col">
                  {cadence.updates
                    .slice()
                    .reverse()
                    .map((u, i) => (
                      <li key={`${u.at}-${i}`} className={`flex gap-3 py-3 ${i > 0 ? "hairline" : ""}`}>
                        <span className={`mono w-[92px] flex-none text-[10.5px] ${(u.gap_days ?? 0) > 7 ? "font-semibold text-alert-ink" : "text-mute"}`}>
                          {u.gap_days === null ? "first" : `+${u.gap_days} days`}
                        </span>
                        <div className="min-w-0">
                          <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                            {dateTime(u.at)} IST{u.author ? ` · ${u.author}` : ""}
                          </div>
                          <p className="mt-1 text-[13px] leading-relaxed text-ink">{u.note}</p>
                          {u.photos.length > 0 && <Tag icon={<Icon name="camera" size={11} />}>{u.photos.length} photo(s)</Tag>}
                        </div>
                      </li>
                    ))}
                </ol>
              )}
            </Panel>

            {d.contributions.length > 0 && (
              <Panel title="Contributions, with their dates" lede="Pledged, sent and received — and how long receipt took.">
                <div className="scroll-x">
                  <table className="w-full min-w-[640px] text-left text-[12.5px]">
                    <thead>
                      <tr className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                        <th className="py-2 pr-3">Organisation</th>
                        <th className="py-2 pr-3">What</th>
                        <th className="py-2 pr-3">State</th>
                        <th className="py-2 pr-3">Pledged</th>
                        <th className="py-2 pr-3">Sent</th>
                        <th className="py-2 pr-3">Received</th>
                        <th className="py-2">Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.contributions.map((k) => (
                        <tr key={k.id} className="hairline align-top">
                          <td className="py-2.5 pr-3 font-semibold text-ink">{k.org}</td>
                          <td className="py-2.5 pr-3 text-body">
                            {quantity(k.qty, k.unit, k.kind)} {k.kind === "money" ? "" : k.item}
                          </td>
                          <td className="py-2.5 pr-3">{PLEDGE_STATE_LABEL[k.state] ?? k.state}</td>
                          <td className="mono py-2.5 pr-3 text-[11px]">{dateTime(k.pledged_at)}</td>
                          <td className="mono py-2.5 pr-3 text-[11px]">{k.dispatched_at ? dateTime(k.dispatched_at) : "—"}</td>
                          <td className="mono py-2.5 pr-3 text-[11px]">{k.received_at ? dateTime(k.received_at) : "—"}</td>
                          <td className="mono py-2.5 text-[11px]">{k.days_to_receive ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

            {d.proposals.length > 0 && (
              <Panel title="What each college proposed" lede="Every submission, its score and the reviewer's verdict.">
                <ul className="flex flex-col gap-3">
                  {d.proposals.map((p) => (
                    <li key={p.id} className="up-s p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-[14px] font-bold text-ink">{p.org}</div>
                          <div className="mono mt-0.5 text-[10px] uppercase tracking-[0.08em] text-mute">
                            v{p.version} · {dateTime(p.submitted_at)} · {p.document_name ?? "document"}
                            {p.ai_rubric?.source === "rules" ? " · rule-based rubric" : p.ai_model ? ` · ${p.ai_model}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Chip tone={p.state === "winner" ? "teal" : p.ai_verdict === "not_viable" ? "alert" : "neutral"}>
                            {p.state === "winner" ? "Won" : humanise(p.state)}
                          </Chip>
                          <span className="mono text-[18px] font-semibold text-ink">{p.ai_score ?? "—"}</span>
                        </div>
                      </div>
                      <div className="mono mt-1.5 text-[11px] text-body">
                        asks {money(p.funding_required)} · {p.duration_days ?? "—"} days · verdict {humanise(p.ai_verdict ?? "pending")}
                      </div>
                      {p.ai_rubric?.summary && (
                        <Well small className="mt-2">
                          <p className="text-[12.5px] leading-relaxed text-body">{p.ai_rubric.summary}</p>
                        </Well>
                      )}
                      {(p.ai_rubric?.required_changes?.length ?? 0) > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-[12px] leading-relaxed text-alert-ink">
                          {p.ai_rubric!.required_changes.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {d.stages.length > 0 && (
              <Panel title="Execution plan" lede="Generated from the awarded proposal, then worked through stage by stage.">
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
                  <Row label="Closed" value={d.window.closed_at ? dateTime(d.window.closed_at) : "still open"} />
                  <Row label="Reopened" value={`${d.window.reopen_count} time(s)`} />
                </dl>
              )}
            </Panel>

            {d.needs.length > 0 && (
              <Panel title="Requirements published" depth="in">
                <ul className="flex flex-col gap-2">
                  {d.needs.map((n) => (
                    <li key={n.id} className="up-s p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-semibold text-ink">{n.item}</span>
                        <span className="mono flex-none text-[11px] text-mute">{quantity(n.qty_needed, n.unit, n.kind)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="Score at the time of ranking">
              <ScoreFactors breakdown={c.score_breakdown} whyCritical={c.why_critical} compact />
            </Panel>

            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Longest gap"
                value={d.longest_gap_hours === null || d.longest_gap_hours === undefined ? "—" : `${Math.round(d.longest_gap_hours)}h`}
                sub="Between two consecutive entries"
                tone={(d.longest_gap_hours ?? 0) > 48 ? "alert" : undefined}
              />
              <Stat label="Reports behind it" value={num(c.report_count)} sub={`${num(c.reporter_count)} separate reporters`} />
            </div>

            <Card depth="in" className="p-4">
              <div className="flex items-start gap-2.5">
                <span className="mt-px text-mute">
                  <Icon name="shield" size={14} />
                </span>
                <p className="text-[12px] leading-relaxed text-body">
                  The whole record for one challenge, including entries other roles would not see.
                  The ledger is append-only, which is what makes the gaps trustworthy.
                </p>
              </div>
            </Card>
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
