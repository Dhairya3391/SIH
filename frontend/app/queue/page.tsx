"use client";

import React, { useMemo, useState } from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat } from "@/components/ui/Surface";
import { ButtonLink, Toggle } from "@/components/ui/Button";
import { BandChip, Chip, ConfidenceChip, StatusChip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { ChallengeRow } from "@/components/domain/ChallengeRow";
import { ScoreFactors } from "@/components/domain/ScoreFactors";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useNow } from "@/lib/useNow";
import { CATEGORY_LABEL, bandOf, humanise, num, relative } from "@/lib/format";
import type { Challenge } from "@/types/database";

/**
 * Triage.
 *
 * The list ranks; it does not decide. Picking a row opens the eight factors
 * that produced its number, with the real weights and the real caps — because
 * a coordinator who cannot see why Gumla outranks Ranchi has no basis to
 * defend the order to the people in Ranchi.
 */
export default function QueuePage() {
  return (
    <RouteGuard>
      <TriageQueue />
    </RouteGuard>
  );
}

type Band = "all" | "critical" | "high" | "moderate" | "long_term";

function TriageQueue() {
  const res = useResource(() => apiClient.fetchChallenges({ limit: 200 }), []);
  const [band, setBand] = useState<Band>("all");
  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const now = useNow();

  // Memoised so an unresolved fetch does not hand every useMemo below a
  // brand-new empty array on each render.
  const all = useMemo(() => res.data?.challenges ?? [], [res.data]);

  const districts = useMemo(
    () => [...new Set(all.map((c) => c.district).filter(Boolean) as string[])].sort(),
    [all],
  );
  const categories = useMemo(
    () => [...new Set(all.map((c) => c.category).filter(Boolean))].sort(),
    [all],
  );

  const rows = useMemo(() => {
    return all
      .filter((c) => (band === "all" ? true : (c.band ?? bandOf(c.priority)) === band))
      .filter((c) => (district ? c.district === district : true))
      .filter((c) => (category ? c.category === category : true))
      .slice()
      .sort((a, b) => b.priority - a.priority);
  }, [all, band, district, category]);

  // Derived rather than synced in an effect: the selection is always the row
  // the officer picked if it survived the filter, and otherwise the top of the
  // list. No effect means no frame where the panel shows a stale challenge.
  const selected = useMemo(
    () => rows.find((r) => r.id === picked) ?? rows[0] ?? null,
    [rows, picked],
  );
  const selectedId = selected?.id ?? null;

  const counts = useMemo(() => {
    const by = (b: string) => all.filter((c) => (c.band ?? bandOf(c.priority)) === b).length;
    const unverified = all.filter((c) => c.confidence === "unverified").length;
    // Null until the clock is known, so the tile shows a dash for one frame
    // instead of claiming nothing is stale.
    const stale =
      now === null
        ? null
        : all.filter((c) => now - new Date(c.updated_at).getTime() > 7 * 86_400_000).length;
    return {
      critical: by("critical"),
      high: by("high"),
      moderate: by("moderate"),
      long_term: by("long_term"),
      unverified,
      stale,
    };
  }, [all, now]);

  return (
    <>
      <PageHead
        eyebrow="District officer"
        title="Triage"
        lede="Ranked by a score you can open. Nothing here is acted on automatically — the order is a recommendation and the reasoning behind every number is one click away."
        right={
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              className="field max-w-[190px]"
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
            <SkeletonRows rows={5} height={128} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="On the list"
                value={num(all.length)}
                sub={`${num(rows.length)} match your filters`}
              />
              <Stat
                label="Critical band"
                value={num(counts.critical)}
                sub="Score 75 and above"
                tone={counts.critical > 0 ? "alert" : undefined}
              />
              <Stat
                label="Still unverified"
                value={num(counts.unverified)}
                sub="Blocked until a verifier confirms"
                tone={counts.unverified > 0 ? "alert" : undefined}
              />
              <Stat
                label="Untouched a week"
                value={counts.stale === null ? "—" : num(counts.stale)}
                sub={counts.stale === null ? "Measuring" : "No movement in seven days"}
                tone={(counts.stale ?? 0) > 0 ? "alert" : undefined}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", `All bands (${all.length})`],
                  ["critical", `Critical (${counts.critical})`],
                  ["high", `High (${counts.high})`],
                  ["moderate", `Moderate (${counts.moderate})`],
                  ["long_term", `Long term (${counts.long_term})`],
                ] as [Band, string][]
              ).map(([key, label]) => (
                <Toggle key={key} active={band === key} onClick={() => setBand(key)}>
                  {label}
                </Toggle>
              ))}
            </div>

            {rows.length === 0 ? (
              <Empty
                icon="search"
                title="Nothing matches those filters"
                why="All the problems are still there — this combination of band, district and category has none. Clear a filter to widen the list."
              />
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
                {/* ---- the ranked list ------------------------------------- */}
                <div className="flex flex-col gap-3">
                  {rows.slice(0, 60).map((c, i) => (
                    <div key={c.id} className="relative">
                      <span className="mono absolute -left-0.5 top-0 z-10 hidden text-[10px] font-semibold text-mute xl:block xl:-left-6 xl:top-6">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <ChallengeRow
                        reference={c.ref}
                        title={c.title}
                        district={c.district}
                        block={c.block}
                        category={c.category}
                        priority={c.priority}
                        band={c.band}
                        people={c.people_est}
                        reports={c.report_count}
                        reporters={c.reporter_count}
                        confidence={c.confidence}
                        status={c.status}
                        hazards={c.hazard_tags}
                        updatedAt={c.updated_at}
                        selected={c.id === selectedId}
                        onSelect={() => setPicked(c.id)}
                      />
                    </div>
                  ))}
                  {rows.length > 60 && (
                    <p className="mono text-center text-[10.5px] uppercase tracking-[0.1em] text-mute">
                      showing the top 60 of {num(rows.length)} · narrow the filters to see the rest
                    </p>
                  )}
                </div>

                {/* ---- why that number --------------------------------------- */}
                <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
                  {selected ? (
                    <WhyPanel challenge={selected} />
                  ) : (
                    <Card depth="in" className="p-5">
                      <p className="text-[13px] leading-relaxed text-body">
                        Pick a row to see the factors behind its score.
                      </p>
                    </Card>
                  )}
                </aside>
              </div>
            )}
          </>
        )}
      </Main>
    </>
  );
}

function WhyPanel({ challenge }: { challenge: Challenge }) {
  return (
    <>
      <Panel
        title="Why this score"
        lede="Eight factors, each with its own cap and its own sentence."
        right={<BandChip band={challenge.band ?? bandOf(challenge.priority)} />}
      >
        <div className="mono mb-4 text-[10.5px] uppercase tracking-[0.1em] text-navy">
          {challenge.ref}
        </div>
        <ScoreFactors
          breakdown={challenge.score_breakdown}
          whyCritical={challenge.why_critical}
        />
      </Panel>

      <Panel title="State" depth="up">
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceChip confidence={challenge.confidence} />
          <StatusChip status={challenge.status} />
          {challenge.is_simulated && (
            <Chip tone="neutral" title="Seeded demonstration data, not a real report">
              Seeded
            </Chip>
          )}
        </div>

        <dl className="mt-4 flex flex-col">
          <Row label="District" value={[challenge.block, challenge.district].filter(Boolean).join(", ") || "—"} />
          <Row label="People affected" value={num(challenge.people_est)} />
          <Row
            label="Reports"
            value={`${num(challenge.report_count)} from ${num(challenge.reporter_count)} reporters`}
          />
          <Row label="Phase" value={humanise(challenge.dm_phase)} />
          <Row label="Last moved" value={relative(challenge.updated_at)} />
        </dl>

        {challenge.capabilities?.length > 0 && (
          <div className="mt-4">
            <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
              Capabilities needed
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {challenge.capabilities.map((c) => (
                <Tag key={c}>{humanise(c)}</Tag>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
          <ButtonLink
            href={`/challenge/${challenge.ref}`}
            variant="primary"
            iconAfter="arrow"
          >
            Open the full brief
          </ButtonLink>
          {challenge.confidence === "unverified" && (
            <ButtonLink href={`/verify/${challenge.id}`} variant="secondary" icon="shield">
              Verify it
            </ButtonLink>
          )}
        </div>
      </Panel>

      {challenge.ai_uncertainties?.length > 0 && (
        <Panel
          title="What the compiler was unsure about"
          depth="in"
          lede="The model's own caveats about this brief."
        >
          <ul className="flex flex-col gap-2">
            {challenge.ai_uncertainties.map((u, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex-none text-high-ink">
                  <Icon name="alert" size={13} />
                </span>
                <p className="text-[12.5px] leading-relaxed text-body">{u}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="hairline flex items-baseline justify-between gap-3 py-2.5 first:border-t-0">
      <dt className="mono text-[10px] uppercase tracking-[0.1em] text-mute">{label}</dt>
      <dd className="text-right text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
