"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BandChip, Chip, StatusChip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { AssistantPanel } from "@/components/domain/Assistant";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { STATUS_LABEL, bandOf, countdown, hours, humanise, money, num, relative } from "@/lib/format";
import type { Challenge } from "@/types/database";

/**
 * The command centre.
 *
 * Deliberately unflattering. It leads with what is stuck, what is silent and
 * what nobody has touched, because a dashboard that opens with a large green
 * number is a dashboard nobody uses to find problems. The assistant answers
 * questions about any of it from the same record.
 *
 * Where a figure is not computed, it prints an em dash and a sentence saying
 * why. Nothing here is a plausible-looking default.
 */
export default function AdminPage() {
  return (
    <RouteGuard>
      <Command />
    </RouteGuard>
  );
}

function Command() {
  const metrics = useResource(() => apiClient.fetchAdminMetrics(), []);
  const health = useResource(() => apiClient.fetchHealth(), []);
  const challengesRes = useResource(() => apiClient.fetchChallenges({ limit: 500 }), []);

  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [awarding, setAwarding] = useState<string | null>(null);

  const challenges = useMemo<Challenge[]>(
    () => (challengesRes.data?.challenges ?? []).filter((c) => !removed.has(c.id)),
    [challengesRes.data, removed],
  );

  const filteredChallenges = useMemo(() => {
    if (!searchQuery.trim()) return challenges;
    const q = searchQuery.toLowerCase();
    return challenges.filter(
      (c) =>
        c.ref?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        (c.district ? c.district.toLowerCase().includes(q) : false) ||
        c.status?.toLowerCase().includes(q),
    );
  }, [challenges, searchQuery]);

  async function handleDeleteProblem(id: string, ref: string) {
    setDeletingId(id);
    setActionMsg(null);
    try {
      await apiClient.deleteChallenge(id);
      setRemoved((prev) => new Set(prev).add(id));
      setDeleteTarget(null);
      setActionMsg(`Problem ${ref} was permanently removed.`);
      metrics.reload();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Failed to delete problem.");
    } finally {
      setDeletingId(null);
    }
  }

  async function awardNow(challengeId: string, ref: string | null) {
    setAwarding(challengeId);
    setActionMsg(null);
    try {
      const out = await apiClient.awardWindow(challengeId);
      setActionMsg(
        out.outcome === "awarded"
          ? `${ref ?? "The window"} was awarded. ${out.stages_created} delivery stage(s) were drawn from the winning document.`
          : `${ref ?? "The window"} had no viable proposal, so it reopened.`,
      );
      metrics.reload();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "The window could not be closed.");
    } finally {
      setAwarding(null);
    }
  }

  const m = metrics.data;

  const statuses = useMemo(() => {
    if (!m?.by_status) return [];
    const order = [
      "REFINED", "VERIFIED", "OPEN", "TEAM_FORMED", "SOLUTION_PROPOSED", "PILOT", "DEPLOYED",
      "IMPACT_VERIFIED", "CLOSED_NOT_ACTIONABLE", "REPORTED", "NEEDS_FOLLOW_UP", "DUPLICATE",
    ];
    const max = Math.max(...Object.values(m.by_status), 1);
    return order.filter((k) => m.by_status[k] !== undefined).map((k) => ({ key: k, value: m.by_status[k], max }));
  }, [m]);

  const districts = useMemo(() => {
    if (!m?.by_district) return [];
    return Object.entries(m.by_district)
      .filter(([k]) => k && k !== "null")
      .sort((a, b) => b[1] - a[1]);
  }, [m]);

  const worstSevere = m?.severe_open?.[0] ?? null;

  return (
    <>
      <PageHead
        eyebrow="System owner"
        title="Command centre"
        lede="Every role, every table, every timing. Written to show what is stuck rather than what looks good — and the assistant answers questions about any of it from the record."
        right={
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink href="/admin/sla" variant="primary" icon="clock">
              SLA &amp; timings
            </ButtonLink>
            <ButtonLink href="/admin/ledger" variant="secondary" icon="shield">
              Ledger
            </ButtonLink>
            <a href="#manage-problems" className="btn-2 flex items-center gap-1.5 text-[13px]">
              <Icon name="trash" size={14} />
              Manage problems
            </a>
          </div>
        }
      />

      <Main>
        {actionMsg && (
          <div className="in-s flex items-center justify-between p-3.5" role="status">
            <span className="text-[13px] font-medium text-ink">{actionMsg}</span>
            <button type="button" onClick={() => setActionMsg(null)} className="text-mute hover:text-ink" aria-label="Dismiss message">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        {metrics.loading && !metrics.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={3} height={200} />
          </>
        ) : metrics.error ? (
          <ErrorNote message={metrics.error} code={metrics.code} onRetry={metrics.reload} />
        ) : !m ? null : (
          <>
            {/* ---- where everything is -------------------------------------- */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Awaiting verification" value={num(m.totals.awaiting_verification)} sub="AI could not confirm; a verifier must" tone={m.totals.awaiting_verification > 0 ? "alert" : undefined} />
              <Stat label="Open to colleges" value={num(m.totals.open_to_colleges)} sub="Verified, not yet awarded" />
              <Stat label="In delivery" value={num(m.totals.in_delivery)} sub="Awarded: being funded or built" />
              <Stat label="Solved" value={num(m.totals.solved)} sub={`${num(m.totals.severe_solved)} of them severe`} tone={m.totals.solved > 0 ? "teal" : undefined} />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Severe and still open"
                value={num(m.totals.severe_open)}
                sub={worstSevere ? `${worstSevere.ref} open ${num(worstSevere.age_days)} days` : "None open"}
                tone={m.totals.severe_open > 0 ? "alert" : undefined}
              />
              <Stat
                label="Median time to verify"
                value={m.median_verification_hours === null ? "—" : hours(m.median_verification_hours)}
                sub={m.median_verification_hours === null ? "No verified rows with real timestamps yet" : "Report to verification"}
              />
              <Stat
                label="Verified by AI"
                value={m.verification.ai_share_pct === null ? "—" : `${m.verification.ai_share_pct}%`}
                sub={`${num(m.verification.ai_verified)} by AI · ${num(m.verification.human_verified)} by people · ${num(m.verification.rejected)} rejected`}
              />
              <Stat
                label="Proposals rejected by AI"
                value={num(m.proposals.not_viable)}
                sub={`of ${num(m.proposals.total)} submitted · ${num(m.proposals.awaiting_score)} being analysed`}
              />
            </div>

            <AssistantPanel
              suggestions={[
                "What happened in the last week?",
                "Which severe problems have waited longest, and why?",
                "Which colleges have gone quiet on progress?",
                "How much funding was pledged versus received?",
              ]}
            />

            {/* ---- severe, by age ------------------------------------------- */}
            <Panel
              title="Severe problems still open"
              lede="Priority 75 and above, oldest first, with how long since each was listed for colleges."
            >
              {m.severe_open.length === 0 ? (
                <Empty icon="check" title="No severe problem is open" why="Every problem scoring 75 or above has been solved or closed." />
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {m.severe_open.map((s) => (
                    <li key={s.id}>
                      <Link href={`/admin/challenges/${s.ref}`} className="up-s up-hit flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                            {s.ref} · {s.district ?? "—"} · priority {s.priority}
                          </div>
                          <div className="mt-1 truncate text-[13.5px] font-semibold text-ink">{s.title}</div>
                        </div>
                        <div className="flex flex-none flex-wrap items-center gap-2">
                          <StatusChip status={s.status} />
                          <Chip tone={(s.age_days ?? 0) > 14 ? "alert" : "high"}>open {num(s.age_days)}d</Chip>
                          <Tag>{s.listed_days === null ? "not listed yet" : `listed ${num(s.listed_days)}d`}</Tag>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* ---- open proposal windows --------------------------------- */}
              <Panel title="Proposal windows open" lede="Closed by the clock, or now — anything still being analysed is scored first.">
                {m.open_windows.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-body">No window is open. One opens when a college submits the first proposal on a verified problem.</p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {m.open_windows.map((w) => {
                      const cd = countdown(w.closes_at);
                      return (
                        <li key={w.challenge_id} className="up-s p-3.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <Link href={`/admin/challenges/${w.ref}`} className="min-w-0 hover:underline">
                              <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">{w.ref} · {w.district ?? "—"}</div>
                              <div className="mt-0.5 truncate text-[13px] font-semibold text-ink">{w.title}</div>
                            </Link>
                            <Chip tone={cd.urgent ? "alert" : "moderate"}>{cd.text}</Chip>
                          </div>
                          <div className="mono mt-1.5 text-[10.5px] text-body">
                            {w.proposals} proposal(s) · {w.viable} viable · {w.awaiting_score} being analysed · leader {w.leader_score ?? "none"}
                          </div>
                          <div className="mt-2">
                            <Button variant="secondary" size="sm" icon="trophy" busy={awarding === w.challenge_id} onClick={() => awardNow(w.challenge_id, w.ref)}>
                              Close and award now
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              {/* ---- delivery and quiet projects ---------------------------- */}
              <Panel
                title="Projects in delivery"
                lede={
                  m.cadence.average_gap_days === null
                    ? "How often each college reports progress."
                    : `Colleges post a progress update every ${m.cadence.average_gap_days} days on average.`
                }
              >
                {m.delivery.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-body">No project is in delivery yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {m.delivery.map((d) => (
                      <li key={d.id}>
                        <Link href={`/admin/challenges/${d.ref}`} className="up-s up-hit flex flex-wrap items-center justify-between gap-3 p-3.5">
                          <div className="min-w-0">
                            <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                              {d.ref} · {d.college ?? "—"}
                            </div>
                            <div className="mt-0.5 truncate text-[13px] font-semibold text-ink">{d.title}</div>
                            <div className="mono mt-0.5 text-[10px] text-mute">
                              {d.updates} update(s){d.average_gap_days !== null ? ` · every ${d.average_gap_days}d` : ""}
                            </div>
                          </div>
                          <Chip tone={(d.days_since_update ?? 0) >= 7 ? "alert" : "teal"}>
                            {d.days_since_update === null ? "no update" : `${num(d.days_since_update)}d since update`}
                          </Chip>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {m.quiet_projects.length > 0 && (
                  <p className="mt-3 text-[12.5px] font-semibold text-alert-ink">
                    {m.quiet_projects.length} project(s) quiet for a week or more.
                  </p>
                )}
              </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Where everything is sitting" lede="The whole pipeline by status. A pile-up at one stage is the bottleneck.">
                <ul className="flex flex-col gap-3">
                  {statuses.map((s) => (
                    <li key={s.key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-semibold text-ink">{STATUS_LABEL[s.key] ?? humanise(s.key)}</span>
                        <span className="mono text-[12px] font-semibold text-navy">{num(s.value)}</span>
                      </div>
                      <Meter value={s.value} max={s.max} height={7} className="mt-1.5" />
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Funding and proposals" lede="Pledged is a promise; received is a fact.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="up-s p-4">
                    <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Money pledged</div>
                    <div className="mono mt-1.5 text-[22px] font-semibold text-ink">{money(m.funding.money_pledged)}</div>
                  </div>
                  <div className="up-s p-4">
                    <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Money received</div>
                    <div className="mono mt-1.5 text-[22px] font-semibold text-teal-ink">{money(m.funding.money_received)}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">material contributions received</span>
                    <span className="mono text-[12px] font-semibold text-navy">
                      {num(m.funding.material_lines_received)} / {num(m.funding.material_lines)}
                    </span>
                  </div>
                  <Meter value={m.funding.material_lines_received} max={Math.max(m.funding.material_lines, 1)} height={8} className="mt-2" colour="var(--color-teal)" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ["Viable", m.proposals.viable],
                    ["Needs changes", m.proposals.needs_changes],
                    ["Awarded", m.proposals.awarded],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="in-s p-3">
                      <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-mute">{label}</div>
                      <div className="mono mt-1 text-[18px] font-semibold text-ink">{num(Number(value))}</div>
                    </div>
                  ))}
                </div>
                {m.proposals.scored_by_rules > 0 && (
                  <p className="mt-3 text-[12px] leading-relaxed text-body">
                    {m.proposals.scored_by_rules} proposal(s) were scored by the published rules because no AI model was available.
                  </p>
                )}
                <p className="mono mt-3 text-[10.5px] text-mute">
                  median {m.solved.median_days_to_solve === null ? "—" : `${m.solved.median_days_to_solve} days`} from report to work complete
                </p>
              </Panel>
            </div>

            {/* ---- manage problems ------------------------------------------- */}
            <div id="manage-problems" className="scroll-mt-6">
              <Panel
                title="Manage problems"
                lede="Statewide registry. Open a problem's full record, or permanently delete one."
                right={<span className="mono in-s px-3 py-1 text-[11px] font-semibold text-navy">{num(filteredChallenges.length)} problems</span>}
              >
                <div className="mb-4">
                  <input
                    type="text"
                    className="field text-[13.5px]"
                    placeholder="Filter by ref (e.g. C-100), title, district, or status..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {challengesRes.loading && !challengesRes.settled ? (
                  <SkeletonRows rows={4} height={68} />
                ) : filteredChallenges.length === 0 ? (
                  <Empty
                    icon="file"
                    title="No matching problems found"
                    why={searchQuery ? `No problems match "${searchQuery}".` : "No problems are currently filed in the system."}
                  />
                ) : (
                  <ul className="flex max-h-[640px] flex-col gap-3 overflow-y-auto pr-1">
                    {filteredChallenges.slice(0, 150).map((c) => {
                      const isDeleting = deletingId === c.id;
                      const isTarget = deleteTarget === c.id;
                      return (
                        <li key={c.id} className="up-s flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="mono text-[11px] font-bold text-navy">{c.ref}</span>
                              <BandChip band={c.band ?? bandOf(c.priority)} />
                              <StatusChip status={c.status} />
                              <span className="in-s px-2 py-0.5 text-[10.5px] font-medium text-body">{c.district}</span>
                            </div>
                            <div className="mt-1.5 text-[14px] font-bold text-ink">{c.title}</div>
                            <div className="mono mt-1 text-[11px] text-mute">
                              Priority {num(c.priority)}/100 · {num(c.report_count ?? 1)} reports · moved {relative(c.updated_at)}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <ButtonLink href={`/admin/challenges/${c.ref}`} variant="secondary" size="sm" icon="file">
                              Full record
                            </ButtonLink>
                            {!isTarget ? (
                              <Button variant="danger" size="sm" icon="trash" onClick={() => setDeleteTarget(c.id)}>
                                Delete
                              </Button>
                            ) : (
                              <div className="in-s flex items-center gap-1.5 rounded-xl p-1">
                                <span className="px-2 text-[11px] font-bold text-alert-ink">Permanently delete?</span>
                                <Button variant="danger" size="sm" busy={isDeleting} onClick={() => handleDeleteProblem(c.id, c.ref)}>
                                  Yes, delete
                                </Button>
                                <Button variant="secondary" size="sm" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>

            <Panel title="By district" lede="Volume, not need. A district with more problems on the list may simply have more people reporting.">
              <div className="scroll-x">
                <div className="grid min-w-[560px] grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-3">
                  {districts.map(([name, count]) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="mono w-[52px] flex-none text-right text-[12px] font-semibold text-ink">{num(count)}</span>
                      <span className="flex-1">
                        <Meter value={count} max={districts[0]?.[1] ?? 1} height={6} />
                      </span>
                      <span className="w-[130px] flex-none truncate text-[12.5px] text-body">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="What this deployment can and cannot do" lede="Read live from the service. Missing capabilities are named, not hidden.">
              {health.loading && !health.settled ? (
                <SkeletonRows rows={2} height={64} />
              ) : health.error ? (
                <ErrorNote message={health.error} code={health.code} onRetry={health.reload} />
              ) : health.data ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Capability on={health.data.database.connected} label="Database" detail={`${num(health.data.database.challenges)} challenges · ${num(health.data.database.regions)} regions`} />
                  <Capability
                    on={health.data.ai.enabled}
                    label="AI (compiler, verification, proposal review, assistant)"
                    detail={
                      health.data.ai.enabled
                        ? `${health.data.ai.provider} · ${health.data.ai.gemini_keys_count} key(s)`
                        : "No AI key: published rules run every step instead, and each result says so"
                    }
                  />
                  <Capability on={health.data.ai.speech_to_text} label="Voice transcription" detail={health.data.ai.speech_to_text ? "Whisper, with silence refused rather than invented" : "No key: voice reports are refused, not guessed at"} />
                  <Capability on={health.data.ai.remote_embeddings} label="Semantic deduplication" detail={health.data.ai.remote_embeddings ? "Embeddings from the model" : "Local vectoriser: near-duplicates in different words may be missed"} />
                  <Capability on={health.data.sms.inbound_secret_set} label="SMS in" detail={health.data.sms.inbound_secret_set ? "Gateway secret set" : "No secret: inbound SMS is rejected"} />
                  <Capability on={health.data.sms.outbound_gateway} label="SMS out" detail={health.data.sms.outbound_gateway ? `Sending from ${health.data.sms.number ?? "the configured number"}` : "No gateway: in-app notifications only"} />
                </div>
              ) : null}
            </Panel>

            {Object.keys(m.sla ?? {}).length === 0 && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-0.5 text-mute">
                  <Icon name="clock" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  No stage timing has been recorded yet. Stage-by-stage targets and breaches are on the{" "}
                  <Link href="/admin/sla" className="font-semibold text-navy">
                    SLA page
                  </Link>
                  .
                </p>
              </Card>
            )}
          </>
        )}
      </Main>
    </>
  );
}

function Capability({ on, label, detail }: { on: boolean; label: string; detail: string }) {
  return (
    <div className={`${on ? "up-s" : "in-s"} flex items-start gap-3 p-3.5`}>
      <span className={`mt-0.5 flex-none ${on ? "text-teal-ink" : "text-alert-ink"}`}>
        <Icon name={on ? "check" : "x"} size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-bold text-ink">{label}</div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-body">{detail}</p>
      </div>
    </div>
  );
}
