"use client";

import React from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Empty, ErrorNote, NotMeasured, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { hours, num, pct } from "@/lib/format";
import type { SlaStage } from "@/types/database";

/**
 * Where the time actually goes.
 *
 * Eight stages, each with a target, and the breaches named with their
 * reference so a coordinator can open the one that is late. A stage with no
 * sample says so — an attainment figure computed from one row is noise, and
 * printing it as though it were a rate is how dashboards start lying.
 */
export default function SlaPage() {
  return (
    <RouteGuard>
      <Sla />
    </RouteGuard>
  );
}

function Sla() {
  const res = useResource(() => apiClient.fetchSla(), []);
  const d = res.data;

  const measured = (d?.stages ?? []).filter((s) => s.sample_size > 0);
  const unmeasured = (d?.stages ?? []).filter((s) => s.sample_size === 0);
  const worstStage = measured
    .slice()
    .sort((a, b) => (a.attainment_pct ?? 100) - (b.attainment_pct ?? 100))[0];
  const totalBreaches = measured.reduce((s, x) => s + x.breaches.length, 0);

  return (
    <>
      <PageHead
        eyebrow="System owner"
        title="SLA and timings"
        lede="Each stage has a target in hours. This page names the stage that stalls and the specific challenges that breached it — an average with nothing attached to it cannot be acted on."
        right={
          <ButtonLink href="/admin" variant="secondary" icon="back">
            Command centre
          </ButtonLink>
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={5} height={130} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : !d ? null : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Stages measured"
                value={`${num(d.overall.stages_measured)} of ${num(d.overall.stages_total)}`}
                sub="The rest have no completed transitions yet"
              />
              <Stat
                label="Sample size"
                value={num(d.overall.sample_size)}
                sub={
                  d.overall.sample_size < 10
                    ? "Small: read these as examples, not rates"
                    : "Transitions with both timestamps"
                }
                tone={d.overall.sample_size < 10 ? "alert" : undefined}
              />
              <Stat
                label="Breaches on record"
                value={num(totalBreaches)}
                sub="Named below, with references"
                tone={totalBreaches > 0 ? "alert" : undefined}
              />
              <Stat
                label="Worst stage"
                value={worstStage ? pct(worstStage.attainment_pct) : "—"}
                sub={worstStage ? worstStage.label : "Nothing measured yet"}
                tone={worstStage && (worstStage.attainment_pct ?? 100) < 50 ? "alert" : undefined}
              />
            </div>

            {d.overall.sample_size < 10 && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-mute">
                  <Icon name="info" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  <strong className="text-ink">
                    The sample is {num(d.overall.sample_size)} transitions.
                  </strong>{" "}
                  Percentages from a sample this small are shown because the individual breaches
                  are useful, not because the rate is meaningful. They will settle once the
                  platform has run for a few weeks.
                </p>
              </Card>
            )}

            <Panel
              title="Stage by stage"
              lede="Median and worst case against the target, with every breach named."
            >
              {measured.length === 0 ? (
                <Empty
                  icon="clock"
                  title="No stage has enough data to measure"
                  why="A stage is only measured once challenges have both the start and the end timestamp for it. Nothing has completed a full transition yet."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {measured.map((s) => (
                    <StageRow key={s.stage_key} stage={s} />
                  ))}
                </div>
              )}

              {unmeasured.length > 0 && (
                <div className="hairline mt-5 pt-5">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Not measurable yet
                  </div>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {unmeasured.map((s) => (
                      <li key={s.stage_key} className="in-s p-3.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[13px] font-semibold text-ink">{s.label}</span>
                          <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
                            target {hours(s.target_hours)}
                          </span>
                        </div>
                        <div className="mt-2">
                          <NotMeasured
                            what={s.label}
                            why="no challenge has both timestamps for this transition yet"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>

            <Panel
              title="By district"
              lede="Attainment where the work actually happens. A district with one sample is labelled as such."
            >
              {d.by_district.length === 0 ? (
                <Empty
                  icon="pin"
                  title="No district has a measurable sample"
                  why="District attainment needs completed transitions attributed to a district. None are recorded yet."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {d.by_district
                    .slice()
                    .sort((a, b) => a.attainment_pct - b.attainment_pct)
                    .map((x) => (
                      <div key={x.district} className="up-s p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[14px] font-bold text-ink">{x.district}</span>
                          <div className="flex items-center gap-2.5">
                            <Chip tone={x.attainment_pct >= 70 ? "teal" : x.attainment_pct >= 40 ? "high" : "alert"}>
                              {pct(x.attainment_pct)} on target
                            </Chip>
                            <span className="mono text-[10.5px] text-mute">
                              n={num(x.sample_size)}
                            </span>
                          </div>
                        </div>
                        <Meter
                          value={x.attainment_pct}
                          className="mt-2.5"
                          height={8}
                          colour={
                            x.attainment_pct >= 70
                              ? "var(--color-teal)"
                              : x.attainment_pct >= 40
                                ? "var(--color-high)"
                                : "var(--color-alert)"
                          }
                        />
                        <div className="mono mt-2 text-[10px] uppercase tracking-[0.1em] text-mute">
                          mean {hours(x.mean_hours)} per stage
                          {x.sample_size < 5 ? " · sample too small to be a rate" : ""}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </Panel>
          </>
        )}
      </Main>
    </>
  );
}

function StageRow({ stage: s }: { stage: SlaStage }) {
  const attain = s.attainment_pct ?? 0;
  const tone = attain >= 70 ? "teal" : attain >= 40 ? "high" : "alert";
  const colour =
    tone === "teal"
      ? "var(--color-teal)"
      : tone === "high"
        ? "var(--color-high)"
        : "var(--color-alert)";

  return (
    <div className="up-s p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-navy-dark">{s.label}</h3>
          <div className="mono mt-1 text-[10px] uppercase tracking-[0.1em] text-mute">
            {s.stage_key} · target {hours(s.target_hours)} · n={num(s.sample_size)}
          </div>
        </div>
        <Chip tone={tone}>{pct(s.attainment_pct)} on target</Chip>
      </div>

      <Meter value={attain} className="mt-3.5" height={10} colour={colour} />

      <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Figure label="Median" value={hours(s.median_hours)} />
        <Figure label="Worst case" value={hours(s.worst_hours)} alert={(s.worst_hours ?? 0) > s.target_hours * 3} />
        <Figure label="Target" value={hours(s.target_hours)} />
      </div>

      {s.breaches.length > 0 && (
        <div className="hairline mt-4 pt-3.5">
          <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-alert-ink">
            {s.breaches.length} breach{s.breaches.length === 1 ? "" : "es"}
          </div>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {s.breaches.slice(0, 8).map((b) => (
              <li key={b.challenge_id}>
                <Link
                  href={`/admin/challenges/${b.ref}`}
                  className="in-s flex items-center justify-between gap-3 p-2.5 hover:text-navy"
                >
                  <span className="mono text-[11px] text-navy">{b.ref}</span>
                  <span className="flex-1 truncate text-[12.5px] text-body">
                    {b.district ?? "district unknown"}
                  </span>
                  <span className="mono flex-none text-[11px] font-semibold text-alert-ink">
                    {hours(b.hours)}
                  </span>
                  <span className="flex-none text-mute">
                    <Icon name="chevRight" size={13} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {s.breaches.length > 8 && (
            <p className="mono mt-2 text-[10px] uppercase tracking-[0.1em] text-mute">
              and {s.breaches.length - 8} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="in-s p-3">
      <div className="mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mute">
        {label}
      </div>
      <div
        className={`mono mt-1 text-[15px] font-semibold ${alert ? "text-alert-ink" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}
