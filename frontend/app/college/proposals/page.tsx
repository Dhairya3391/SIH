"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { Chip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { VIABILITY_FLOOR } from "@/components/domain/Competition";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { countdown, dateTime, humanise, money, num, relative } from "@/lib/format";
import type { Proposal } from "@/types/database";

/**
 * Everything this college has submitted, and where each one stands.
 *
 * A displaced proposal is not hidden. It keeps its score and shows the score
 * that passed it, because "you were beaten by 84" is actionable and "you lost"
 * is not.
 */
export default function MyProposalsPage() {
  return (
    <RouteGuard>
      <MyProposals />
    </RouteGuard>
  );
}

function MyProposals() {
  const res = useResource(() => apiClient.fetchMyProposals(), []);
  // Memoised so an unresolved fetch does not hand every useMemo below a
  // brand-new empty array on each render.
  const proposals = useMemo(() => res.data?.proposals ?? [], [res.data]);

  const counts = useMemo(() => {
    const scored = proposals.filter((p) => p.ai_score !== null);
    const leading = proposals.filter((p) => p.is_leading === true).length;
    const awaiting = proposals.filter((p) => p.ai_score === null && !p.ai_error).length;
    const refused = proposals.filter(
      (p) => p.ai_verdict === "not_viable" || (p.ai_score !== null && p.ai_score < VIABILITY_FLOOR),
    ).length;
    const best = scored.reduce<number | null>(
      (m, p) => (m === null || (p.ai_score ?? 0) > m ? (p.ai_score ?? 0) : m),
      null,
    );
    return { leading, awaiting, refused, best, scored: scored.length };
  }, [proposals]);

  return (
    <>
      <PageHead
        eyebrow="College"
        title="My proposals"
        lede="Each submission with its full rubric, and where it stands in its window. Scores are yours to read in detail — the number on its own would tell you nothing about what to fix."
        right={
          <ButtonLink href="/college/problems" variant="primary" icon="list">
            Find a problem
          </ButtonLink>
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={3} height={180} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : proposals.length === 0 ? (
          <Empty
            icon="file"
            title="You have not submitted anything yet"
            why="Pick a verified problem, read its brief, and submit a document against it. The rubric is published in advance, so you know exactly what will be judged before you write a word."
            action={
              <ButtonLink href="/college/problems" variant="primary" icon="list">
                See open problems
              </ButtonLink>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Submitted"
                value={num(proposals.length)}
                sub={`${num(counts.scored)} scored`}
              />
              <Stat
                label="Leading a window"
                value={num(counts.leading)}
                sub={counts.leading === 0 ? "Nothing in the lead right now" : "Highest viable score"}
                tone={counts.leading > 0 ? "teal" : undefined}
              />
              <Stat
                label="Best score"
                value={counts.best === null ? "—" : `${counts.best}`}
                sub={
                  counts.best === null
                    ? "Nothing scored yet"
                    : "Out of 100 across the seven criteria"
                }
              />
              <Stat
                label="Refused as not viable"
                value={num(counts.refused)}
                sub={`Below the floor of ${VIABILITY_FLOOR}`}
                tone={counts.refused > 0 ? "alert" : undefined}
              />
            </div>

            {counts.awaiting > 0 && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-mute">
                  <Icon name="clock" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  <strong className="text-ink">
                    {counts.awaiting} waiting to be scored.
                  </strong>{" "}
                  Scoring runs as a job rather than in the request, so a twenty-page document does
                  not hold your browser open — and a crash mid-score is recoverable because the job
                  is idempotent. Reloading this page nudges the queue.
                </p>
              </Card>
            )}

            <div className="flex flex-col gap-3">
              {proposals.map((p) => (
                <ProposalRow key={p.id} proposal={p} />
              ))}
            </div>

            <Panel
              title="How the lead is decided"
              lede="Deterministic on purpose, so the same set of proposals always produces the same winner."
              depth="in"
            >
              <ol className="flex flex-col gap-2 text-[13px] leading-relaxed text-body">
                <li>
                  <strong className="text-ink">1.</strong> Highest score, counting only proposals
                  at or above the viability floor of {VIABILITY_FLOOR}.
                </li>
                <li>
                  <strong className="text-ink">2.</strong> If two are tied, whichever was
                  submitted first.
                </li>
                <li>
                  <strong className="text-ink">3.</strong> If they arrived in the same instant,
                  the lower row id. There is no random tiebreak anywhere.
                </li>
              </ol>
            </Panel>
          </>
        )}
      </Main>
    </>
  );
}

function ProposalRow({ proposal: p }: { proposal: Proposal }) {
  const notViable =
    p.ai_verdict === "not_viable" || (p.ai_score !== null && p.ai_score < VIABILITY_FLOOR);
  const cd = countdown(p.window?.closes_at ?? null);
  const windowOpen = p.window?.state === "open";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mono flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.1em] text-mute">
            {p.challenge && <span className="text-navy">{p.challenge.ref}</span>}
            <span>·</span>
            <span>v{p.version}</span>
            <span>·</span>
            <span>submitted {relative(p.submitted_at)}</span>
            {p.document_name && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="file" size={11} />
                  {p.document_name}
                </span>
              </>
            )}
          </div>

          <h3 className="mt-2 text-[16px] font-bold leading-snug text-navy-dark">
            {p.challenge?.title ?? "Challenge not resolved"}
          </h3>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Chip tone={p.state === "awarded" ? "teal" : notViable ? "alert" : "neutral"}>
              {humanise(p.state)}
            </Chip>
            {p.is_leading === true && <Chip tone="teal">Leading</Chip>}
            {p.is_leading === false && p.score_to_beat !== null && (
              <Chip tone="high">Behind by {p.score_to_beat - (p.ai_score ?? 0)}</Chip>
            )}
            {windowOpen && (
              <Chip tone={cd.urgent ? "alert" : "moderate"}>
                <Icon name="clock" size={11} />
                {cd.text}
              </Chip>
            )}
            {p.funding_required !== null && <Tag>{money(p.funding_required)}</Tag>}
            {p.duration_days !== null && <Tag>{p.duration_days} days</Tag>}
          </div>
        </div>

        <div className="flex flex-none flex-col items-end gap-1.5">
          {p.ai_score === null ? (
            <>
              <span className="mono text-[18px] font-semibold text-mute">—</span>
              <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                {p.ai_error ? "scoring failed" : "not scored yet"}
              </span>
            </>
          ) : (
            <>
              <span
                className={`mono text-[32px] font-semibold leading-none ${
                  notViable ? "text-alert-ink" : "text-ink"
                }`}
              >
                {p.ai_score}
              </span>
              <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                of 100 · scored {p.scored_at ? relative(p.scored_at) : "—"}
              </span>
            </>
          )}
        </div>
      </div>

      {p.ai_score !== null && (
        <Meter
          value={p.ai_score}
          colour={notViable ? "var(--color-alert)" : "var(--color-navy)"}
          className="mt-4"
          height={8}
        />
      )}

      {p.ai_error && (
        <div className="in-s mt-3 flex items-start gap-2.5 p-3.5">
          <span className="mt-px text-alert-ink">
            <Icon name="alert" size={14} />
          </span>
          <p className="text-[12.5px] leading-relaxed text-body">
            Scoring failed on this document: {p.ai_error}. It stays in the window and will be
            retried; a failed score is never treated as a low score.
          </p>
        </div>
      )}

      {p.ai_rubric?.summary && (
        <p className="mt-3 text-[13px] leading-relaxed text-body">
          {p.ai_rubric.summary.length > 260
            ? `${p.ai_rubric.summary.slice(0, 259).trimEnd()}…`
            : p.ai_rubric.summary}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <ButtonLink
          href={`/college/proposals/${p.id}`}
          variant="primary"
          size="sm"
          iconAfter="arrow"
        >
          Read the full verdict
        </ButtonLink>
        {p.challenge && (
          <>
            <Link
              href={`/college/problems/${p.challenge.ref}`}
              className="btn-2 btn-sm"
            >
              <Icon name="upload" size={13} />
              Submit a new version
            </Link>
            <Link href={`/challenge/${p.challenge.ref}`} className="btn-2 btn-sm">
              <Icon name="eye" size={13} />
              The brief
            </Link>
          </>
        )}
        <span className="mono ml-auto text-[9.5px] uppercase tracking-[0.08em] text-mute">
          {dateTime(p.submitted_at)}
        </span>
      </div>
    </Card>
  );
}
