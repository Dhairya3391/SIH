"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { BackLink, Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { BandChip, ConfidenceChip, Tag } from "@/components/ui/Chip";
import { Caveat, Empty, ErrorNote, Skeleton, SkeletonRows } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { Corroboration, ConfidenceLadder } from "@/components/domain/Corroboration";
import { ScoreFactors } from "@/components/domain/ScoreFactors";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import {
  CHANNEL_LABEL,
  CONFIDENCE_RUNGS,
  bandOf,
  dateTime,
  num,
  relative,
} from "@/lib/format";

/**
 * Verify one report.
 *
 * Everything a verifier needs is on one screen, side by side, because the
 * decision is a comparison: what the people there said, against what the
 * outside world can confirm. Nothing is behind a tab — holding half the
 * evidence in your head is how a wrong call gets made.
 */
export default function VerifyOnePage() {
  return (
    <RouteGuard>
      <VerifyReview />
    </RouteGuard>
  );
}

function VerifyReview() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();

  const res = useResource(() => apiClient.fetchChallenge(id), [id], { enabled: Boolean(id) });

  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"none" | "confirm" | "reject">("none");
  const [sources, setSources] = useState("");
  const [photos, setPhotos] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<"confirmed" | "rejected" | null>(null);

  const detail = res.data;
  const challenge = detail?.challenge;
  const reports = detail?.cluster?.reports ?? [];

  // The queue row carries the corroboration summary; the detail endpoint does
  // not. Read it from the queue so the panel is populated either way.
  const queue = useResource(() => apiClient.fetchVerifyQueue({ limit: 100 }), []);
  const external = queue.data?.queue.find((q) => q.id === id)?.external ?? null;

  async function runCorroboration() {
    setRunning(true);
    setActionError(null);
    try {
      await apiClient.runCorroboration(id);
      queue.reload();
      res.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Corroboration could not run.");
    } finally {
      setRunning(false);
    }
  }

  async function confirm() {
    const sourceList = sources
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setBusy(true);
    setActionError(null);
    try {
      await apiClient.confirmVerification(id, {
        source_urls: sourceList,
        photo_paths: photos
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        note: note.trim(),
      });
      setDone("confirmed");
      res.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The verification was not recorded.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setActionError(null);
    try {
      await apiClient.rejectVerification(id, reason.trim());
      setDone("rejected");
      res.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The rejection was not recorded.");
    } finally {
      setBusy(false);
    }
  }

  if (res.loading && !res.settled) {
    return (
      <>
        <BackLink href="/verify" label="Verification queue" />
        <Main className="pt-6">
          <Skeleton height={90} rounded={16} />
          <div className="grid gap-5 lg:grid-cols-2">
            <SkeletonRows rows={3} height={140} />
            <SkeletonRows rows={3} height={140} />
          </div>
        </Main>
      </>
    );
  }

  if (res.error || !challenge) {
    return (
      <>
        <BackLink href="/verify" label="Verification queue" />
        <Main className="pt-6">
          <ErrorNote
            message={res.error ?? "That report could not be loaded."}
            code={res.code}
            onRetry={res.reload}
          />
        </Main>
      </>
    );
  }

  return (
    <>
      <BackLink href="/verify" label="Verification queue" trail={challenge.ref} />

      <PageHead
        eyebrow={`${challenge.ref} · ${challenge.district ?? "district unknown"}`}
        title={challenge.title}
        lede={challenge.brief?.problem ?? challenge.why_critical}
        right={
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <BandChip band={challenge.band ?? bandOf(challenge.priority)} />
              <ConfidenceChip confidence={challenge.confidence} />
            </div>
            <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
              filed {relative(challenge.created_at)}
            </span>
          </div>
        }
      />

      <Main>
        {done && (
          <Card depth="in" className="flex items-start gap-3 p-5">
            <span className="mt-px text-teal-ink">
              <Icon name="check" size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-navy-dark">
                {done === "confirmed" ? "Verification recorded" : "Rejection recorded"}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-body">
                {done === "confirmed"
                  ? "This problem is now field verified and open to colleges. Your name and the sources you filed are on the record against it."
                  : "The report stays on file with your reason attached, so the reporter and any reviewer can see why it did not stand."}
              </p>
              <div className="mt-4">
                <Button
                  variant="primary"
                  iconAfter="arrow"
                  onClick={() => router.push("/verify")}
                >
                  Next in the queue
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Priority" value={`${challenge.priority}`} sub="Out of 100" />
          <Stat
            label="Reports"
            value={num(challenge.report_count)}
            sub={`${num(challenge.reporter_count)} separate reporters`}
          />
          <Stat
            label="People affected"
            value={num(challenge.people_est)}
            sub={challenge.brief?.vulnerable?.length ? challenge.brief.vulnerable.join(", ") : "No group named"}
          />
          <Stat
            label="Villages"
            value={num(detail?.cluster?.villages ?? 0)}
            sub={`${num(detail?.cluster?.photos ?? 0)} photos · ${num(detail?.cluster?.via_sms ?? 0)} by SMS`}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* ---- what the people there said --------------------------------- */}
          <div className="flex flex-col gap-5">
            <Panel
              title="What the people there said"
              lede={`${num(reports.length)} of ${num(challenge.report_count)} reports, newest first. Original wording first, then how the system read it.`}
            >
              {reports.length === 0 ? (
                <Empty
                  icon="mic"
                  title="No individual reports are readable here"
                  why="The reports behind this problem are not exposed on this endpoint, which happens for seeded rows. The counts above are from the challenge record itself."
                />
              ) : (
                <ul className="flex max-h-[560px] flex-col gap-3 overflow-y-auto pr-1">
                  {reports.slice(0, 20).map((r) => (
                    <li key={r.id} className="up-s p-4">
                      <div className="mono flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                        <span>{dateTime(r.created_at)}</span>
                        <span>·</span>
                        <span>{CHANNEL_LABEL[r.channel] ?? r.channel}</span>
                        {r.village && (
                          <>
                            <span>·</span>
                            <span>{r.village}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>urgency {r.urgency}/5</span>
                      </div>

                      <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">
                        {r.original_text}
                      </p>

                      {r.translated_text && r.translated_text !== r.original_text && (
                        <Well small className="mt-2.5">
                          <p className="text-[12.5px] leading-relaxed text-body">
                            <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-mute">
                              read as ({r.lang}){" "}
                            </span>
                            {r.translated_text}
                          </p>
                        </Well>
                      )}

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {r.people_est > 0 && <Tag>{num(r.people_est)} people</Tag>}
                        {r.vulnerable.map((v) => (
                          <Tag key={v}>{v}</Tag>
                        ))}
                        {r.photo_urls.length > 0 && (
                          <Tag icon={<Icon name="camera" size={11} />}>
                            {r.photo_urls.length} photo
                            {r.photo_urls.length === 1 ? "" : "s"}
                          </Tag>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {detail && detail.verifications.length > 0 && (
              <Panel
                title="Already on the record"
                lede="Verifications filed before yours."
                depth="in"
              >
                <ul className="flex flex-col gap-2.5">
                  {detail.verifications.map((v) => (
                    <li key={v.id} className="up-s p-3.5">
                      <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                        {v.kind} · {dateTime(v.created_at)}
                      </div>
                      {v.note && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{v.note}</p>
                      )}
                      {v.evidence_url && (
                        <p className="mono mt-1.5 truncate text-[10.5px] text-mute">
                          {v.evidence_url}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          {/* ---- what the outside world says -------------------------------- */}
          <div className="flex flex-col gap-5">
            <Panel
              title="What the outside world says"
              lede="Three independent checks. The model answers with passage numbers, never URLs, so it cannot invent a source."
            >
              <Corroboration
                external={external}
                onRun={runCorroboration}
                running={running}
              />
            </Panel>

            <Panel
              title="Where this sits on the ladder"
              lede="Confirming moves it up one rung. Only a person can reach field verified."
            >
              <ConfidenceLadder current={challenge.confidence} rungs={CONFIDENCE_RUNGS} />
            </Panel>

            {challenge.ai_uncertainties?.length > 0 && (
              <Panel
                title="What the compiler was unsure about"
                lede="Written by the model about its own output. Worth checking first."
                depth="in"
              >
                <ul className="flex flex-col gap-2">
                  {challenge.ai_uncertainties.map((u, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex-none text-high-ink">
                        <Icon name="alert" size={13} />
                      </span>
                      <p className="text-[13px] leading-relaxed text-body">{u}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="Why it is ranked where it is">
              <ScoreFactors
                breakdown={challenge.score_breakdown}
                whyCritical={challenge.why_critical}
                compact
              />
            </Panel>
          </div>
        </div>

        {/* ---- the decision ------------------------------------------------- */}
        {!done && (
          <Panel
            title="Your decision"
            lede="Confirm needs a source and a note. Reject needs a reason the reporter can read."
          >
            {actionError && (
              <div className="in-s mb-4 flex items-start gap-2.5 p-3.5" role="alert">
                <span className="mt-px text-alert-ink">
                  <Icon name="alert" size={15} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">{actionError}</p>
              </div>
            )}

            {mode === "none" && (
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" icon="check" onClick={() => setMode("confirm")}>
                  Confirm this problem
                </Button>
                <Button variant="danger" icon="x" onClick={() => setMode("reject")}>
                  It does not stand
                </Button>
              </div>
            )}

            {mode === "confirm" && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Sources — one per line
                  </span>
                  <textarea
                    className="field"
                    rows={3}
                    value={sources}
                    onChange={(e) => setSources(e.target.value)}
                    placeholder={"Block office register entry 14/09\nhttps://…"}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Photo references — optional, one per line
                  </span>
                  <textarea
                    className="field min-h-[72px]"
                    rows={2}
                    value={photos}
                    onChange={(e) => setPhotos(e.target.value)}
                    placeholder="field/gumla/2026-09-14-culvert.jpg"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    What you found
                  </span>
                  <textarea
                    className="field"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Visited on 14 September. Two damaged fields, no shelter within 2 km. Spoke to the panchayat secretary."
                  />
                </label>

                <Caveat icon="shield">
                  This is signed with your account and cannot be edited afterwards. A college will
                  build against what you write here.
                </Caveat>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    icon="check"
                    busy={busy}
                    disabled={!note.trim() || sources.trim().length === 0}
                    onClick={confirm}
                  >
                    Record the verification
                  </Button>
                  <Button variant="secondary" onClick={() => setMode("none")}>
                    Back
                  </Button>
                </div>
                {(!note.trim() || !sources.trim()) && (
                  <p className="text-[12.5px] leading-relaxed text-mute">
                    A source and a note are both required — an unsourced confirmation is
                    indistinguishable from a guess to everyone downstream.
                  </p>
                )}
              </div>
            )}

            {mode === "reject" && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Why it does not stand
                  </span>
                  <textarea
                    className="field"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="The culvert named here was rebuilt in June; the photographs are of a different site 8 km away."
                  />
                </label>

                <Caveat icon="info">
                  The report is not deleted. It stays on file with this reason attached, which is
                  what stops the same claim being re-filed and re-rejected in a loop.
                </Caveat>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="danger"
                    icon="x"
                    busy={busy}
                    disabled={reason.trim().length < 10}
                    onClick={reject}
                  >
                    Record the rejection
                  </Button>
                  <Button variant="secondary" onClick={() => setMode("none")}>
                    Back
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        )}
      </Main>
    </>
  );
}
