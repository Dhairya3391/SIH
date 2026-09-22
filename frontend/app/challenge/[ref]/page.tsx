"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { BackLink, Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BandChip, Chip, ConfidenceChip, StatusChip, Tag } from "@/components/ui/Chip";
import { AiNote, Empty, ErrorNote, Skeleton } from "@/components/ui/States";
import { Icon, CATEGORY_ICON } from "@/components/ui/Icon";
import { ScoreFactors } from "@/components/domain/ScoreFactors";
import { ConfidenceLadder, Corroboration } from "@/components/domain/Corroboration";
import { NeedLineRow } from "@/components/domain/NeedCard";
import { StageTracker, TimelineList } from "@/components/domain/Timeline";
import { ListenButton } from "@/components/domain/AudioPlayer";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useAuth } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/nav";
import {
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  CONFIDENCE_RUNGS,
  bandOf,
  dateOnly,
  dateTime,
  humanise,
  money,
  num,
  relative,
} from "@/lib/format";

/**
 * The brief. One problem, everything known about it.
 *
 * This is the page a coordinator prints and takes to a block meeting, so it is
 * laid out to read top to bottom on paper as well as on screen, and the print
 * stylesheet strips the soft shadows to thin borders rather than wasting toner
 * on grey.
 */
export default function ChallengePage() {
  // Public: a citizen follows their report by its reference, with or without an account.
  return (
    <RouteGuard allowAnonymous>
      <Brief />
    </RouteGuard>
  );
}

function Brief() {
  const params = useParams<{ ref: string }>();
  const reference = params?.ref ?? "";
  const { role } = useAuth();

  const res = useResource(() => apiClient.fetchChallenge(reference), [reference], {
    enabled: Boolean(reference),
  });

  const detail = res.data;
  const c = detail?.challenge;
  const brief = c?.brief;

  const back = role ? ROLE_HOME[role] : "/";
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  async function handleDelete() {
    if (!c) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.deleteChallenge(c.id);
      router.push("/admin");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete problem.");
      setDeleting(false);
    }
  }

  if (res.loading && !res.settled) {
    return (
      <>
        <BackLink href={back} label="Back" />
        <Main className="pt-6">
          <Skeleton height={120} rounded={18} />
          <Skeleton height={320} rounded={18} />
          <Skeleton height={260} rounded={18} />
        </Main>
      </>
    );
  }

  if (res.error || !c) {
    return (
      <>
        <BackLink href={back} label="Back" />
        <Main className="pt-6">
          <ErrorNote
            message={res.error ?? `No problem is filed under ${reference}.`}
            code={res.code}
            onRetry={res.reload}
          />
        </Main>
      </>
    );
  }

  const stages: { key: string; label: string; at: string | null | undefined }[] = [
    { key: "reported", label: "Reported", at: c.created_at },
    { key: "refined", label: "Compiled", at: c.refined_at },
    { key: "verified", label: "Verified", at: c.verified_at },
    { key: "team", label: "Team formed", at: c.team_formed_at },
    { key: "deployed", label: "Deployed", at: c.deployed_at },
    { key: "closed", label: "Closed", at: c.closed_at },
  ];

  return (
    <>
      <BackLink href={back} label="Back" trail={c.ref} />

      <PageHead
        eyebrow={`${c.ref} · ${
          [c.block, c.district].filter(Boolean).join(", ") || "district unknown"
        }`}
        title={c.title}
        lede={brief?.problem ?? c.why_critical}
        right={
          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <BandChip band={c.band ?? bandOf(c.priority)} />
              <ConfidenceChip confidence={c.confidence} />
              <StatusChip status={c.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              {["REPORTED", "REFINED"].includes(c.status) &&
                (role === "verifier" || role === "volunteer" || role === "coordinator" || role === "admin") && (
                  <ButtonLink href={`/verify/${c.id}`} variant="secondary" size="sm" icon="shield">
                    Verify
                  </ButtonLink>
                )}
              {detail?.project && role && ["industry", "ngo", "coordinator", "admin", "university"].includes(role) && (
                <ButtonLink
                  href={role === "university" ? `/college/projects/${c.ref}` : `/projects/${c.ref}`}
                  variant="secondary"
                  size="sm"
                  icon="box"
                >
                  Project
                </ButtonLink>
              )}
              <a
                href={apiClient.getCertificateUrl(c.ref || c.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-2 btn-sm inline-flex items-center gap-1.5 text-navy font-semibold"
                title="Official Government & CSR Impact Closure Certificate"
              >
                <Icon name="file" size={13} />
                Impact Certificate
              </a>
              {/* The delete endpoint allows admin and coordinator; the history
                  page stays admin-only (its endpoint is requireRole("admin")),
                  so only the record link is gated below. */}
              {(role === "admin" || role === "coordinator") && (
                <>
                  {role === "admin" && (
                    <ButtonLink
                      href={`/admin/challenges/${c.ref}`}
                      variant="secondary"
                      size="sm"
                      icon="clock"
                    >
                      Full record
                    </ButtonLink>
                  )}
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
                      <span className="px-2 text-[11px] font-bold text-alert-ink">
                        Permanently delete?
                      </span>
                      <Button
                        variant="danger"
                        size="sm"
                        busy={deleting}
                        onClick={handleDelete}
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
                </>
              )}
            </div>
          </div>
        }
      />

      {deleteError && (
        <div className="shell mt-4">
          <ErrorNote message={deleteError} />
        </div>
      )}

      <Main>
        {/* ---- the numbers ------------------------------------------------- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Priority" value={`${c.priority}`} sub="Out of 100, opened below" />
          <Stat
            label="People affected"
            value={num(c.people_est)}
            sub={brief?.vulnerable?.length ? brief.vulnerable.join(", ") : "No group named"}
          />
          <Stat
            label="Reports"
            value={num(c.report_count)}
            sub={`${num(c.reporter_count)} separate reporters${
              detail?.cluster ? ` · ${num(detail.cluster.villages)} villages` : ""
            }`}
          />
          <Stat
            label="Severity"
            value={`${c.severity}/5`}
            sub={c.severity_source ? `Set by ${humanise(c.severity_source)}` : "From the reports"}
          />
        </div>

        {/* ---- lifecycle strip -------------------------------------------- */}
        <Card className="p-5">
          <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
            Where it has got to
          </div>
          <div className="scroll-x mt-3.5">
            <ol className="flex min-w-[560px] items-stretch gap-2">
              {stages.map((s) => {
                const reached = Boolean(s.at);
                return (
                  <li key={s.key} className={`flex-1 ${reached ? "press" : "in-s"} p-3`}>
                    <div
                      className={`mono text-[9.5px] font-semibold uppercase tracking-[0.08em] ${
                        reached ? "text-navy" : "text-mute"
                      }`}
                    >
                      {s.label}
                    </div>
                    <div
                      className={`mono mt-1.5 text-[11px] ${reached ? "text-ink" : "text-mute"}`}
                    >
                      {reached ? dateOnly(s.at) : "—"}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          {detail?.next_actions && detail.next_actions.length > 0 && (
            <div className="hairline mt-4 pt-4">
              <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                What can happen next
              </div>
              <ul className="mt-2.5 flex flex-col gap-2">
                {detail.next_actions.map((a) => (
                  <li key={a.action} className="flex flex-wrap items-center gap-2.5">
                    <Chip tone={a.ready ? "teal" : "neutral"}>
                      {a.ready ? "Ready" : "Blocked"}
                    </Chip>
                    <span className="text-[13px] font-semibold text-ink">
                      {humanise(a.action)} → {humanise(a.to)}
                    </span>
                    {a.problems.length > 0 && (
                      <span className="text-[12.5px] text-body">{a.problems.join("; ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          {/* ---- left column --------------------------------------------- */}
          <div className="flex flex-col gap-5">
            <Panel
              title="The problem"
              lede={
                brief?.source
                  ? brief.source === "ai"
                    ? "Compiled from the reports by the model."
                    : "Written by the rule-based compiler, with no model available."
                  : undefined
              }
              right={
                <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                  {brief?.detected_language
                    ? `reported in ${brief.detected_language}`
                    : ""}
                </span>
              }
            >
              <p className="text-[15px] leading-relaxed text-ink">
                {brief?.problem ?? c.why_critical}
              </p>

              {brief?.outcome && (
                <div className="in mt-4 p-4">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                    What success looks like
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{brief.outcome}</p>
                  {brief.success_metric && (
                    <p className="mt-2.5 text-[12.5px] leading-relaxed text-body">
                      <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-mute">
                        measured by{" "}
                      </span>
                      {brief.success_metric}
                    </p>
                  )}
                </div>
              )}

              {brief?.needs && brief.needs.length > 0 && (
                <div className="mt-4">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                    What it needs
                  </div>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {brief.needs.map((n, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex-none text-navy">
                          <Icon name="check" size={13} />
                        </span>
                        <span className="text-[13.5px] leading-relaxed text-body">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5">
                <Tag icon={<Icon name={CATEGORY_ICON[c.category] ?? "info"} size={11} />}>
                  {CATEGORY_LABEL[c.category] ?? humanise(c.category)}
                </Tag>
                <Tag>{humanise(c.dm_phase)}</Tag>
                {c.hazard_tags?.map((h) => (
                  <Tag key={h}>{humanise(h)}</Tag>
                ))}
                {c.sdg_tags?.map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
                {c.sendai_tags?.map((s) => (
                  <Tag key={s}>{humanise(s)}</Tag>
                ))}
              </div>

              {c.ai_uncertainties?.length > 0 && (
                <div className="in-s mt-4 p-4">
                  <div className="mono flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-high-ink">
                    <Icon name="alert" size={12} />
                    What the compiler was unsure about
                  </div>
                  <ul className="mt-2.5 flex flex-col gap-1.5">
                    {c.ai_uncertainties.map((u, i) => (
                      <li key={i} className="text-[12.5px] leading-relaxed text-body">
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4">
                <AiNote />
              </div>
            </Panel>

            {detail?.project && (
              <Panel
                title="The work"
                lede={`Awarded to ${detail.project.college?.name ?? "a college"}${detail.project.awarded_at ? ` on ${dateOnly(detail.project.awarded_at)}` : ""}. The delivery plan and the college's latest progress.`}
                right={
                  <span className="mono text-[11px] font-semibold text-navy">
                    {detail.project.stages_done}/{detail.project.stages.length} stages
                  </span>
                }
              >
                {detail.project.stages.length > 0 ? (
                  <StageTracker stages={detail.project.stages} />
                ) : (
                  <p className="text-[13px] leading-relaxed text-body">No delivery plan is on record yet.</p>
                )}
                {detail.project.updates.length > 0 && (
                  <div className="hairline mt-4 pt-4">
                    <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                      Latest progress
                    </div>
                    <ul className="mt-2.5 flex flex-col gap-2.5">
                      {detail.project.updates.slice(0, 5).map((u) => (
                        <li key={u.id} className="in-s p-3">
                          <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                            {dateTime(u.created_at)}
                          </div>
                          <p className="mt-1 text-[13px] leading-relaxed text-ink">{u.note}</p>
                          {u.photos.length > 0 && role && role !== "citizen" && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {u.photos.map((ph) => (
                                <a key={ph} href={ph} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={ph} alt="Progress" className="h-[56px] w-[80px] rounded-md object-cover" />
                                </a>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            )}

            <Panel
              title="Why it is ranked here"
              lede="Every factor, with its cap and the sentence behind it."
            >
              <ScoreFactors breakdown={c.score_breakdown} whyCritical={c.why_critical} />
            </Panel>

            {detail?.solutions && detail.solutions.length > 0 && (
              <Panel
                title="Proposed solutions"
                lede="What a college or partner said they would build, and how ready the reviewer judged it."
              >
                <ul className="flex flex-col gap-3">
                  {detail.solutions.map((s) => (
                    <li key={s.id} className="up-s p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-[15px] font-bold leading-snug text-navy-dark">
                            {s.title}
                          </h4>
                          <div className="mono mt-1 text-[10px] uppercase tracking-[0.08em] text-mute">
                            {s.organizations?.name ?? "unattributed"}
                            {s.organizations?.type ? ` · ${humanise(s.organizations.type)}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-none flex-col items-end gap-1.5">
                          {s.readiness !== null && (
                            <span className="mono text-[20px] font-semibold leading-none text-ink">
                              {s.readiness}
                              <span className="text-[11px] text-mute">/100</span>
                            </span>
                          )}
                          <Chip
                            tone={s.status === "approved_for_pilot" ? "teal" : "neutral"}
                          >
                            {humanise(s.status)}
                          </Chip>
                        </div>
                      </div>

                      {s.readiness !== null && <Meter value={s.readiness} className="mt-3" height={7} />}

                      <p className="mt-3 text-[13px] leading-relaxed text-body">{s.approach}</p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {s.cost_estimate !== null && <Tag>{money(s.cost_estimate)}</Tag>}
                        {s.deploy_days !== null && <Tag>{s.deploy_days} days to deploy</Tag>}
                      </div>

                      {s.risks && (
                        <Well small className="mt-3">
                          <p className="text-[12.5px] leading-relaxed text-body">
                            <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-mute">
                              risks{" "}
                            </span>
                            {s.risks}
                          </p>
                        </Well>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel
              title="What the people there said"
              lede={
                detail?.cluster
                  ? `${num(detail.cluster.report_count)} reports from ${num(detail.cluster.reporter_count)} reporters across ${num(detail.cluster.villages)} villages · ${num(detail.cluster.via_sms)} by SMS`
                  : undefined
              }
            >
              {!detail?.cluster || detail.cluster.reports.length === 0 ? (
                <Empty
                  icon="mic"
                  title="No individual reports are readable here"
                  why="The reports behind this problem are not exposed to your role on this endpoint. The counts on the challenge record are still shown above."
                />
              ) : (
                <ul className="flex max-h-[440px] flex-col gap-2.5 overflow-y-auto pr-1">
                  {detail.cluster.reports.slice(0, 12).map((r) => (
                    <li key={r.id} className="in-s p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="mono flex flex-wrap items-center gap-x-2 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                          <span>{dateTime(r.created_at)}</span>
                          <span>·</span>
                          <span>{CHANNEL_LABEL[r.channel] ?? r.channel}</span>
                          {r.village && (
                            <>
                              <span>·</span>
                              <span>{r.village}</span>
                            </>
                          )}
                        </div>
                        <ListenButton text={r.original_text} lang={r.lang ?? "hi-IN"} />
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink">
                        {r.original_text}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="The record"
              lede="Every entry in order, with the time between each one."
            >
              <TimelineList events={detail?.timeline ?? []} />
            </Panel>
          </div>

          {/* ---- right column -------------------------------------------- */}
          <aside className="flex flex-col gap-5">
            <Panel title="Evidence" lede="Where this sits, and what put it there.">
              <ConfidenceLadder current={c.confidence} rungs={CONFIDENCE_RUNGS} />

              {detail?.verifications && detail.verifications.length > 0 && (
                <div className="hairline mt-4 pt-4">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Verifications on file
                  </div>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {detail.verifications.map((v) => (
                      <li key={v.id} className="up-s p-3">
                        <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                          {v.kind === "inaccurate"
                            ? "rejected / flagged"
                            : v.method === "ai_external"
                              ? "verified by AI from sources"
                              : v.method === "coordinator"
                                ? "coordinator"
                                : v.kind === "field"
                                  ? "verifier"
                                  : v.kind}{" "}
                          · {dateOnly(v.created_at)}
                        </div>
                        {(v.rejected_reason || v.note) && (
                          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink">{v.rejected_reason ?? v.note}</p>
                        )}
                        {(v.source_urls?.length ?? 0) > 0 && (
                          <ul className="mt-1.5 flex flex-col gap-0.5">
                            {v.source_urls!.slice(0, 6).map((s, i) =>
                              /^https?:\/\//i.test(s) ? (
                                <li key={i}>
                                  <a href={s} target="_blank" rel="noopener noreferrer nofollow" className="mono break-all text-[10.5px] text-navy hover:underline">
                                    {s}
                                  </a>
                                </li>
                              ) : (
                                <li key={i} className="mono text-[10.5px] text-body">
                                  {s}
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                        {(v.photo_count ?? 0) > 0 && (
                          <p className="mono mt-1 text-[10px] text-mute">{v.photo_count} field photo(s) on file</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>

            {detail?.external?.checked && (
              <Panel title="What outside records say" lede="The AI's latest weather, news and web check.">
                <Corroboration external={detail.external} />
              </Panel>
            )}

            {detail?.gap && detail.gap.needs.length > 0 && (
              <Panel
                title="What is still needed"
                lede="Itemised, so a company with a small budget can close one line."
                right={
                  <span className="mono text-[11px] font-semibold text-navy">
                    {detail.gap.pctClosed}%
                  </span>
                }
              >
                <Meter
                  value={detail.gap.pctClosed}
                  colour={
                    detail.gap.fullyPledged ? "var(--color-teal)" : "var(--color-navy)"
                  }
                  height={10}
                />
                <div className="mt-2">
                  {detail.gap.needs.map((n) => (
                    <NeedLineRow key={n.need_id} need={n} />
                  ))}
                </div>
                <div className="mt-3">
                  <ButtonLink href="/needs" variant="secondary" size="sm" icon="box">
                    See the needs board
                  </ButtonLink>
                </div>
              </Panel>
            )}

            {detail?.assignments && detail.assignments.length > 0 && (
              <Panel title="Who is on it">
                <ul className="flex flex-col gap-2.5">
                  {detail.assignments.map((a) => (
                    <li key={`${a.org_id}-${a.role}`} className="up-s p-3.5">
                      <div className="text-[13.5px] font-bold text-ink">
                        {a.organizations?.name ?? a.org_id}
                      </div>
                      <div className="mono mt-1 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                        {humanise(a.role)}
                        {a.organizations?.type ? ` · ${humanise(a.organizations.type)}` : ""}
                        {a.organizations?.district ? ` · ${a.organizations.district}` : ""}
                        {a.accepted_at ? ` · accepted ${dateOnly(a.accepted_at)}` : " · not accepted yet"}
                      </div>
                    </li>
                  ))}
                </ul>

                {detail.team.length > 0 && (
                  <div className="hairline mt-4 pt-4">
                    <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                      Seats
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {detail.team.map((t, i) => (
                        <span
                          key={`${t.seat}-${i}`}
                          className={`chip ${t.filled ? "" : "opacity-70"}`}
                          style={{
                            color: t.filled ? "var(--color-teal-ink)" : "var(--color-mute)",
                          }}
                        >
                          <span
                            className="dot"
                            style={{
                              background: t.filled ? "var(--color-teal)" : "#8DA0B5",
                            }}
                          />
                          {t.seat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            )}

            <Panel title="Record" depth="in">
              <dl className="flex flex-col">
                <MetaRow label="Reference" value={c.ref} />
                <MetaRow label="Opened" value={dateTime(c.created_at)} />
                <MetaRow label="Last moved" value={relative(c.updated_at)} />
                <MetaRow label="Mode" value={humanise(c.mode ?? "peace")} />
                {c.is_simulated && <MetaRow label="Source" value="Seeded demonstration row" />}
              </dl>
              {c.ai_disclaimer && (
                <p className="mt-3 text-[11.5px] leading-relaxed text-mute">{c.ai_disclaimer}</p>
              )}
              {detail?.redacted && (
                <p className="mt-3 text-[11.5px] leading-relaxed text-mute">
                  Some fields are hidden from your role. What you can see is complete for what it
                  shows.
                </p>
              )}
              <div className="mt-4">
                <Link
                  href="/challenges"
                  className="mono text-[10.5px] uppercase tracking-[0.1em] text-navy hover:underline"
                >
                  All challenges →
                </Link>
              </div>
            </Panel>
          </aside>
        </div>
      </Main>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="hairline flex items-baseline justify-between gap-3 py-2 first:border-t-0">
      <dt className="mono text-[10px] uppercase tracking-[0.1em] text-mute">{label}</dt>
      <dd className="mono text-right text-[11.5px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
