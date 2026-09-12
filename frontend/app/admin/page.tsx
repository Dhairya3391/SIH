"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BandChip, Chip, StatusChip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, NotMeasured, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { STATUS_LABEL, bandOf, hours, humanise, money, num } from "@/lib/format";
import type { Challenge } from "@/types/database";

/**
 * The command centre.
 *
 * Deliberately unflattering. It leads with what is stuck, what is silent and
 * what nobody has touched, because a dashboard that opens with a large green
 * number is a dashboard nobody uses to find problems.
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
  const challengesRes = useResource(() => apiClient.fetchChallenges({ limit: 100 }), []);

  const [localChallenges, setLocalChallenges] = useState<Challenge[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const challenges = localChallenges ?? challengesRes.data?.challenges ?? [];

  useEffect(() => {
    if (challengesRes.data?.challenges && localChallenges === null) {
      setLocalChallenges(challengesRes.data.challenges);
    }
  }, [challengesRes.data?.challenges, localChallenges]);

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
      setLocalChallenges((prev) => (prev ?? challenges).filter((c) => c.id !== id));
      setDeleteTarget(null);
      setActionMsg(`Problem ${ref} was permanently removed.`);
      metrics.reload();
      challengesRes.reload();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Failed to delete problem.");
    } finally {
      setDeletingId(null);
    }
  }

  const m = metrics.data;

  const statuses = useMemo(() => {
    if (!m?.by_status) return [];
    const order = [
      "REPORTED",
      "REFINED",
      "VERIFIED",
      "OPEN",
      "TEAM_FORMED",
      "SOLUTION_PROPOSED",
      "PILOT",
      "DEPLOYED",
      "IMPACT_VERIFIED",
    ];
    const max = Math.max(...Object.values(m.by_status), 1);
    return order
      .filter((k) => m.by_status[k] !== undefined)
      .map((k) => ({ key: k, value: m.by_status[k], max }));
  }, [m]);

  const districts = useMemo(() => {
    if (!m?.by_district) return [];
    return Object.entries(m.by_district)
      .filter(([k]) => k && k !== "null")
      .sort((a, b) => b[1] - a[1]);
  }, [m]);

  const worstSevereAge = m?.severe_open_ages_days?.length
    ? Math.max(...m.severe_open_ages_days)
    : null;

  return (
    <>
      <PageHead
        eyebrow="System owner"
        title="Command centre"
        lede="Every role, every table, every timing. This screen is written to show what is stuck rather than what looks good — the flattering numbers are on the impact page."
        right={
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink href="/admin/sla" variant="primary" icon="clock">
              SLA &amp; timings
            </ButtonLink>
            <ButtonLink href="/admin/ledger" variant="secondary" icon="shield">
              Ledger
            </ButtonLink>
          </div>
        }
      />

      <Main>
        {metrics.loading && !metrics.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={3} height={200} />
          </>
        ) : metrics.error ? (
          <ErrorNote message={metrics.error} code={metrics.code} onRetry={metrics.reload} />
        ) : !m ? null : (
          <>
            {/* ---- what is wrong, first --------------------------------- */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Open problems"
                value={num(m.totals.open)}
                sub={`of ${num(m.totals.challenges)} on record`}
              />
              <Stat
                label="Severe and still open"
                value={num(m.totals.severe_open)}
                sub={
                  worstSevereAge === null
                    ? "None open"
                    : `oldest has been open ${num(worstSevereAge)} days`
                }
                tone={m.totals.severe_open > 0 ? "alert" : undefined}
              />
              {/* A median of exactly zero is a timestamp artifact, not a
                  record-breaking verification time. Say which it is. */}
              <Stat
                label="Median time to verify"
                value={
                  m.median_verification_hours === null ||
                  m.median_verification_hours === undefined ||
                  m.median_verification_hours === 0
                    ? "—"
                    : hours(m.median_verification_hours)
                }
                sub={
                  m.median_verification_hours === null ||
                  m.median_verification_hours === undefined
                    ? "Not enough verified rows to take a median"
                    : m.median_verification_hours === 0
                      ? "Computes to zero: the seeded rows carry the same timestamp for the report and the verification, so this is not a real measurement"
                      : "Report to a human confirming it"
                }
              />
              <Stat
                label="Solved"
                value={num(m.totals.solved)}
                sub="Deployed or impact verified"
                tone={m.totals.solved > 0 ? "teal" : undefined}
              />
            </div>

            {/* ---- manage problems & challenges (admin remove/delete) --- */}
            <Panel
              title="Manage Problems &amp; Challenges"
              lede="Statewide registry of all reported and active challenges. Administrators can inspect, track, or permanently delete problems."
              right={
                <span className="mono in-s px-3 py-1 text-[11px] font-semibold text-navy">
                  {num(filteredChallenges.length)} problems
                </span>
              }
            >
              {actionMsg && (
                <div className="in-s mb-4 flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-moderate">
                      <Icon name="check" size={15} />
                    </span>
                    <span className="text-[13px] font-medium text-ink">{actionMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionMsg(null)}
                    className="text-mute hover:text-ink"
                    aria-label="Dismiss message"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              )}

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
                  why={
                    searchQuery
                      ? `No problems match "${searchQuery}". Clear the search to see all challenges.`
                      : "No problems are currently filed in the system."
                  }
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {filteredChallenges.map((c) => {
                    const isDeleting = deletingId === c.id;
                    const isTarget = deleteTarget === c.id;

                    return (
                      <li
                        key={c.id}
                        className="up-s flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mono text-[11px] font-bold text-navy">{c.ref}</span>
                            <BandChip band={c.band ?? bandOf(c.priority)} />
                            <StatusChip status={c.status} />
                            <span className="in-s px-2 py-0.5 text-[10.5px] font-medium text-body">
                              {c.district}
                            </span>
                          </div>
                          <div className="mt-1.5 text-[14px] font-bold text-ink sm:text-[15px]">
                            {c.title}
                          </div>
                          <div className="mono mt-1 text-[11px] text-mute">
                            Priority {num(c.priority)}/100 · {num(c.report_count ?? 1)} reports merged
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <ButtonLink
                            href={`/challenge/${c.ref}`}
                            variant="secondary"
                            size="sm"
                            icon="eye"
                          >
                            Brief
                          </ButtonLink>
                          <ButtonLink
                            href={`/admin/challenges/${c.ref}`}
                            variant="secondary"
                            size="sm"
                            icon="file"
                          >
                            Audit
                          </ButtonLink>

                          {!isTarget ? (
                            <Button
                              variant="danger"
                              size="sm"
                              icon="trash"
                              onClick={() => setDeleteTarget(c.id)}
                            >
                              Delete
                            </Button>
                          ) : (
                            <div className="in-s flex items-center gap-1.5 rounded-xl p-1">
                              <span className="px-2 text-[11px] font-bold text-alert-ink">
                                Permanently delete?
                              </span>
                              <Button
                                variant="danger"
                                size="sm"
                                busy={isDeleting}
                                onClick={() => handleDeleteProblem(c.id, c.ref)}
                              >
                                Yes, delete
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isDeleting}
                                onClick={() => setDeleteTarget(null)}
                              >
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

            {/* ---- quiet projects -------------------------------------- */}
            <Panel
              title="Nobody has touched these"
              lede="Awarded work with no progress update. Silence is not read as success anywhere in this system."
            >
              {m.quiet_projects.length === 0 ? (
                <Empty
                  icon="check"
                  title="Every awarded project has been updated recently"
                  why="No project has gone quiet. This panel fills up when a college stops filing progress, which is the first sign a project is stalling."
                />
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {m.quiet_projects.map((q) => (
                    <li key={q.id}>
                      <Link
                        href={`/admin/challenges/${q.ref}`}
                        className="up-s up-hit flex items-center justify-between gap-3 p-4"
                      >
                        <div className="min-w-0">
                          <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                            {q.ref}
                          </div>
                          <div className="mt-1 truncate text-[13.5px] font-semibold text-ink">
                            {q.title}
                          </div>
                        </div>
                        <div className="flex flex-none items-center gap-2.5">
                          <Chip tone={q.days_since_update > 21 ? "alert" : "high"}>
                            {num(q.days_since_update)} days quiet
                          </Chip>
                          <span className="text-navy">
                            <Icon name="chevRight" size={15} />
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* ---- the funnel ---------------------------------------- */}
              <Panel
                title="Where everything is sitting"
                lede="The whole pipeline by status. A pile-up at one stage is the bottleneck."
              >
                <ul className="flex flex-col gap-3">
                  {statuses.map((s) => (
                    <li key={s.key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-semibold text-ink">
                          {STATUS_LABEL[s.key] ?? humanise(s.key)}
                        </span>
                        <span className="mono text-[12px] font-semibold text-navy">
                          {num(s.value)}
                        </span>
                      </div>
                      <Meter value={s.value} max={s.max} height={7} className="mt-1.5" />
                    </li>
                  ))}
                </ul>
              </Panel>

              {/* ---- funding ------------------------------------------- */}
              <Panel
                title="Funding"
                lede="Pledged is a promise; received is a fact. The gap between them is the number that matters."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="up-s p-4">
                    <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                      Money pledged
                    </div>
                    <div className="mono mt-1.5 text-[22px] font-semibold text-ink">
                      {money(m.funding.money_pledged)}
                    </div>
                  </div>
                  <div className="up-s p-4">
                    <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                      Money received
                    </div>
                    <div className="mono mt-1.5 text-[22px] font-semibold text-teal-ink">
                      {money(m.funding.money_received)}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
                      material lines received
                    </span>
                    <span className="mono text-[12px] font-semibold text-navy">
                      {num(m.funding.material_lines_received)} / {num(m.funding.material_lines)}
                    </span>
                  </div>
                  <Meter
                    value={m.funding.material_lines_received}
                    max={Math.max(m.funding.material_lines, 1)}
                    height={8}
                    className="mt-2"
                    colour="var(--color-teal)"
                  />
                </div>

                {m.funding.money_pledged === 0 && m.funding.material_lines > 0 && (
                  <p className="mt-4 text-[12.5px] leading-relaxed text-body">
                    Nothing has been pledged in cash yet — every contribution so far is material.
                    That is shown as it is rather than converted into a rupee figure nobody
                    committed to.
                  </p>
                )}
              </Panel>
            </div>

            {/* ---- competition --------------------------------------- */}
            <Panel
              title="The proposal competition"
              lede="Windows are opened by the first submission and closed by the clock, not by a person."
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="up-s p-4">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                    Open now
                  </div>
                  <div className="mono mt-1.5 text-[24px] font-semibold text-ink">
                    {num(m.competition.windows_open)}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-body">
                    Colleges can still submit
                  </p>
                </div>
                <div className="up-s p-4">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                    Awarded
                  </div>
                  <div className="mono mt-1.5 text-[24px] font-semibold text-teal-ink">
                    {num(m.competition.windows_awarded)}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-body">
                    Closed with a viable winner
                  </p>
                </div>
                <div className="up-s p-4">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                    Reopened
                  </div>
                  <div className="mono mt-1.5 text-[24px] font-semibold text-ink">
                    {num(m.competition.windows_reopened)}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-body">
                    Closed with nothing above the floor
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-body">
                A window that closes with no proposal at or above the viability floor reopens
                rather than awarding the least-bad document. A reopened window is a signal that the
                brief may be unbuildable as written, not that colleges are lazy.
              </p>
            </Panel>

            {/* ---- districts ---------------------------------------- */}
            <Panel
              title="By district"
              lede="Volume, not need. A district with more problems on the list may simply have more people reporting."
            >
              <div className="scroll-x">
                <div className="grid min-w-[560px] grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-3">
                  {districts.map(([name, count]) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="mono w-[52px] flex-none text-right text-[12px] font-semibold text-ink">
                        {num(count)}
                      </span>
                      <span className="flex-1">
                        <Meter
                          value={count}
                          max={districts[0]?.[1] ?? 1}
                          height={6}
                        />
                      </span>
                      <span className="w-[130px] flex-none truncate text-[12.5px] text-body">
                        {name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            {/* ---- what is not running ------------------------------ */}
            <Panel
              title="What this deployment can and cannot do"
              lede="Read live from the service. Missing capabilities are named, not hidden."
            >
              {health.loading && !health.settled ? (
                <SkeletonRows rows={2} height={64} />
              ) : health.error ? (
                <ErrorNote message={health.error} code={health.code} onRetry={health.reload} />
              ) : health.data ? (
                <>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Capability
                      on={health.data.database.connected}
                      label="Database"
                      detail={`${num(health.data.database.challenges)} challenges · ${num(health.data.database.regions)} regions`}
                    />
                    <Capability
                      on={health.data.ai.enabled}
                      label="Compiler and scoring"
                      detail={`${health.data.ai.provider} · ${health.data.ai.gemini_keys_count} keys · ${health.data.ai.model_cascade.length}-model cascade`}
                    />
                    <Capability
                      on={health.data.ai.speech_to_text}
                      label="Voice transcription"
                      detail={
                        health.data.ai.speech_to_text
                          ? "Whisper, with silence refused rather than invented"
                          : "No key: voice reports are refused, not guessed at"
                      }
                    />
                    <Capability
                      on={health.data.ai.remote_embeddings}
                      label="Semantic deduplication"
                      detail={
                        health.data.ai.remote_embeddings
                          ? "Embeddings from the model"
                          : "Falling back to lexical matching, so near-duplicates in different words may be missed"
                      }
                    />
                    <Capability
                      on={health.data.sms.inbound_secret_set}
                      label="SMS in"
                      detail={
                        health.data.sms.inbound_secret_set
                          ? "Gateway secret set"
                          : "No secret: inbound SMS is rejected"
                      }
                    />
                    <Capability
                      on={health.data.sms.outbound_gateway}
                      label="SMS out"
                      detail={
                        health.data.sms.outbound_gateway
                          ? `Sending from ${health.data.sms.number ?? "the configured number"}`
                          : "No gateway: nobody is notified by SMS yet"
                      }
                    />
                  </div>
                  <div className="mono mt-4 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-mute">
                    <span>health check {health.data.ms} ms</span>
                    {health.data.demo.role_switcher && (
                      <Tag>demo role switcher enabled</Tag>
                    )}
                  </div>
                </>
              ) : null}
            </Panel>

            {Object.keys(m.sla ?? {}).length === 0 && (
              <Card depth="in" className="p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-mute">
                    <Icon name="clock" size={17} />
                  </span>
                  <div>
                    <h3 className="text-[14.5px] font-bold text-navy-dark">
                      Stage timings are not summarised here
                    </h3>
                    <div className="mt-2">
                      <NotMeasured
                        what="SLA attainment"
                        why="this endpoint returns it empty; the full per-stage breakdown is on the SLA page, computed from the timing table directly"
                      />
                    </div>
                    <div className="mt-4">
                      <ButtonLink href="/admin/sla" variant="secondary" size="sm" icon="clock">
                        Open SLA &amp; timings
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </Main>
    </>
  );
}

function Capability({
  on,
  label,
  detail,
}: {
  on: boolean;
  label: string;
  detail: string;
}) {
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
