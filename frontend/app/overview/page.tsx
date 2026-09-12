"use client";

import React, { useMemo } from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat } from "@/components/ui/Surface";
import { Chip, Tag } from "@/components/ui/Chip";
import { ErrorNote, NotMeasured, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { CATEGORY_LABEL, STATUS_LABEL, dateOnly, hours, humanise, num, pct } from "@/lib/format";

/**
 * Impact.
 *
 * The rule that governs this page: a headline figure with a sample size of
 * zero is not rendered as a number. It prints an em dash and the sentence
 * explaining what is missing, because "median time to team formed: 0 minutes"
 * is a lie that looks like an achievement.
 */
export default function OverviewPage() {
  return (
    <RouteGuard>
      <Overview />
    </RouteGuard>
  );
}

const FUNNEL: { key: string; label: string }[] = [
  { key: "reported", label: "Reported" },
  { key: "refined", label: "Compiled" },
  { key: "verified", label: "Verified" },
  { key: "team_formed", label: "Team formed" },
  { key: "piloted", label: "Piloted" },
  { key: "deployed", label: "Deployed" },
  { key: "impact_verified", label: "Impact verified" },
];

function Overview() {
  const res = useResource(() => apiClient.fetchDashboardMetrics(), []);
  const d = res.data;

  const funnel = useMemo(() => {
    if (!d?.funnel) return [];
    const top = d.funnel.reported ?? 1;
    return FUNNEL.filter((f) => d.funnel[f.key] !== undefined).map((f) => ({
      ...f,
      value: d.funnel[f.key] as number,
      share: top > 0 ? ((d.funnel[f.key] as number) / top) * 100 : 0,
    }));
  }, [d]);

  const categories = useMemo(
    () =>
      d?.by_category
        ? Object.entries(d.by_category as Record<string, number>).sort((a, b) => b[1] - a[1])
        : [],
    [d],
  );

  const sampleZero = (d?.headline?.sample_size ?? 0) === 0;

  return (
    <>
      <PageHead
        eyebrow="District officer"
        title="Impact"
        lede="What the platform has actually moved, and what it cannot measure yet. Figures with no sample behind them are shown as blank with a reason, never as a zero."
        right={
          d?.simulated ? <Chip tone="neutral">Includes seeded rows</Chip> : undefined
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={3} height={200} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : !d ? null : (
          <>
            {/* ---- headline, honestly ------------------------------------ */}
            <div className="grid gap-3 lg:grid-cols-4">
              <Card className="p-5">
                <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                  Report to a team on it
                </div>
                <div className="mt-2">
                  {d.headline?.median_hours_to_team_formed === null ||
                  d.headline?.median_hours_to_team_formed === undefined ? (
                    <NotMeasured
                      what="Median time to a team"
                      why={
                        sampleZero
                          ? "no challenge has both a report timestamp and a team-formed timestamp yet"
                          : "the sample is too small to take a median"
                      }
                    />
                  ) : (
                    <>
                      <div className="mono text-[26px] font-semibold leading-none text-ink">
                        {hours(d.headline.median_hours_to_team_formed)}
                      </div>
                      <div className="mt-1.5 text-[12.5px] text-body">
                        median over {num(d.headline.sample_size)} challenges
                      </div>
                    </>
                  )}
                </div>
              </Card>

              <Stat
                label="Reached a pilot or deployment"
                value={pct(d.headline?.pct_reaching_pilot_or_deployment)}
                sub="Of everything on the register"
              />
              <Stat
                label="University–industry pairs"
                value={num(d.headline?.university_industry_collaborations)}
                sub="A college and a company on the same challenge"
                tone={
                  (d.headline?.university_industry_collaborations ?? 0) > 0 ? "teal" : undefined
                }
              />
              <Stat
                label="Median time to resolution"
                value={hours(d.speed?.median_hours_to_resolution)}
                sub={
                  d.speed?.median_hours_to_resolution
                    ? "Report to the work being finished"
                    : "Nothing resolved yet"
                }
              />
            </div>

            {d.data_warnings && Object.keys(d.data_warnings).length > 0 && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-alert-ink">
                  <Icon name="alert" size={16} />
                </span>
                <div>
                  <p className="text-[13px] leading-relaxed text-body">
                    <strong className="text-ink">The data has known problems.</strong> These are
                    printed rather than smoothed over, because a metric computed from a bad row is
                    worse than a missing metric.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {Object.entries(d.data_warnings as Record<string, number>).map(([k, v]) => (
                      <Tag key={k}>
                        {humanise(k)}: {num(v)}
                      </Tag>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* ---- the funnel ------------------------------------------- */}
            <Panel
              title="From a report to delivered work"
              lede="Each stage as a share of everything reported. The steepest drop is where the platform is failing."
            >
              <ul className="flex flex-col gap-3.5">
                {funnel.map((f, i) => {
                  const prev = i > 0 ? funnel[i - 1].value : null;
                  const drop = prev && prev > 0 ? 100 - (f.value / prev) * 100 : null;
                  return (
                    <li key={f.key}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[13.5px] font-semibold text-ink">{f.label}</span>
                        <div className="flex items-baseline gap-2.5">
                          {drop !== null && drop > 50 && (
                            <span className="mono text-[10px] font-semibold uppercase tracking-[0.08em] text-alert-ink">
                              −{Math.round(drop)}% here
                            </span>
                          )}
                          <span className="mono text-[12px] font-semibold text-navy">
                            {num(f.value)}
                          </span>
                          <span className="mono text-[10.5px] text-mute">
                            {pct(f.share)}
                          </span>
                        </div>
                      </div>
                      <Meter
                        value={f.share}
                        className="mt-1.5"
                        height={9}
                        colour={
                          drop !== null && drop > 50
                            ? "var(--color-alert)"
                            : i >= 4
                              ? "var(--color-teal)"
                              : "var(--color-navy)"
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* ---- outcome --------------------------------------------- */}
              <Panel
                title="People"
                lede="Counted from the estimates on the challenges that reached delivery."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="up-s p-4">
                    <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                      Served
                    </div>
                    <div className="mono mt-1.5 text-[22px] font-semibold text-teal-ink">
                      {num(d.outcome?.people_served)}
                    </div>
                  </div>
                  <div className="up-s p-4">
                    <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                      Of whom vulnerable
                    </div>
                    <div className="mono mt-1.5 text-[22px] font-semibold text-ink">
                      {num(d.outcome?.vulnerable_served)}
                    </div>
                  </div>
                </div>
                <div className="in mt-3 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
                      challenges with nothing pledged
                    </span>
                    <span className="mono text-[15px] font-semibold text-alert-ink">
                      {num(d.outcome?.unmet_challenges)}
                    </span>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-body">
                    These are verified problems that no organisation has put anything against.
                    They are the backlog the needs board exists to clear.
                  </p>
                </div>
              </Panel>

              {/* ---- quality --------------------------------------------- */}
              <Panel
                title="Evidence quality"
                lede="How much of the register has been confirmed by somebody, and how much duplication the compiler caught."
              >
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] font-semibold text-ink">
                        Verified by a person
                      </span>
                      <span className="mono text-[12px] font-semibold text-navy">
                        {pct(d.quality?.pct_verified)}
                      </span>
                    </div>
                    <Meter
                      value={d.quality?.pct_verified ?? 0}
                      className="mt-2"
                      height={8}
                      colour="var(--color-teal)"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="in-s p-3.5">
                      <div className="mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mute">
                        Community confirmed
                      </div>
                      <div className="mono mt-1 text-[17px] font-semibold text-ink">
                        {num(d.quality?.community_confirmed)}
                      </div>
                    </div>
                    <div className="in-s p-3.5">
                      <div className="mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mute">
                        Duplicates merged
                      </div>
                      <div className="mono mt-1 text-[17px] font-semibold text-ink">
                        {num(d.quality?.duplicates_merged)}
                      </div>
                    </div>
                  </div>
                  {(d.quality?.duplicates_merged ?? 0) === 0 && (
                    <p className="text-[12.5px] leading-relaxed text-body">
                      Nothing has been merged as a duplicate. With semantic embeddings unavailable
                      on this deployment the deduplicator is matching lexically, so two reports of
                      the same event in different words will be missed — that is a known gap, not
                      evidence that no duplicates exist.
                    </p>
                  )}
                </div>
              </Panel>
            </div>

            {/* ---- crisis ---------------------------------------------- */}
            {d.crisis?.active > 0 && (
              <Panel
                title="Crisis mode"
                lede="While a crisis is live, ranking switches from planning weights to response weights."
              >
                <ul className="flex flex-col gap-2.5">
                  {(d.crisis.events as Record<string, unknown>[]).map((e) => (
                    <li key={String(e.id)} className="up-s p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[14px] font-bold text-ink">
                            {String(e.headline)}
                          </div>
                          <div className="mono mt-1 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                            {humanise(String(e.hazard))} · severity {String(e.severity)}/5 ·
                            started {dateOnly(String(e.started_at))} · via{" "}
                            {humanise(String(e.source))}
                          </div>
                        </div>
                        <div className="flex flex-none flex-wrap items-center gap-2">
                          {Boolean(e.is_drill) && <Chip tone="neutral">Drill</Chip>}
                          {(e.districts as string[])?.slice(0, 3).map((x) => (
                            <Tag key={x}>{x}</Tag>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {/* ---- breakdown ------------------------------------------- */}
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="By category" lede="What kind of problem the state is dealing with.">
                <ul className="flex flex-col gap-2.5">
                  {categories.map(([cat, count]) => (
                    <li key={cat}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] text-body">
                          {CATEGORY_LABEL[cat] ?? humanise(cat)}
                        </span>
                        <span className="mono text-[12px] font-semibold text-navy">
                          {num(count)}
                        </span>
                      </div>
                      <Meter
                        value={count}
                        max={categories[0]?.[1] ?? 1}
                        height={6}
                        className="mt-1.5"
                      />
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel
                title="Organisations on the platform"
                lede="Verified partners by type. An unverified organisation cannot be assigned work."
              >
                {d.organisations ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="up-s p-4">
                        <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                          Total
                        </div>
                        <div className="mono mt-1.5 text-[22px] font-semibold text-ink">
                          {num(d.organisations.total)}
                        </div>
                      </div>
                      <div className="up-s p-4">
                        <div className="mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                          Verified
                        </div>
                        <div className="mono mt-1.5 text-[22px] font-semibold text-teal-ink">
                          {num(d.organisations.verified)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(
                        (d.organisations.by_type ?? {}) as Record<string, number>,
                      ).map(([t, n]) => (
                        <Tag key={t}>
                          {humanise(t)}: {num(n)}
                        </Tag>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] leading-relaxed text-body">
                    The organisation breakdown is not part of this response.
                  </p>
                )}
              </Panel>
            </div>

            {d.by_status && (
              <Panel title="Status of everything on the register" depth="in">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(d.by_status as Record<string, number>)
                    .sort((a, b) => b[1] - a[1])
                    .map(([s, n]) => (
                      <span
                        key={s}
                        className="up-s mono inline-flex items-center gap-2 px-3 py-2 text-[11px] text-body"
                      >
                        {STATUS_LABEL[s] ?? humanise(s)}
                        <span className="font-semibold text-navy">{num(n)}</span>
                      </span>
                    ))}
                </div>
              </Panel>
            )}
          </>
        )}
      </Main>
    </>
  );
}
