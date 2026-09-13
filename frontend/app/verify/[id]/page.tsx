"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { BackLink, Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { BandChip, Chip, ConfidenceChip, StatusChip, Tag } from "@/components/ui/Chip";
import { Caveat, Empty, ErrorNote, Skeleton, SkeletonRows } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { Corroboration, ConfidenceLadder } from "@/components/domain/Corroboration";
import { ScoreFactors } from "@/components/domain/ScoreFactors";
import * as apiClient from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/useResource";
import {
  CHANNEL_LABEL,
  CONFIDENCE_RUNGS,
  bandOf,
  dateTime,
  num,
  relative,
} from "@/lib/format";
import type { CorroborationOutcome, Verification } from "@/types/database";

/**
 * Verify one report.
 *
 * Everything a verifier needs is on one screen, side by side, because the
 * decision is a comparison: what the people there said, against what the
 * outside world can confirm. A confirmation carries sources - links or
 * references like a register entry - and field photos, uploaded here with
 * their location metadata stripped.
 */
export default function VerifyOnePage() {
  return (
    <RouteGuard>
      <VerifyReview />
    </RouteGuard>
  );
}

const METHOD_LABEL: Record<string, string> = {
  ai_external: "AI, from independent sources",
  field: "Verifier",
  coordinator: "Coordinator",
  community: "Community signal",
};

function VerifyReview() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const { role } = useAuth();

  const res = useResource(() => apiClient.fetchChallenge(id), [id], { enabled: Boolean(id) });

  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<CorroborationOutcome | null>(null);
  const [mode, setMode] = useState<"none" | "confirm" | "reject">("none");
  const [sources, setSources] = useState("");
  const [photos, setPhotos] = useState<{ path: string; url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [granted, setGranted] = useState<"field_verified" | "coordinator_approved">("field_verified");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<"confirmed" | "rejected" | null>(null);

  const detail = res.data;
  const challenge = detail?.challenge;
  const reports = detail?.cluster?.reports ?? [];

  const awaiting = challenge ? ["REPORTED", "REFINED"].includes(challenge.status) : false;
  const rejected = challenge?.status === "CLOSED_NOT_ACTIONABLE";
  const inDelivery = challenge
    ? ["SOLUTION_PROPOSED", "PILOT", "DEPLOYED", "IMPACT_VERIFIED"].includes(challenge.status)
    : false;
  const aiVerification = detail?.verifications.find((v) => v.method === "ai_external") ?? null;
  const sourceList = sources
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const canConfirm = note.trim().length >= 10 && (sourceList.length > 0 || photos.length > 0);

  async function runCorroboration() {
    setRunning(true);
    setActionError(null);
    try {
      setOutcome(await apiClient.runCorroboration(id));
      res.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "The check could not run.");
    } finally {
      setRunning(false);
    }
  }

  async function addPhotos(input: HTMLInputElement | null) {
    const files = input?.files;
    if (!files?.length || !challenge) return;
    setUploading(true);
    setActionError(null);
    try {
      for (const file of Array.from(files).slice(0, 10 - photos.length)) {
        const stored = await apiClient.uploadPhoto(file, "verification", challenge.id);
        setPhotos((prev) => [...prev, { path: stored.path, url: stored.url, name: file.name }]);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That photo could not be uploaded.");
    } finally {
      if (input) input.value = "";
      setUploading(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setActionError(null);
    try {
      await apiClient.confirmVerification(id, {
        source_urls: sourceList,
        photo_paths: photos.map((p) => p.path),
        note: note.trim(),
        granted,
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
            <div className="flex flex-wrap items-center gap-2">
              <BandChip band={challenge.band ?? bandOf(challenge.priority)} />
              <ConfidenceChip confidence={challenge.confidence} />
              <StatusChip status={challenge.status} />
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
                  ? "This problem is verified and open to colleges. Your name, sources and photos are on the record against it, and the reporters have been told."
                  : "The report stays on file with your reason attached, and the reporters have been sent it."}
              </p>
              <div className="mt-4">
                <Button variant="primary" iconAfter="arrow" onClick={() => router.push("/verify")}>
                  Next in the queue
                </Button>
              </div>
            </div>
          </Card>
        )}

        {!done && aiVerification && !inDelivery && !rejected && (
          <Card depth="in" className="flex items-start gap-3 p-5">
            <span className="mt-px text-teal-ink">
              <Icon name="spark" size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-navy-dark">
                Already verified by the AI {relative(aiVerification.created_at)}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-body">
                It found independent proof and opened this problem to colleges. The sources are
                listed under &ldquo;Already on the record&rdquo;. If they do not actually confirm
                it, reject it below — that closes it before any college builds against it.
              </p>
            </div>
          </Card>
        )}

        {!done && inDelivery && (
          <Card depth="in" className="flex items-start gap-3 p-5">
            <span className="mt-px text-mute">
              <Icon name="info" size={18} />
            </span>
            <p className="text-[13px] leading-relaxed text-body">
              A college has already been awarded this problem, so it is past verification. Its
              progress is on the problem page.
            </p>
          </Card>
        )}

        {outcome && (
          <Card depth="in" className="flex items-start gap-3 p-5">
            <span className={`mt-px ${outcome.auto_verified ? "text-teal-ink" : "text-mute"}`}>
              <Icon name={outcome.auto_verified ? "check" : "cloud"} size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-navy-dark">
                {outcome.auto_verified
                  ? "Proof found — verified by the AI"
                  : outcome.verdict === "supports"
                    ? "Some support, not enough to verify on its own"
                    : outcome.verdict === "contradicts"
                      ? "An outside source contradicts the report"
                      : "No independent proof found"}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-body">{outcome.reasoning}</p>
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
                        {r.urgency ? (
                          <>
                            <span>·</span>
                            <span>urgency {r.urgency}/5</span>
                          </>
                        ) : null}
                      </div>

                      <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">
                        {r.original_text ?? "The reporter did not consent to their words being shown."}
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
                            {r.photo_urls.length} photo{r.photo_urls.length === 1 ? "" : "s"}
                          </Tag>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {detail && detail.verifications.length > 0 && (
              <Panel title="Already on the record" lede="Every verification and flag, newest first." depth="in">
                <ul className="flex flex-col gap-2.5">
                  {detail.verifications.map((v) => (
                    <VerificationItem key={v.id} v={v} />
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          {/* ---- what the outside world says -------------------------------- */}
          <div className="flex flex-col gap-5">
            <Panel
              title="What the outside world says"
              lede="Weather at that place and time, the news and the open web. The model answers with passage numbers, never URLs, so it cannot invent a source."
            >
              <Corroboration external={detail?.external} onRun={runCorroboration} running={running} />
            </Panel>

            <Panel
              title="Where this sits on the ladder"
              lede="Proof from the AI or a person's confirmation both open it to colleges."
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
        {!done && !inDelivery && (
          <Panel
            title="Your decision"
            lede={
              awaiting || rejected
                ? "Confirm needs a note and at least one source or photo. Reject needs a reason the reporter can read."
                : "This is already verified. You can still reject it if the evidence does not stand."
            }
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
                {(awaiting || rejected) && (
                  <Button variant="primary" icon="check" onClick={() => setMode("confirm")}>
                    {rejected ? "It does stand — confirm it" : "Confirm this problem"}
                  </Button>
                )}
                {!rejected && (
                  <Button variant="danger" icon="x" onClick={() => setMode("reject")}>
                    It does not stand
                  </Button>
                )}
              </div>
            )}

            {mode === "confirm" && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Sources — links or references, one per line
                  </span>
                  <textarea
                    className="field"
                    rows={3}
                    value={sources}
                    onChange={(e) => setSources(e.target.value)}
                    placeholder={"https://example-news-site/gumla-lightning\nBlock office register entry 14/09"}
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Field photos
                  </span>
                  <label className="btn-2 btn-sm w-fit cursor-pointer">
                    <Icon name="camera" size={14} />
                    {uploading ? "Uploading…" : "Add photos"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      multiple
                      className="sr-only"
                      disabled={uploading || photos.length >= 10}
                      onChange={(e) => {
                        void addPhotos(e.target);
                      }}
                    />
                  </label>
                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-2.5">
                      {photos.map((p) => (
                        <div key={p.path} className="up-s relative w-[110px] p-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={p.name} className="h-[80px] w-full rounded-lg object-cover" />
                          <button
                            type="button"
                            className="mono mt-1 w-full truncate text-left text-[9.5px] text-alert-ink"
                            onClick={() => setPhotos((prev) => prev.filter((x) => x.path !== p.path))}
                          >
                            remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[12px] leading-relaxed text-mute">
                    Location data is stripped from photos before they are stored.
                  </p>
                </div>

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

                {(role === "coordinator" || role === "admin") && (
                  <label className="flex flex-col gap-2">
                    <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                      Record as
                    </span>
                    <select
                      className="field max-w-[280px]"
                      value={granted}
                      onChange={(e) => setGranted(e.target.value as typeof granted)}
                    >
                      <option value="field_verified">Field verified</option>
                      <option value="coordinator_approved">Coordinator approved</option>
                    </select>
                  </label>
                )}

                <Caveat icon="shield">
                  This is signed with your account and cannot be edited afterwards. A college will
                  build against what you write here.
                </Caveat>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    icon="check"
                    busy={busy}
                    disabled={!canConfirm || uploading}
                    onClick={confirm}
                  >
                    Record the verification
                  </Button>
                  <Button variant="secondary" onClick={() => setMode("none")}>
                    Back
                  </Button>
                </div>
                {!canConfirm && (
                  <p className="text-[12.5px] leading-relaxed text-mute">
                    A note of at least a sentence and at least one source or photo are required — an
                    unsourced confirmation is indistinguishable from a guess to everyone downstream.
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
                  The report is not deleted. It stays on file with this reason attached, and the
                  reporters are sent it.
                </Caveat>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="danger"
                    icon="x"
                    busy={busy}
                    disabled={reason.trim().length < 15}
                    onClick={reject}
                  >
                    Record the rejection
                  </Button>
                  <Button variant="secondary" onClick={() => setMode("none")}>
                    Back
                  </Button>
                </div>
                {reason.trim().length < 15 && (
                  <p className="text-[12.5px] leading-relaxed text-mute">
                    Give a reason of at least a sentence; the reporter reads it.
                  </p>
                )}
              </div>
            )}
          </Panel>
        )}
      </Main>
    </>
  );
}

function VerificationItem({ v }: { v: Verification }) {
  const sources = v.source_urls ?? [];
  return (
    <li className="up-s p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={v.kind === "inaccurate" ? "alert" : v.method === "ai_external" ? "moderate" : "teal"}>
          {v.kind === "inaccurate" ? "Rejected / flagged" : (METHOD_LABEL[v.method ?? ""] ?? v.kind)}
        </Chip>
        <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">{dateTime(v.created_at)}</span>
      </div>
      {(v.rejected_reason || v.note) && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink">{v.rejected_reason ?? v.note}</p>
      )}
      {sources.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {sources.map((s, i) =>
            /^https?:\/\//i.test(s) ? (
              <li key={i}>
                <a
                  href={s}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mono break-all text-[11px] text-navy hover:underline"
                >
                  {s}
                </a>
              </li>
            ) : (
              <li key={i} className="mono text-[11px] text-body">
                {s}
              </li>
            ),
          )}
        </ul>
      )}
      {(v.photos?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {v.photos!.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Field photo" className="h-[64px] w-[88px] rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}
      {!v.photos?.length && (v.photo_count ?? 0) > 0 && (
        <p className="mono mt-2 text-[10.5px] text-mute">{v.photo_count} field photo(s) on file</p>
      )}
    </li>
  );
}
