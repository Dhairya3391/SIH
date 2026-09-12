"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Chrome } from "@/components/shell/Chrome";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Well } from "@/components/ui/Surface";
import { Button, ButtonLink, Toggle } from "@/components/ui/Button";
import { BandChip, Chip } from "@/components/ui/Chip";
import { Caveat } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { VoiceRecorder } from "@/components/domain/VoiceRecorder";
import { TraceSteps } from "@/components/domain/TraceSteps";
import * as apiClient from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DISTRICTS, VULNERABLE_GROUPS } from "@/lib/districts";
import { rememberLocalReport } from "@/lib/localReports";
import { bandOf, num } from "@/lib/format";
import type { IntakeResult } from "@/types/database";

/**
 * The citizen intake.
 *
 * Signed out is the normal case here. Someone reporting a collapsed culvert
 * must not meet a login wall, so this page is public; the only thing an
 * account adds is that the report shows up in "My reports" on any device.
 *
 * Two screens in one: the form, then what the AI made of it. The second is not
 * a receipt — it shows the compiled title, the band, the model's own
 * uncertainties and the step-by-step trace, because a person who has just
 * described a death in their village is owed a plain account of what the
 * machine did with their words.
 */
export default function ReportPage() {
  const { user, isAuthenticated } = useAuth();

  const [text, setText] = useState("");
  // null means "the citizen has not chosen", so the account's own district can
  // fill in without an effect that races the first render.
  const [districtChoice, setDistrictChoice] = useState<string | null>(null);
  const [village, setVillage] = useState("");
  const [people, setPeople] = useState("");
  const [urgency, setUrgency] = useState(3);
  const [vulnerable, setVulnerable] = useState<string[]>([]);
  const [audio, setAudio] = useState<Blob | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code: string | null } | null>(null);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [online, setOnline] = useState(true);

  const district = districtChoice ?? user?.district ?? "";

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    // The first read is deferred to a task: navigator is a browser API, and
    // reading it synchronously inside the effect would both set state in the
    // effect body and differ from what the server rendered.
    const first = setTimeout(sync, 0);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      clearTimeout(first);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const canSubmit = useMemo(
    () => (text.trim().length >= 12 || audio !== null) && !busy,
    [text, audio, busy],
  );

  function toggleVulnerable(key: string) {
    setVulnerable((v) => (v.includes(key) ? v.filter((k) => k !== key) : [...v, key]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const intake = await apiClient.submitReport({
        text: text.trim(),
        district: district || undefined,
        village: village.trim() || undefined,
        people_est: people ? Number(people) : undefined,
        urgency,
        vulnerable: vulnerable.length ? vulnerable : undefined,
        audio,
      });
      setResult(intake);
      rememberLocalReport({
        report_id: intake.report_id,
        challenge_ref: intake.challenge_ref,
        challenge_id: intake.challenge_id,
        text: (text.trim() || "Voice report").slice(0, 240),
        district: district || null,
        village: village.trim() || null,
        decision: intake.decision,
        priority: intake.priority ?? null,
        filed_at: new Date().toISOString(),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "The report could not be sent.",
        code: err instanceof ApiError ? err.code : null,
      });
    } finally {
      setBusy(false);
    }
  }

  function fileAnother(keepPlace: boolean) {
    setResult(null);
    setText("");
    setAudio(null);
    setPeople("");
    setVulnerable([]);
    if (!keepPlace) {
      setVillage("");
      setDistrictChoice(null);
    }
  }

  return (
    <>
      <Chrome />

      {result ? (
        <Compiled
          result={result}
          onAnother={fileAnother}
          signedIn={isAuthenticated}
        />
      ) : (
        <>
          <PageHead
            eyebrow="Report a problem"
            title="Tell us what you can see"
            lede="Your words, in your language. You do not need an account, and you do not need to know what to call the problem — that part is ours."
          />

          <Main className="max-w-[560px]">
            {!online && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-alert-ink">
                  <Icon name="signal" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  <strong className="text-ink">You are offline.</strong> Write the report now — when
                  you press send it will fail, and you can press it again once there is signal.
                  Nothing you have typed is lost in the meantime.
                </p>
              </Card>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <VoiceRecorder onChange={(blob) => setAudio(blob)} disabled={busy} />

              <div className="up p-5">
                <label className="flex flex-col gap-2">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Or write it
                  </span>
                  <textarea
                    className="field"
                    rows={5}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="बिजली गिरने से खेत में काम करने वाले लोग मर रहे हैं। कोई आसरा नहीं है…"
                    aria-describedby="text-help"
                  />
                </label>
                <p id="text-help" className="mt-2.5 text-[12px] leading-relaxed text-body">
                  Hindi, Santali, Khortha, Nagpuri or English. Say what happened, where, and who it
                  is affecting. {text.trim().length > 0 && text.trim().length < 12 && (
                    <span className="text-alert-ink">A few more words, please.</span>
                  )}
                </p>
              </div>

              <div className="up p-5">
                <h2 className="text-[15px] font-bold text-navy-dark">Where is it</h2>
                <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                      District
                    </span>
                    <select
                      className="field"
                      value={district}
                      onChange={(e) => setDistrictChoice(e.target.value)}
                    >
                      <option value="">Not sure</option>
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                      Village or block
                    </span>
                    <input
                      className="field"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="Sisai"
                    />
                  </label>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-body">
                  Leave these blank if you are not sure. A report with no place still counts — a
                  verifier will place it.
                </p>
              </div>

              <div className="up p-5">
                <h2 className="text-[15px] font-bold text-navy-dark">Who it affects</h2>

                <label className="mt-4 flex flex-col gap-2">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Roughly how many people
                  </span>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={people}
                    onChange={(e) => setPeople(e.target.value)}
                    placeholder="Your best guess"
                  />
                </label>

                <div className="mt-4">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    Anyone in particular
                  </span>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {VULNERABLE_GROUPS.map((g) => (
                      <Toggle
                        key={g.key}
                        active={vulnerable.includes(g.key)}
                        onClick={() => toggleVulnerable(g.key)}
                      >
                        {vulnerable.includes(g.key) && <Icon name="check" size={13} />}
                        {g.label}
                      </Toggle>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between">
                    <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                      How urgent
                    </span>
                    <span className="mono text-[11px] font-semibold text-navy">
                      {["", "Can wait", "This month", "This week", "Today", "Right now"][urgency]}
                    </span>
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setUrgency(n)}
                        aria-label={`Urgency ${n} of 5`}
                        aria-pressed={urgency === n}
                        className={`mono h-11 flex-1 text-[14px] font-semibold ${
                          urgency === n ? "press text-navy" : "up-s up-hit text-mute"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <IntakeRefusal message={error.message} code={error.code} />
              )}

              <Button type="submit" variant="primary" busy={busy} disabled={!canSubmit}>
                {busy ? "Sending" : "Send this report"}
              </Button>

              <Caveat icon="shield">
                Your name and number are not published. A verifier sees the report; the public map
                sees only the problem and the block it is in.
              </Caveat>

              {!isAuthenticated && (
                <p className="text-center text-[12.5px] leading-relaxed text-mute">
                  Filing without an account keeps this report on this device only.{" "}
                  <Link href="/login" className="font-semibold text-navy">
                    Sign in
                  </Link>{" "}
                  to see it from anywhere.
                </p>
              )}
            </form>
          </Main>
        </>
      )}
    </>
  );
}

/**
 * The submission was refused. The three refusals that matter to a citizen get
 * a human sentence; anything else shows the service's own message.
 */
function IntakeRefusal({ message, code }: { message: string; code: string | null }) {
  const known: Record<string, { title: string; body: string }> = {
    no_speech_detected: {
      title: "We could not hear any speech",
      body: "The recording came through silent or too quiet, so nothing was filed. Rather than guess at words, we have thrown the audio away. Try again somewhere quieter, or type the report instead.",
    },
    stt_unavailable: {
      title: "Voice notes are not working right now",
      body: "The transcription service is unreachable, so we cannot read the recording. Nothing was filed. Please type the report — it goes to exactly the same place.",
    },
    transcription_failed: {
      title: "The recording could not be read",
      body: "Transcription failed on this file. Nothing was filed. Record it again, or type it instead.",
    },
    offline: {
      title: "No connection",
      body: "The report has not been sent. Nothing you typed is lost — press send again when there is signal.",
    },
  };

  const hit = code ? known[code] : undefined;

  return (
    <div className="in p-5" role="alert">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-alert-ink">
          <Icon name="alert" size={18} />
        </span>
        <div>
          <h3 className="text-[14.5px] font-bold text-alert-ink">
            {hit?.title ?? "The report was not sent"}
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-body">{hit?.body ?? message}</p>
          {hit && (
            <p className="mono mt-2 text-[10.5px] uppercase tracking-[0.1em] text-mute">
              {code}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** What the AI made of it. */
function Compiled({
  result,
  onAnother,
  signedIn,
}: {
  result: IntakeResult;
  onAnother: (keepPlace: boolean) => void;
  signedIn: boolean;
}) {
  const band = bandOf(result.priority);
  const merged = result.decision === "merge" || result.decision === "merged";
  const review = result.decision === "review";

  return (
    <>
      <PageHead
        eyebrow={result.already_received ? "Already received" : "Filed"}
        title={
          merged
            ? "Others had reported this too"
            : review
              ? "This may be the same as something we have"
              : "This is now on the district list"
        }
        lede={
          merged
            ? "Your report joined an existing problem rather than starting a new one. That makes the case stronger, not smaller — the number of separate people reporting it is part of how it is ranked."
            : review
              ? "It looked close to an existing problem, so a person will decide whether to merge them. Nothing is lost either way."
              : "A new problem was opened from what you sent. Here is exactly what was done with your words."
        }
      />

      <Main className="max-w-[560px]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                Reference
              </div>
              <div className="mono mt-1 text-[26px] font-semibold leading-none text-navy-dark">
                {result.challenge_ref}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <BandChip band={band} />
              {result.degraded && (
                <Chip tone="alert" title="No model was available; a rule wrote the brief">
                  No AI
                </Chip>
              )}
            </div>
          </div>

          <div className="in mt-4 p-4">
            <p className="text-[12.5px] leading-relaxed text-body">
              Write this reference down. It is how you follow the problem even from a different
              phone, and how a block officer finds it if you ask in person.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <ButtonLink
              href={`/challenge/${result.challenge_ref}`}
              variant="primary"
              iconAfter="arrow"
            >
              Follow {result.challenge_ref}
            </ButtonLink>
            <ButtonLink href="/my-reports" variant="secondary" icon="list">
              My reports
            </ButtonLink>
          </div>
        </Card>

        {!result.already_received && result.corroboration === "queued" && (
          <Card depth="in" className="flex items-start gap-3 p-4">
            <span className="mt-px text-navy">
              <Icon name="cloud" size={16} />
            </span>
            <p className="text-[13px] leading-relaxed text-body">
              <strong className="text-ink">Checking for independent proof now.</strong> This reads
              as a disaster-type report, so the weather at that place and time, the news and the
              open web are being searched. If they confirm it, it is verified straight away — with
              the sources recorded — and opened to colleges, usually within a minute. If they do
              not, a verifier checks it. Follow {result.challenge_ref} to see which.
            </p>
          </Card>
        )}
        {!result.already_received && result.corroboration === "not_disaster" && (
          <Card depth="in" className="flex items-start gap-3 p-4">
            <span className="mt-px text-navy">
              <Icon name="shield" size={16} />
            </span>
            <p className="text-[13px] leading-relaxed text-body">
              <strong className="text-ink">A verifier will check this.</strong> Weather records
              and news cannot confirm this kind of problem, so it has gone straight to a person on
              the verification desk. Once they confirm it, colleges can propose solutions.
            </p>
          </Card>
        )}

        <Panel
          title="How it was ranked"
          lede="A number, and the reason behind it. Nothing here is hidden from you."
        >
          {result.priority === null ? (
            <p className="text-[13px] leading-relaxed text-body">
              The score has not been computed yet. It appears on the problem page once the
              compiler has finished, usually within a minute.
            </p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <span className="mono text-[38px] font-semibold leading-none text-ink">
                    {result.priority}
                  </span>
                  <span className="mono ml-1 text-[15px] text-mute">/100</span>
                </div>
                <BandChip band={band} />
              </div>
              <Meter
                value={result.priority}
                colour={`var(--color-${band === "long_term" ? "long" : band})`}
                className="mt-3"
              />
              <p className="mt-3.5 text-[13px] leading-relaxed text-body">
                The score weighs severity, urgency, how many people are affected, who they are,
                whether the block sits in a mapped hazard zone, and whether anything has been
                pledged. Every one of those lines, with its own sentence, is on{" "}
                <Link
                  href={`/challenge/${result.challenge_ref}`}
                  className="font-semibold text-navy"
                >
                  the problem page
                </Link>
                .
              </p>
            </>
          )}
        </Panel>

        {result.dedup_reason && (
          <Panel title={merged ? "Why it was merged" : "Why a person will check"}>
            <Well small>
              <p className="text-[13.5px] leading-relaxed text-ink">{result.dedup_reason}</p>
            </Well>
            {result.possible_duplicates.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {result.possible_duplicates.map((d) => (
                  <Link
                    key={d.challenge_id}
                    href={`/challenge/${d.ref ?? d.challenge_id}`}
                    className="up-s up-hit flex items-center justify-between gap-3 p-3"
                  >
                    <span className="min-w-0">
                      <span className="mono text-[11px] text-mute">{d.ref}</span>
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {d.title}
                      </span>
                    </span>
                    <span className="text-mute">
                      <Icon name="chevRight" size={14} />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        )}

        <Panel
          title="What the machine did"
          lede="Each step, the model that answered it, and how long it took."
        >
          <TraceSteps
            trace={result.trace}
            totalMs={result.trace_total_ms}
            degraded={result.degraded}
          />
        </Panel>

        <Panel title="Something wrong with this?">
          <p className="text-[13.5px] leading-relaxed text-body">
            Send another report with the correction. Because it describes the same place and the
            same problem, it will merge into {result.challenge_ref} and the extra detail goes to
            the verifier along with the rest.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button variant="secondary" icon="plus" onClick={() => onAnother(true)}>
              Add more detail
            </Button>
            <Button variant="secondary" icon="mic" onClick={() => onAnother(false)}>
              Report something else
            </Button>
          </div>
        </Panel>

        {!signedIn && (
          <Card depth="in" className="p-4">
            <p className="text-[12.5px] leading-relaxed text-body">
              This report is remembered on this device only.{" "}
              <Link href="/login" className="font-semibold text-navy">
                Signing in
              </Link>{" "}
              links it to an account so you can see it anywhere. Either way,{" "}
              <span className="mono text-ink">{result.challenge_ref}</span> keeps working.
            </p>
          </Card>
        )}

        <p className="mono text-center text-[10.5px] uppercase tracking-[0.1em] text-mute">
          report {result.report_id.slice(0, 8)} · {num(result.trace?.length ?? 0)} pipeline steps
        </p>
      </Main>
    </>
  );
}
