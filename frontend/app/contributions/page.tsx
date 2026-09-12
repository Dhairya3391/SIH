"use client";

import React from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat, Well } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { Chip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/useResource";
import { dateOnly, humanise, money, num, relative } from "@/lib/format";
import type { Contribution, FundedProject } from "@/types/database";

/**
 * What this organisation gave, and what became of it.
 *
 * Closed projects stay on this page deliberately. A company that funded
 * something is entitled to see how it finished, and a project leaving the
 * active list must not take its funders' record of it away — that record is
 * the only thing that makes the next pledge credible.
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
  cancelled: "alert",
};

function Contributions() {
  const { organisation } = useAuth();
  const res = useResource(() => apiClient.fetchMyContributions(), []);

  const contributions = res.data?.contributions ?? [];
  const projects = res.data?.projects ?? [];
  const totals = res.data?.totals ?? null;

  return (
    <>
      <PageHead
        eyebrow="Company / NGO"
        title="What you gave, and what it did"
        lede={
          organisation
            ? `Everything ${organisation.name} has pledged, the stage each contribution unblocked, and the last thing the college filed about it.`
            : "Everything this organisation has pledged, the stage each contribution unblocked, and the last thing the college filed about it."
        }
        right={
          <ButtonLink href="/needs" variant="primary" icon="box">
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
          <>
            <Empty
              icon="wallet"
              title="You have not pledged anything yet"
              why={
                organisation
                  ? "The needs board lists itemised lines from projects that a person verified and a college is building. You can take part of a line — most contributions here are partial."
                  : "This account is not linked to an organisation, so it has nothing to show. Pledges belong to an organisation, not to an individual."
              }
              action={
                <ButtonLink href="/needs" variant="primary" icon="box">
                  See what is needed
                </ButtonLink>
              }
            />
            <Panel
              title="Why this page exists"
              lede="Most CSR reporting ends at the transfer. This is the other half."
              depth="in"
            >
              <p className="text-[13px] leading-relaxed text-body">
                Once you pledge, this page keeps the line permanently: what you gave, when it was
                received, which execution stage it unblocked, and the photograph the college filed
                when that stage was done. It stays after the project closes, because a closed
                project is exactly when a funder most needs the record.
              </p>
            </Panel>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Contributions"
                value={num(totals?.lines ?? contributions.length)}
                sub={`Across ${num(projects.length)} project${projects.length === 1 ? "" : "s"}`}
              />
              <Stat
                label="Money pledged"
                value={money(totals?.money ?? 0)}
                sub="Cash lines only; material is counted separately"
              />
              <Stat
                label="Delivered and confirmed"
                value={num(totals?.delivered ?? 0)}
                sub="The college has signed for these"
                tone={(totals?.delivered ?? 0) > 0 ? "teal" : undefined}
              />
              <Stat
                label="Waiting on you"
                value={num(totals?.awaiting_dispatch ?? 0)}
                sub="Pledged but not dispatched"
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
                    {num(totals?.awaiting_dispatch ?? 0)} pledge
                    {(totals?.awaiting_dispatch ?? 0) === 1 ? "" : "s"} not dispatched yet.
                  </strong>{" "}
                  A pledged-but-unsent line blocks the execution stage that depends on it exactly
                  as an empty line does, so the college is waiting rather than working.
                </p>
              </Card>
            )}

            {projects.length > 0 && (
              <Panel
                title="The projects your material went into"
                lede="Progress is the college's own stage record, not a percentage we invented."
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  {projects.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              </Panel>
            )}

            <Panel
              title="Every contribution"
              lede="Newest first. Each one names the need it went against and the project behind it."
            >
              <div className="flex flex-col gap-3">
                {contributions.map((c) => (
                  <ContributionRow key={c.id} contribution={c} />
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
  const stale = (p.days_since_update ?? 0) > 21;
  return (
    <div className={`${p.closed ? "in" : "up-s"} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
            {p.ref} · {p.district ?? "—"}
          </div>
          <Link
            href={`/challenge/${p.ref}`}
            className="mt-1 block text-[14.5px] font-bold leading-snug text-navy-dark hover:text-navy"
          >
            {p.title}
          </Link>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <Chip tone={p.closed ? "teal" : "neutral"}>
            {p.closed ? "Closed" : humanise(p.status)}
          </Chip>
          <span className="mono text-[10px] text-mute">
            {num(p.my_contributions)} from you
          </span>
        </div>
      </div>

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
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] leading-relaxed text-body">
          No execution plan has been generated for this project yet, so there is no progress
          figure to show. Stages are created when a proposal window is awarded.
        </p>
      )}

      {p.latest_update ? (
        <Well small className="mt-3">
          <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
            last update {relative(p.latest_update.at)}
            {stale ? " · overdue" : ""}
          </div>
          {p.latest_update.note && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink">
              {p.latest_update.note}
            </p>
          )}
          {p.latest_update.photos && p.latest_update.photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.latest_update.photos.map((ph, i) => (
                <Tag key={i} icon={<Icon name="camera" size={11} />}>
                  photo {i + 1}
                </Tag>
              ))}
            </div>
          )}
        </Well>
      ) : (
        <p
          className={`mt-3 text-[12.5px] leading-relaxed ${stale ? "text-alert-ink" : "text-body"}`}
        >
          The college has filed no progress update on this project. Nothing is inferred from that
          silence here — it is shown as silence.
        </p>
      )}

      {p.my_money > 0 && (
        <div className="mono mt-3 text-[10px] uppercase tracking-[0.1em] text-mute">
          your money in this project: {money(p.my_money)}
        </div>
      )}
    </div>
  );
}

function ContributionRow({ contribution: c }: { contribution: Contribution }) {
  const tone = STATE_TONE[c.state] ?? "neutral";
  return (
    <div className="up-s p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.1em] text-mute">
            <span>{dateOnly(c.created_at)}</span>
            {c.challenge && (
              <>
                <span>·</span>
                <Link href={`/challenge/${c.challenge.ref}`} className="text-navy hover:underline">
                  {c.challenge.ref}
                </Link>
              </>
            )}
            <span>·</span>
            <span>{humanise(c.kind)}</span>
          </div>

          <div className="mt-1.5 text-[14.5px] font-bold text-navy-dark">
            {c.need
              ? `${num(c.qty)} ${c.need.unit} of ${c.need.item}`
              : `${num(c.qty)} ${humanise(c.kind)}`}
          </div>

          {c.challenge && (
            <div className="mt-1 text-[12.5px] leading-snug text-body">{c.challenge.title}</div>
          )}

          {c.note && (
            <Well small className="mt-2.5">
              <p className="text-[12.5px] leading-relaxed text-ink">{c.note}</p>
            </Well>
          )}

          {c.receipt_note && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-teal-ink">
              <span className="mono text-[9.5px] uppercase tracking-[0.1em]">college signed </span>
              {c.receipt_note}
            </p>
          )}
        </div>

        <div className="flex flex-none flex-col items-end gap-1.5">
          <Chip tone={tone}>{humanise(c.state)}</Chip>
          {c.awaiting && (
            <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-alert-ink">
              awaiting {c.awaiting}
            </span>
          )}
        </div>
      </div>

      {/* the delivery chain, only the steps that actually happened */}
      <div className="scroll-x mt-3.5">
        <ol className="flex min-w-[420px] gap-2">
          {[
            { label: "Pledged", at: c.created_at },
            { label: "Expected", at: c.expected_delivery_date },
            { label: "Dispatched", at: c.dispatched_at },
            { label: "Received", at: c.received_at },
          ].map((s) => (
            <li key={s.label} className={`flex-1 ${s.at ? "press" : "in-s"} p-2.5`}>
              <div
                className={`mono text-[9px] font-semibold uppercase tracking-[0.08em] ${
                  s.at ? "text-navy" : "text-mute"
                }`}
              >
                {s.label}
              </div>
              <div className={`mono mt-1 text-[10.5px] ${s.at ? "text-ink" : "text-mute"}`}>
                {s.at ? dateOnly(s.at) : "—"}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
