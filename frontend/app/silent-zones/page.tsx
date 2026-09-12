"use client";

import React from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat } from "@/components/ui/Surface";
import { Chip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { humanise, num, pct } from "@/lib/format";

/**
 * Silent zones — the blocks that should be reporting and are not.
 *
 * The inversion this page exists for: every other screen ranks what was
 * reported, which means the loudest districts get the attention. A block
 * inside a mapped hazard zone with a real population and no reports is either
 * genuinely fine or completely unreached, and those two possibilities look
 * identical from a dashboard that only counts reports.
 */
export default function SilentZonesPage() {
  return (
    <RouteGuard>
      <SilentZones />
    </RouteGuard>
  );
}

const HAZARD_ICON: Record<string, "bolt" | "drop" | "seed" | "box" | "tree" | "alert"> = {
  lightning: "bolt",
  flood: "drop",
  drought: "seed",
  mining: "box",
  forest_fire: "alert",
  elephant_conflict: "tree",
};

function SilentZones() {
  const res = useResource(() => apiClient.fetchSilentZones(), []);
  const d = res.data;

  const layers = d ? Object.entries(d.hazard_layers ?? {}) : [];
  const zones = d?.silent_zones ?? [];

  return (
    <>
      <PageHead
        eyebrow="Coverage"
        title="Silent zones"
        lede="Blocks that sit in a mapped hazard zone, have people living in them, and have sent nothing. Silence is not the same as safety, and this is the one screen that treats it as a finding rather than an absence."
        right={
          d ? (
            <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
              last {num(d.window_days)} days
            </span>
          ) : undefined
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats count={3} />
            <SkeletonRows rows={4} height={120} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : !d ? null : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Silent blocks"
                value={num(zones.length)}
                sub={
                  zones.length === 0
                    ? "Every mapped hazard block has reported"
                    : "In a hazard zone, nothing received"
                }
                tone={zones.length > 0 ? "alert" : "teal"}
              />
              <Stat
                label="Hazard layers mapped"
                value={num(layers.length)}
                sub="Each with its own districts and intensity"
              />
              <Stat
                label="Window"
                value={`${num(d.window_days)} d`}
                sub="How far back the silence is measured"
              />
              <Stat
                label="Region"
                value={humanise(d.region_id)}
                sub="Hazard layers are per region"
              />
            </div>

            <Card depth="in" className="flex items-start gap-3 p-5">
              <span className="mt-0.5 text-mute">
                <Icon name="info" size={17} />
              </span>
              <p className="text-[13.5px] leading-relaxed text-body">{d.explanation}</p>
            </Card>

            <Panel
              title="Blocks that have gone quiet"
              lede="Worth a volunteer visit before it is worth a dashboard entry."
            >
              {zones.length === 0 ? (
                <Empty
                  icon="check"
                  title="No silent zone right now"
                  why="Every block inside a mapped hazard layer with a recorded population has sent at least one report in the window. That is the state you want, and it is also the state that needs re-checking every few weeks."
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {zones.map((z, i) => (
                    <li key={`${z.district}-${z.block ?? i}`} className="up-s p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mono flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-[0.1em] text-mute">
                            <span className="inline-flex items-center gap-1">
                              <Icon name="pin" size={11} />
                              {[z.block, z.district].filter(Boolean).join(", ")}
                            </span>
                            {z.population ? (
                              <>
                                <span>·</span>
                                <span>{num(z.population)} people</span>
                              </>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {z.hazard && (
                              <Chip tone="alert">
                                <Icon name={HAZARD_ICON[z.hazard] ?? "alert"} size={11} />
                                {humanise(z.hazard)}
                              </Chip>
                            )}
                            <Tag>
                              {num(z.reports ?? 0)} report{(z.reports ?? 0) === 1 ? "" : "s"}
                            </Tag>
                          </div>
                        </div>
                        {z.intensity !== null && z.intensity !== undefined && (
                          <div className="flex-none text-right">
                            <div className="mono text-[20px] font-semibold leading-none text-alert-ink">
                              {z.intensity.toFixed(2)}
                            </div>
                            <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                              hazard intensity
                            </div>
                          </div>
                        )}
                      </div>
                      {z.intensity !== null && z.intensity !== undefined && (
                        <Meter
                          value={z.intensity * 100}
                          className="mt-3"
                          height={7}
                          colour="var(--color-alert)"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Hazard layers"
              lede="Where the risk is mapped, independent of who reported it. This is the baseline silence is measured against."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {layers
                  .slice()
                  .sort((a, b) => b[1].max_intensity - a[1].max_intensity)
                  .map(([hazard, layer]) => (
                    <div key={hazard} className="up-s p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="in-s grid h-9 w-9 place-items-center text-mute">
                            <Icon name={HAZARD_ICON[hazard] ?? "alert"} size={15} />
                          </span>
                          <div>
                            <div className="text-[14px] font-bold text-ink">
                              {humanise(hazard)}
                            </div>
                            <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                              {num(layer.cells)} cell{layer.cells === 1 ? "" : "s"} mapped
                            </div>
                          </div>
                        </div>
                        <div className="flex-none text-right">
                          <div className="mono text-[16px] font-semibold leading-none text-ink">
                            {pct(layer.max_intensity * 100)}
                          </div>
                          <div className="mono text-[9px] uppercase tracking-[0.08em] text-mute">
                            peak
                          </div>
                        </div>
                      </div>

                      <Meter
                        value={layer.max_intensity * 100}
                        className="mt-3"
                        height={7}
                        colour="var(--color-moderate)"
                      />

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {layer.districts.map((dd) => (
                          <Tag key={dd}>{dd}</Tag>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>
          </>
        )}
      </Main>
    </>
  );
}
