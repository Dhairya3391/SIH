"use client";

import React, { useMemo, useState } from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat } from "@/components/ui/Surface";
import { ButtonLink, Toggle } from "@/components/ui/Button";
import { BandChip, Chip, ConfidenceChip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon, CATEGORY_ICON } from "@/components/ui/Icon";
import { WindowState } from "@/components/domain/Competition";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { CATEGORY_LABEL, bandOf, humanise, num, relative } from "@/lib/format";
import type { CollegeProblem } from "@/types/database";

/**
 * The problems a college can take on.
 *
 * Only verified problems appear: a college should never spend a semester
 * building against something nobody confirmed exists. Each row carries the
 * competition state — whether a window is open, how long is left, and the
 * score to beat.
 */
export default function CollegeProblemsPage() {
  return (
    <RouteGuard>
      <CollegeProblems />
    </RouteGuard>
  );
}

type Lens = "all" | "open" | "unopened" | "mine";

function CollegeProblems() {
  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState("");
  const [lens, setLens] = useState<Lens>("all");

  const res = useResource(
    () =>
      apiClient.fetchCollegeProblems({
        district: district || undefined,
        category: category || undefined,
      }),
    [district, category],
  );

  // Memoised so an unresolved fetch does not hand every useMemo below a
  // brand-new empty array on each render.
  const problems = useMemo(() => res.data?.problems ?? [], [res.data]);

  const districts = useMemo(
    () => [...new Set(problems.map((p) => p.district).filter(Boolean) as string[])].sort(),
    [problems],
  );
  const categories = useMemo(
    () => [...new Set(problems.map((p) => p.category).filter(Boolean))].sort(),
    [problems],
  );

  const counts = useMemo(() => {
    const open = problems.filter((p) => p.competition?.state === "open").length;
    const unopened = problems.filter(
      (p) => !p.competition || p.competition.state === "not_opened",
    ).length;
    const mine = problems.filter((p) => p.my_proposal).length;
    const leading = problems.filter((p) => p.my_proposal?.is_leading).length;
    return { open, unopened, mine, leading };
  }, [problems]);

  const rows = useMemo(() => {
    const filtered =
      lens === "open"
        ? problems.filter((p) => p.competition?.state === "open")
        : lens === "unopened"
          ? problems.filter((p) => !p.competition || p.competition.state === "not_opened")
          : lens === "mine"
            ? problems.filter((p) => p.my_proposal)
            : problems;
    // Open windows first (there is a clock), then by score.
    return filtered.slice().sort((a, b) => {
      const aOpen = a.competition?.state === "open" ? 1 : 0;
      const bOpen = b.competition?.state === "open" ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return b.priority - a.priority;
    });
  }, [problems, lens]);

  return (
    <>
      <PageHead
        eyebrow="College"
        title="Problems open to proposals"
        lede="Verified — by the AI from independent sources, or by a person — ranked by severity, and waiting for someone to solve them. You compete on the quality of the proposal, not on who submits first."
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
            <select
              className="field max-w-[210px]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c] ?? humanise(c)}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={4} height={190} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Open to you"
                value={num(problems.length)}
                sub="Verified and unclaimed"
              />
              <Stat
                label="Windows running"
                value={num(counts.open)}
                sub="Someone has already submitted"
                tone={counts.open > 0 ? "navy" : undefined}
              />
              <Stat
                label="No window yet"
                value={num(counts.unopened)}
                sub="Your submission would start the clock"
              />
              <Stat
                label="You are leading"
                value={`${num(counts.leading)} of ${num(counts.mine)}`}
                sub={counts.mine === 0 ? "You have not submitted yet" : "Of your submissions"}
                tone={counts.leading > 0 ? "teal" : undefined}
              />
            </div>

            <Card depth="in" className="flex items-start gap-3 p-4">
              <span className="mt-px text-mute">
                <Icon name="info" size={16} />
              </span>
              <p className="text-[13px] leading-relaxed text-body">
                <strong className="text-ink">How the window works.</strong> The first proposal
                opens it, and its length comes from the severity band — critical 2 days, high 5,
                moderate 10, long term 14. While it is open the leading <em>score</em> is public
                but the leading document and the college behind it are not. When it closes the
                highest score is awarded the work; if you are displaced you are told, with your
                own score and the one that beat it.
              </p>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", `All (${problems.length})`],
                  ["open", `Window open (${counts.open})`],
                  ["unopened", `No window yet (${counts.unopened})`],
                  ["mine", `I have submitted (${counts.mine})`],
                ] as [Lens, string][]
              ).map(([key, label]) => (
                <Toggle key={key} active={lens === key} onClick={() => setLens(key)}>
                  {label}
                </Toggle>
              ))}
            </div>

            {rows.length === 0 ? (
              <Empty
                icon="search"
                title={
                  problems.length === 0
                    ? "No verified problems are open right now"
                    : "Nothing under this lens"
                }
                why={
                  problems.length === 0
                    ? "Problems appear here once the AI finds independent proof or a verifier confirms them, and leave once a college is awarded. Until then they are still being checked, which is deliberate — a college should not build against an unconfirmed report."
                    : "The problems are all still listed, just not in this subset. Switch back to All."
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {rows.map((p) => (
                  <ProblemCard key={p.id} problem={p} />
                ))}
              </div>
            )}

            <Panel
              title="What a proposal has to contain"
              lede="The rubric is published in advance, so nobody is guessing at what is being judged."
              depth="in"
            >
              <ul className="grid gap-x-6 gap-y-2.5 text-[13px] leading-relaxed text-body sm:grid-cols-2">
                <li>
                  <strong className="text-ink">Problem fit — 25.</strong> Judged against this
                  brief, not the category. A good solution to a different problem scores zero.
                </li>
                <li>
                  <strong className="text-ink">Technical soundness — 20.</strong> Real components,
                  available in India, used the way they work.
                </li>
                <li>
                  <strong className="text-ink">Practicality in context — 15.</strong> Buildable{" "}
                  <em>and maintainable</em> in a rural block: no reliable power, no technician on
                  call, monsoon.
                </li>
                <li>
                  <strong className="text-ink">Cost credibility — 15.</strong> Too low is
                  penalised as hard as inflated.
                </li>
                <li>
                  <strong className="text-ink">Timeline credibility — 10.</strong> Plausible, and
                  respecting any deadline in the brief.
                </li>
                <li>
                  <strong className="text-ink">Requirements completeness — 10.</strong> Itemised
                  materials, so a funder can act on it.
                </li>
                <li>
                  <strong className="text-ink">Maintenance and handover — 5.</strong> Who keeps it
                  running after you graduate.
                </li>
              </ul>
              <p className="mt-4 text-[12.5px] leading-relaxed text-body">
                Anything under 40 is refused as not viable rather than ranked last.
              </p>
            </Panel>
          </>
        )}
      </Main>
    </>
  );
}

function ProblemCard({ problem }: { problem: CollegeProblem }) {
  const mine = problem.my_proposal;

  return (
    <div className="up flex flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.1em] text-mute">
            <span className="text-navy">{problem.ref}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="pin" size={11} />
              {[problem.block, problem.district].filter(Boolean).join(", ")}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Icon name={CATEGORY_ICON[problem.category] ?? "info"} size={11} />
              {CATEGORY_LABEL[problem.category] ?? humanise(problem.category)}
            </span>
          </div>
          <h3 className="mt-2 text-[16px] font-bold leading-snug text-navy-dark">
            {problem.title}
          </h3>
        </div>
        <div className="flex flex-none items-end gap-1">
          <span className="mono text-[24px] font-semibold leading-none text-ink">
            {problem.priority}
          </span>
          <span className="mono pb-0.5 text-[10px] text-mute">/100</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <BandChip band={problem.band ?? bandOf(problem.priority)} />
        <ConfidenceChip confidence={problem.confidence} />
        {problem.verification && (
          <Tag icon={<Icon name={problem.verification.method === "ai" ? "spark" : "shield"} size={11} />}>
            {problem.verification.method === "ai"
              ? `AI · ${problem.verification.sources} source${problem.verification.sources === 1 ? "" : "s"}`
              : `${problem.verification.method} verified`}
          </Tag>
        )}
        <Tag>{num(problem.people_est)} people</Tag>
      </div>

      {problem.brief?.problem && (
        <p className="mt-3 text-[13px] leading-relaxed text-body">
          {problem.brief.problem.length > 220
            ? `${problem.brief.problem.slice(0, 219).trimEnd()}…`
            : problem.brief.problem}
        </p>
      )}

      {problem.capabilities?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {problem.capabilities.slice(0, 5).map((c) => (
            <Tag key={c}>{humanise(c)}</Tag>
          ))}
        </div>
      )}

      <div className="mt-4">
        <WindowState competition={problem.competition} myScore={mine?.score ?? null} compact />
      </div>

      {mine && (
        <div className="up-s mt-3 flex flex-wrap items-center justify-between gap-2 p-3.5">
          <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
            your v{mine.version} · {humanise(mine.state)}
          </div>
          <div className="flex items-center gap-2">
            {mine.score !== null && (
              <span className="mono text-[13px] font-semibold text-ink">{mine.score}/100</span>
            )}
            {mine.is_leading === true && <Chip tone="teal">Leading</Chip>}
            {mine.is_leading === false && <Chip tone="high">Behind</Chip>}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2.5 pt-4">
        <ButtonLink
          href={`/college/problems/${problem.ref}`}
          variant="primary"
          size="sm"
          iconAfter="arrow"
        >
          {mine ? "Submit a new version" : "Read it and propose"}
        </ButtonLink>
        <ButtonLink href={`/challenge/${problem.ref}`} variant="secondary" size="sm" icon="eye">
          Full brief
        </ButtonLink>
      </div>

      <p className="mono mt-3 text-[9.5px] uppercase tracking-[0.08em] text-mute">
        verified {problem.verified_at ? relative(problem.verified_at) : "date not recorded"} ·{" "}
        {num(problem.report_count)} reports
      </p>
    </div>
  );
}
