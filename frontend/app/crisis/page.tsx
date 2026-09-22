"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BandChip, Chip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { DisasterMap } from "@/components/domain/DisasterMap";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useAuth } from "@/lib/auth";
import { dateTime, humanise, num } from "@/lib/format";

export default function CrisisPage() {
  return (
    <RouteGuard>
      <CrisisCommandCenter />
    </RouteGuard>
  );
}

function CrisisCommandCenter() {
  const { role } = useAuth();
  const [drillStarting, setDrillStarting] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftedResults, setDraftedResults] = useState<Array<{ id: string; ref: string; title: string }> | null>(null);

  // Active crises
  const crisesRes = useResource(() => apiClient.fetchActiveCrises("jharkhand"), []);
  const activeEvents = crisesRes.data?.active ?? [];
  const currentCrisis = activeEvents[0] ?? null;

  // Crisis room data for the top active crisis
  const roomRes = useResource(
    () => (currentCrisis ? apiClient.fetchCrisisRoom(currentCrisis.id) : Promise.resolve(null)),
    [currentCrisis?.id],
  );
  const roomData = roomRes.data;

  // Trigger Mock Drill
  async function handleStartDrill() {
    setDrillStarting(true);
    setActionError(null);
    setDraftedResults(null);
    try {
      await apiClient.startCrisis({
        region_id: "jharkhand",
        hazard: "flood",
        drill: true,
        source: "mock_drill_coordinator",
        headline: "Pre-Monsoon Preparedness Drill · Sahebganj Flood Response",
        districts: ["Sahebganj"],
        severity: 5,
      });
      crisesRes.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start mock drill.");
    } finally {
      setDrillStarting(false);
    }
  }

  // End Crisis / Drill
  async function handleEndCrisis(crisisId: string) {
    setEndingId(crisisId);
    setActionError(null);
    try {
      const res = await apiClient.endCrisis(crisisId);
      setDraftedResults(res.preparedness_drafted);
      crisesRes.reload();
      roomRes.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to close crisis.");
    } finally {
      setEndingId(null);
    }
  }

  const isLive = Boolean(currentCrisis);

  return (
    <>
      {/* Emergency Crimson Band when Crisis or Mock Drill is active */}
      {isLive && (
        <div className="bg-[#B91C1C] text-white px-4 py-2.5 shadow-md">
          <div className="shell flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="font-extrabold uppercase tracking-wider text-[12.5px]">
                {currentCrisis.is_drill ? "MOCK DRILL ACTIVE" : "EMERGENCY ALERT"} · {currentCrisis.districts.join(", ")} · {currentCrisis.hazard.toUpperCase()}
              </span>
              <span className="hidden sm:inline text-white/80 text-[12px]">|</span>
              <span className="hidden sm:inline text-[12px] text-white/90">
                {currentCrisis.headline ?? "Rapid response protocol activated across state response matrix"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="mono text-[10.5px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">
                Fast-track Swarm
              </span>
              {(role === "coordinator" || role === "admin") && (
                <button
                  type="button"
                  onClick={() => handleEndCrisis(currentCrisis.id)}
                  disabled={endingId === currentCrisis.id}
                  className="bg-white text-[#B91C1C] font-bold text-[11px] px-3 py-1 rounded-md hover:bg-slate-100 transition-colors shadow-xs"
                >
                  {endingId === currentCrisis.id ? "Closing..." : "Close Drill & Draft Preparedness"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <PageHead
        eyebrow="Emergency operations"
        title="Crisis Command Room"
        lede="When an alert strikes, normal deliberation switches to high-velocity coordination: itemized relief gaps, nearby deployed stock, distress SMS feeds, and immediate university tech-squad call-ups."
        right={
          !isLive ? (
            <Button
              variant="danger"
              size="sm"
              icon="alert"
              busy={drillStarting}
              onClick={handleStartDrill}
            >
              Run Sahebganj Mock Drill
            </Button>
          ) : (
            <Chip tone="alert">
              <Icon name="bolt" size={12} />
              {currentCrisis.is_drill ? "Drill in progress" : "Live emergency"}
            </Chip>
          )
        }
      />

      <Main>
        {actionError && (
          <div className="mb-4">
            <ErrorNote message={actionError} />
          </div>
        )}

        {/* Preparedness Drafted Success Notice */}
        {draftedResults && draftedResults.length > 0 && (
          <Card className="mb-6 border-l-4 border-l-[#059669] p-5 bg-[#F0FDF4]">
            <div className="flex items-start gap-3">
              <span className="text-[#059669] mt-0.5">
                <Icon name="check" size={18} />
              </span>
              <div>
                <h4 className="text-[15px] font-bold text-[#065F46]">
                  Drill Completed: {draftedResults.length} Long-Term Preparedness Projects Auto-Drafted
                </h4>
                <p className="mt-1 text-[13px] text-[#047857] leading-relaxed">
                  In accordance with Point 9 of the PM&apos;s 10-Point Agenda (&quot;Learn from every disaster&quot;), the operational gaps from this event have been converted into long-term student engineering challenges:
                </p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {draftedResults.map((p) => (
                    <li key={p.id} className="text-[12.5px] font-semibold text-[#065F46]">
                      • {p.title} ({p.ref})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {!isLive ? (
          /* Peace State: Ready for Mock Drill */
          <div className="flex flex-col gap-6">
            <Card className="p-8 text-center bg-gradient-to-b from-white to-surface border-line">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FEE2E2] text-[#DC2626]">
                <Icon name="alert" size={26} />
              </div>
              <h3 className="mt-4 text-[20px] font-extrabold text-navy-dark">
                Peace Mode Active · All Districts Operational
              </h3>
              <p className="mt-2 max-w-[62ch] mx-auto text-[14.5px] leading-relaxed text-body">
                The state is operating under long-term resilience and student innovation protocols. To rehearse emergency response and test zero-internet SMS call-ups, trigger a district mock drill.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button
                  variant="danger"
                  icon="bolt"
                  busy={drillStarting}
                  onClick={handleStartDrill}
                >
                  Trigger Pre-Monsoon Flood Drill (Sahebganj)
                </Button>
                <ButtonLink href="/overview" variant="secondary">
                  View General Analytics
                </ButtonLink>
              </div>
            </Card>

            {/* GIS Overview Map */}
            <DisasterMap currentRegion="jharkhand" />
          </div>
        ) : (
          /* Live Crisis Mode Dashboard */
          <div className="flex flex-col gap-6">
            {/* Top Critical Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Affected Districts"
                value={currentCrisis.districts.join(", ")}
                sub="Emergency zone"
                tone="alert"
              />
              <Stat
                label="Target Hazard"
                value={humanise(currentCrisis.hazard)}
                sub={`Severity Level ${currentCrisis.severity}/5`}
                tone="alert"
              />
              <Stat
                label="Critical Needs"
                value={num(roomData?.counts?.critical ?? 0)}
                sub="Immediate life/water support"
              />
              <Stat
                label="SMS Signals"
                value={num(roomData?.smsReports?.length ?? 0)}
                sub="Received without data"
                tone="teal"
              />
            </div>

            {/* GIS Map showing Emergency Zone */}
            <DisasterMap
              challenges={(roomData?.needsBoard as any) ?? []}
              selectedDistrict="Sahebganj"
              currentRegion="jharkhand"
            />

            {/* Main Crisis Ops Grid */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              {/* Left Column: Rapid Needs Board */}
              <div className="flex flex-col gap-6">
                <Panel
                  title="Rapid Needs Board & Resource Swarm"
                  lede="Urgent equipment and supply lines divided into fractional pledges so multiple companies close the gap."
                >
                  {!roomData?.needsBoard || roomData.needsBoard.length === 0 ? (
                    <Empty
                      icon="box"
                      title="No critical needs currently open"
                      why="All emergency supplies for this sector have been fully pledged."
                    />
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {roomData.needsBoard.map((c) => (
                        <li key={c.id} className="up-s p-4 border border-line rounded-xl bg-surface">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="mono text-[11px] font-bold text-navy">{c.ref}</span>
                                <BandChip band="critical" />
                                <span className="text-[11px] text-mute font-medium">
                                  {c.district} · ~{num(c.people_est)} affected
                                </span>
                              </div>
                              <h4 className="mt-1 text-[15px] font-bold text-navy-dark leading-snug">
                                {c.title}
                              </h4>
                              <p className="mt-1 text-[13px] text-body">{c.why_critical}</p>
                            </div>
                            <span className="mono text-[18px] font-bold text-[#DC2626]">
                              {c.priority}
                              <span className="text-[10px] text-mute">/100</span>
                            </span>
                          </div>

                          {/* Itemized Needs and Pledges */}
                          {c.gap && c.gap.needs.length > 0 && (
                            <div className="mt-3.5 border-t border-line/60 pt-3">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-ink mb-1.5">
                                <span>Resource Swarm Progress</span>
                                <span className="mono font-bold text-navy">{c.gap.pctClosed}% closed</span>
                              </div>
                              <Meter
                                value={c.gap.pctClosed}
                                colour={c.gap.fullyPledged ? "var(--color-teal)" : "#DC2626"}
                                height={8}
                              />
                              <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                                {c.gap.needs.map((n) => (
                                  <div key={n.need_id} className="in-s p-2 rounded-lg text-[12px]">
                                    <span className="font-bold text-ink">{n.item}:</span>{" "}
                                    <span className="text-body">
                                      {n.qty_pledged} / {n.qty_needed} {n.unit}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Nearby Stock */}
                          {c.nearby && c.nearby.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-body">
                              <span className="mono text-[10px] uppercase font-bold text-mute">Nearby:</span>
                              {c.nearby.map((r) => (
                                <Tag key={r.id}>
                                  {r.quantity} {r.type} ({r.distance_km.toFixed(1)} km)
                                </Tag>
                              ))}
                            </div>
                          )}

                          <div className="mt-3 flex items-center justify-end gap-2">
                            <ButtonLink href={`/challenge/${c.ref}`} variant="secondary" size="sm">
                              Inspect Details
                            </ButtonLink>
                            <ButtonLink href="/needs" variant="primary" size="sm">
                              Pledge Support
                            </ButtonLink>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              {/* Right Column: Live Distress SMS Feed & Tech Squad */}
              <div className="flex flex-col gap-6">
                {/* Live Incoming SMS Stream */}
                <Panel
                  title="Zero-Internet Distress SMS Ticker"
                  lede="Reports received through 160-char SMS gateway while mobile broadband is offline."
                  right={<Icon name="signal" size={16} />}
                >
                  {!roomData?.smsReports || roomData.smsReports.length === 0 ? (
                    <p className="text-[13px] text-mute">No incoming SMS recorded in this window.</p>
                  ) : (
                    <ul className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {roomData.smsReports.map((sms) => (
                        <li key={sms.id} className="in-s p-3 rounded-xl border border-line/60">
                          <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-mute">
                            <span className="flex items-center gap-1.5 text-alert-ink">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                              Via Coded SMS
                            </span>
                            <span>{dateTime(sms.created_at)}</span>
                          </div>
                          <p className="mt-1.5 text-[13px] font-semibold text-ink leading-relaxed">
                            &quot;{sms.original_text}&quot;
                          </p>
                          <div className="mono mt-1 text-[10px] text-mute">
                            Loc: {sms.village ?? "Village unverified"}, {sms.district} · Exact GPS Embedded
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                {/* University Tech Squad */}
                <Panel
                  title="Activated University Tech-Squad"
                  lede="Specialized engineering labs and research teams mobilized under Point 6 of PM's 10-Point Agenda."
                  right={<Icon name="grad" size={16} />}
                >
                  {!roomData?.techSquad || roomData.techSquad.length === 0 ? (
                    <p className="text-[13px] text-mute">No university teams currently registered in sector.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {roomData.techSquad.slice(0, 6).map((org) => (
                        <li key={org.id} className="flex items-center justify-between up-s p-3 rounded-lg">
                          <div>
                            <h5 className="text-[13.5px] font-bold text-navy-dark">{org.name}</h5>
                            <p className="mono text-[10px] uppercase text-mute">
                              {org.district} · {org.expertise?.join(", ") || "Engineering response"}
                            </p>
                          </div>
                          <Chip tone="teal">Activated</Chip>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
          </div>
        )}
      </Main>
    </>
  );
}
