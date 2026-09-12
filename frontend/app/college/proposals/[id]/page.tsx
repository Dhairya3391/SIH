"use client";

import React from "react";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { BackLink, Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { AiNote, ErrorNote, Skeleton } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { RubricBreakdown, VIABILITY_FLOOR, WindowState } from "@/components/domain/Competition";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { countdown, dateTime, humanise, money, num } from "@/lib/format";

/**
 * The verdict on one proposal.
 *
 * Everything the reviewer wrote, not a grade. A college that scored 48 needs
 * to know which criterion cost it the points and why — otherwise the next
 * version is a guess. And the displacement notice is written out in full,
 * because being passed by a better proposal should read as information rather
 * than as a rejection letter.
 */
export default function ProposalVerdictPage() {
  return (
    <RouteGuard>
      <Verdict />
    </RouteGuard>
  );
}

function Verdict() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const res = useResource(() => apiClient.fetchMyProposals(), []);

  const p = res.data?.proposals.find((x) => x.id === id) ?? null;

  if (res.loading && !res.settled) {
    return (
      <>
        <BackLink href="/college/proposals" label="My proposals" />
        <Main className="pt-6">
          <Skeleton height={110} rounded={18} />
          <Skeleton height={420} rounded={18} />
        </Main>
      </>
    );
  }

  if (res.error) {
    return (
      <>
        <BackLink href="/college/proposals" label="My proposals" />
        <Main className="pt-6">
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        </Main>
      </>
    );
  }

  if (!p) {
    return (
      <>
        <BackLink href="/college/proposals" label="My proposals" />
        <Main className="pt-6">
          <ErrorNote
            message="No proposal of yours has that id. It may belong to a different college, or it may have been submitted from another account."
            code="not_found"
          />
        </Main>
      </>
    );
  }

  const notViable =
    p.ai_verdict === "not_viable" || (p.ai_score !== null && p.ai_score < VIABILITY_FLOOR);
  const displaced = p.is_leading === false && p.score_to_beat !== null;
  const cd = countdown(p.window?.closes_at ?? null);
  const windowOpen = p.window?.state === "open";

  return (
    <>
      <BackLink
        href="/college/proposals"
        label="My proposals"
        trail={p.challenge?.ref ?? p.id.slice(0, 8)}
      />

      <PageHead
        eyebrow={`${p.challenge?.ref ?? "proposal"} · version ${p.version} · ${humanise(p.state)}`}
        title={p.challenge?.title ?? "Proposal verdict"}
        lede={
          p.ai_score === null
            ? "This proposal has not been scored yet, so there is no verdict to read. The rubric it will be scored against is below."
            : notViable
              ? `Scored ${p.ai_score} out of 100, below the viability floor of ${VIABILITY_FLOOR}. That is a refusal, not a low ranking — the reasoning for every criterion is below so the next version can address it directly.`
              : `Scored ${p.ai_score} out of 100 across seven criteria. Every line the reviewer wrote is below.`
        }
        right={
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {p.is_leading === true && <Chip tone="teal">Leading this window</Chip>}
              {displaced && <Chip tone="high">Displaced</Chip>}
              {windowOpen && (
                <Chip tone={cd.urgent ? "alert" : "moderate"}>
                  <Icon name="clock" size={11} />
                  {cd.text}
                </Chip>
              )}
            </div>
            {p.challenge && (
              <ButtonLink
                href={`/college/problems/${p.challenge.ref}`}
                variant="secondary"
                size="sm"
                icon="upload"
              >
                Submit a new version
              </ButtonLink>
            )}
          </div>
        }
      />

      <Main>
        {/* ---- the displacement notice, spelled out ----------------------- */}
        {displaced && (
          <Card depth="in" className="p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-high-ink">
                <Icon name="trophy" size={18} />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-navy-dark">
                  Another proposal is ahead of yours
                </h2>
                <p className="mt-2 max-w-[72ch] text-[13.5px] leading-relaxed text-body">
                  Your submission scored{" "}
                  <strong className="mono text-ink">{p.ai_score}</strong> and the leading proposal
                  scored <strong className="mono text-ink">{p.score_to_beat}</strong> — a gap of{" "}
                  {num((p.score_to_beat ?? 0) - (p.ai_score ?? 0))} points. You are not told which
                  college submitted it or what it contains, deliberately: you compete against the
                  number, not against a document you could copy.
                  {windowOpen
                    ? " The window is still open, so a revised version can retake the lead."
                    : " The window has closed, so this one is final."}
                </p>
              </div>
            </div>
          </Card>
        )}

        {p.is_leading === true && windowOpen && (
          <Card depth="in" className="p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-teal-ink">
                <Icon name="trophy" size={18} />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-navy-dark">
                  Yours is currently the highest viable score
                </h2>
                <p className="mt-2 max-w-[72ch] text-[13.5px] leading-relaxed text-body">
                  Leading is not the same as winning. Another college can still submit before the
                  window closes {dateTime(p.window?.closes_at)}, and if they score higher you will
                  be told with both numbers.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Your score"
            value={p.ai_score === null ? "—" : `${p.ai_score}`}
            sub={p.ai_score === null ? "Not scored yet" : "Out of 100"}
            tone={notViable ? "alert" : undefined}
          />
          <Stat
            label="Score to beat"
            value={
              p.window?.leader_score !== null && p.window?.leader_score !== undefined
                ? `${p.window.leader_score}`
                : "none"
            }
            sub="The leading score in this window"
          />
          <Stat
            label="Funding asked for"
            value={money(p.funding_required)}
            sub="Read out of your document, not a form field"
          />
          <Stat
            label="Duration claimed"
            value={p.duration_days === null ? "—" : `${p.duration_days} d`}
            sub="Scored for credibility"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <Panel
            title="The rubric, line by line"
            lede="Seven criteria summing to 100, each with the reviewer's own reason and the pages it read."
          >
            <RubricBreakdown
              rubric={p.ai_rubric}
              score={p.ai_score}
              verdict={p.ai_verdict}
              funding={p.funding_required}
              currency={p.currency}
              durationDays={p.duration_days}
            />
            <div className="mt-5">
              <AiNote />
            </div>
          </Panel>

          <aside className="flex flex-col gap-5">
            <Panel title="The window">
              <WindowState competition={p.window ?? undefined} myScore={p.ai_score} />
            </Panel>

            <Panel title="This submission" depth="in">
              <dl className="flex flex-col">
                <Row label="Version" value={`v${p.version}`} />
                <Row label="State" value={humanise(p.state)} />
                <Row label="Document" value={p.document_name ?? "—"} />
                <Row label="Submitted" value={dateTime(p.submitted_at)} />
                <Row
                  label="Scored"
                  value={p.scored_at ? dateTime(p.scored_at) : "not yet"}
                />
                <Row label="Reference" value={p.id.slice(0, 8)} />
              </dl>
            </Panel>

            {p.ai_error && (
              <Panel title="Scoring failed" depth="in">
                <p className="text-[13px] leading-relaxed text-body">{p.ai_error}</p>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-mute">
                  A failed score is never recorded as a low score. The job retries, and your
                  proposal keeps its place in the window meanwhile.
                </p>
              </Panel>
            )}

            <Panel title="If you resubmit" depth="in">
              <ul className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-body">
                <li>
                  A new version is scored fresh against the same rubric. The earlier version stays
                  on the record — the history of what a college tried is part of the record.
                </li>
                <li>
                  Only your latest scored version competes, so an improved document replaces the
                  weaker one rather than competing against it.
                </li>
                <li>
                  Address the criteria that lost points, not the total. The total is a consequence.
                </li>
              </ul>
            </Panel>
          </aside>
        </div>
      </Main>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="hairline flex items-baseline justify-between gap-3 py-2.5 first:border-t-0">
      <dt className="mono text-[10px] uppercase tracking-[0.1em] text-mute">{label}</dt>
      <dd className="mono truncate text-right text-[11.5px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
