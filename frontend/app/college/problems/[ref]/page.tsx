"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { BackLink, Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BandChip, Chip, ConfidenceChip, Tag } from "@/components/ui/Chip";
import { Caveat, ErrorNote, Skeleton } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { WindowState } from "@/components/domain/Competition";
import { ScoreFactors } from "@/components/domain/ScoreFactors";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { countdown, dateTime, humanise, num } from "@/lib/format";

/**
 * Read the brief, then submit against it.
 *
 * The document is taken as TEXT, not as a PDF, and the page says why rather
 * than hiding it: there is no storage bucket yet, and the scorer reads text in
 * either case. A college can paste or extract today instead of waiting on
 * infrastructure — and when the bucket lands, the field becomes an upload with
 * no change to what gets scored.
 */
export default function ProposeePage() {
  return (
    <RouteGuard>
      <Propose />
    </RouteGuard>
  );
}

const MIN_TEXT = 200;

function Propose() {
  const params = useParams<{ ref: string }>();
  const reference = params?.ref ?? "";
  const router = useRouter();

  const detailRes = useResource(() => apiClient.fetchChallenge(reference), [reference], {
    enabled: Boolean(reference),
  });
  const problemsRes = useResource(() => apiClient.fetchCollegeProblems(), []);

  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [pages, setPages] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    proposal_id: string;
    closes_at: string | null;
    window_days: number | null;
    leader_score: number | null;
    first: boolean;
  } | null>(null);

  const detail = detailRes.data;
  const c = detail?.challenge;

  const row = useMemo(
    () => problemsRes.data?.problems.find((p) => p.ref === reference) ?? null,
    [problemsRes.data, reference],
  );

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const enough = text.trim().length >= MIN_TEXT;

  async function submit() {
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.submitProposal({
        challenge_id: c.id,
        extracted_text: text.trim(),
        document_name: name.trim() || "proposal.pdf",
        document_pages: pages ? Number(pages) : 1,
      });
      setSubmitted({
        proposal_id: result.proposal_id,
        closes_at: result.window?.closes_at ?? null,
        window_days: result.window?.window_days ?? null,
        leader_score: result.window?.leader_score ?? null,
        first: Boolean(result.first_in_window),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The proposal was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  if (detailRes.loading && !detailRes.settled) {
    return (
      <>
        <BackLink href="/college/problems" label="Problems" />
        <Main className="pt-6">
          <Skeleton height={110} rounded={18} />
          <Skeleton height={300} rounded={18} />
        </Main>
      </>
    );
  }

  if (detailRes.error || !c) {
    return (
      <>
        <BackLink href="/college/problems" label="Problems" />
        <Main className="pt-6">
          <ErrorNote
            message={detailRes.error ?? `No problem is filed under ${reference}.`}
            code={detailRes.code}
            onRetry={detailRes.reload}
          />
        </Main>
      </>
    );
  }

  if (submitted) {
    const cd = countdown(submitted.closes_at);
    return (
      <>
        <BackLink href="/college/problems" label="Problems" trail={c.ref} />
        <PageHead
          eyebrow={`${c.ref} · submitted`}
          title={submitted.first ? "You opened the window" : "You are in the window"}
          lede={
            submitted.first
              ? "Yours is the first proposal for this problem, which starts the clock rather than winning it. Any college can now submit until the window closes, and the highest score takes the work."
              : "Your document is in. Scoring runs as a separate job, so the score appears on your proposals page shortly rather than making you wait here."
          }
        />
        <Main className="max-w-[720px]">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Window closes"
              value={cd.closed ? "closed" : cd.text}
              sub={submitted.closes_at ? dateTime(submitted.closes_at) : "not recorded"}
              tone={cd.urgent ? "alert" : undefined}
            />
            <Stat
              label="Window length"
              value={submitted.window_days ? `${submitted.window_days} days` : "—"}
              sub={`Set by the ${humanise(c.band ?? "")} band`}
            />
            <Stat
              label="Score to beat"
              value={submitted.leader_score !== null ? `${submitted.leader_score}` : "none yet"}
              sub={
                submitted.leader_score !== null
                  ? "The leading score, not the leading document"
                  : "Nothing scored above the floor yet"
              }
            />
          </div>

          <Panel title="What happens next">
            <ol className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-body">
              <li>
                <strong className="text-ink">1. Scoring.</strong> A reviewer model reads the
                document against the seven published criteria and writes a reason for each. You
                see every line of it, not just the total.
              </li>
              <li>
                <strong className="text-ink">2. The leader.</strong> If your score is the highest
                viable one, you lead. Ties break by who submitted first, and then by row id — so
                the outcome is deterministic rather than whoever the job happened to read last.
              </li>
              <li>
                <strong className="text-ink">3. The close.</strong> When the window ends the
                leader is awarded, an execution plan is generated from the document, and the
                itemised needs go to the funding board.
              </li>
              <li>
                <strong className="text-ink">If you are displaced</strong> you are told, with
                your score and the score that passed you, and you may submit a new version while
                the window is still open.
              </li>
            </ol>
          </Panel>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              iconAfter="arrow"
              onClick={() => router.push("/college/proposals")}
            >
              See my proposals
            </Button>
            <ButtonLink href="/college/problems" variant="secondary" icon="list">
              Back to problems
            </ButtonLink>
          </div>

          <p className="mono text-center text-[10px] uppercase tracking-[0.1em] text-mute">
            proposal {submitted.proposal_id.slice(0, 8)}
          </p>
        </Main>
      </>
    );
  }

  const closed = row?.competition?.state && row.competition.state !== "not_opened" && row.competition.state !== "open";

  return (
    <>
      <BackLink href="/college/problems" label="Problems" trail={c.ref} />

      <PageHead
        eyebrow={`${c.ref} · ${[c.block, c.district].filter(Boolean).join(", ")}`}
        title={c.title}
        lede={c.brief?.problem ?? c.why_critical}
        right={
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <BandChip band={c.band} />
              <ConfidenceChip confidence={c.confidence} />
            </div>
            <ButtonLink href={`/challenge/${c.ref}`} variant="secondary" size="sm" icon="eye">
              Everything known about it
            </ButtonLink>
          </div>
        }
      />

      <Main>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="flex flex-col gap-5">
            <Panel
              title="Your proposal"
              lede="Paste the document text. It is what the reviewer reads."
            >
              {closed && (
                <Card depth="in" className="mb-4 flex items-start gap-3 p-4">
                  <span className="mt-px text-alert-ink">
                    <Icon name="alert" size={16} />
                  </span>
                  <p className="text-[13px] leading-relaxed text-body">
                    This window has already {humanise(String(row?.competition?.state))}. A
                    submission now will be refused by the server — the box is left open so you can
                    see what was asked for, not to waste your time.
                  </p>
                </Card>
              )}

              <div className="flex flex-col gap-4">
                <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <label className="flex flex-col gap-2">
                    <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                      Document name
                    </span>
                    <input
                      className="field"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="gumla-siren-shelters.pdf"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                      Pages
                    </span>
                    <input
                      className="field"
                      type="number"
                      min={1}
                      max={500}
                      value={pages}
                      onChange={(e) => setPages(e.target.value)}
                      placeholder="12"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                    The document
                  </span>
                  <textarea
                    className="field min-h-[320px]"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      "Problem addressed…\nApproach…\nBill of materials with quantities…\nCosting…\nTimeline…\nWho maintains it after handover…"
                    }
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
                    {num(words)} words · {num(text.trim().length)} characters
                  </span>
                  <span
                    className={`mono text-[10.5px] uppercase tracking-[0.1em] ${
                      enough ? "text-teal-ink" : "text-alert-ink"
                    }`}
                  >
                    {enough ? "long enough to score" : `at least ${MIN_TEXT} characters`}
                  </span>
                </div>

                <Caveat icon="file">
                  Text, not a PDF upload — there is no file bucket on this deployment yet, and the
                  reviewer reads text either way. Nothing about the scoring changes when the upload
                  arrives.
                </Caveat>

                {error && (
                  <div className="in-s flex items-start gap-2.5 p-3.5" role="alert">
                    <span className="mt-px text-alert-ink">
                      <Icon name="alert" size={15} />
                    </span>
                    <p className="text-[13px] leading-relaxed text-body">{error}</p>
                  </div>
                )}

                <Button
                  variant="primary"
                  busy={busy}
                  disabled={!enough}
                  icon="upload"
                  onClick={submit}
                >
                  Submit this proposal
                </Button>
              </div>
            </Panel>

            <Panel
              title="What you are solving"
              lede="Scored against this brief specifically — a strong solution to a different problem scores zero on problem fit."
            >
              <p className="text-[14.5px] leading-relaxed text-ink">
                {c.brief?.problem ?? c.why_critical}
              </p>

              {c.brief?.outcome && (
                <div className="in mt-4 p-4">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                    What success looks like
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{c.brief.outcome}</p>
                  {c.brief.success_metric && (
                    <p className="mt-2.5 text-[12.5px] leading-relaxed text-body">
                      <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-mute">
                        measured by{" "}
                      </span>
                      {c.brief.success_metric}
                    </p>
                  )}
                </div>
              )}

              {c.brief?.needs && c.brief.needs.length > 0 && (
                <div className="mt-4">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                    What the district says it needs
                  </div>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {c.brief.needs.map((n, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex-none text-navy">
                          <Icon name="check" size={13} />
                        </span>
                        <span className="text-[13.5px] leading-relaxed text-body">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {c.brief?.translated_text && (
                <Well className="mt-4">
                  <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-mute">
                    what a reporter actually said
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
                    {c.brief.translated_text}
                  </p>
                </Well>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.capabilities?.map((x) => (
                  <Tag key={x}>{humanise(x)}</Tag>
                ))}
                {c.hazard_tags?.map((x) => (
                  <Tag key={x}>{humanise(x)}</Tag>
                ))}
              </div>
            </Panel>
          </div>

          <aside className="flex flex-col gap-5">
            <Panel title="The window">
              <WindowState
                competition={row?.competition}
                myScore={row?.my_proposal?.score ?? null}
              />
              {row?.my_proposal && (
                <div className="up-s mt-3 p-4">
                  <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                    your current submission
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="text-[13.5px] font-semibold text-ink">
                      v{row.my_proposal.version} · {humanise(row.my_proposal.state)}
                    </span>
                    {row.my_proposal.score !== null && (
                      <span className="mono text-[16px] font-semibold text-ink">
                        {row.my_proposal.score}/100
                      </span>
                    )}
                  </div>
                  {row.my_proposal.is_leading === false && (
                    <p className="mt-2 text-[12.5px] leading-relaxed text-body">
                      Another proposal is ahead. Submitting a new version replaces yours in the
                      comparison; the earlier one stays on the record.
                    </p>
                  )}
                  <div className="mt-3">
                    <ButtonLink
                      href={`/college/proposals/${row.my_proposal.id}`}
                      variant="secondary"
                      size="sm"
                      iconAfter="arrow"
                    >
                      Read the verdict
                    </ButtonLink>
                  </div>
                </div>
              )}
            </Panel>

            <Panel
              title="Why it is ranked here"
              lede="The district's own scoring, opened."
            >
              <ScoreFactors
                breakdown={c.score_breakdown}
                whyCritical={c.why_critical}
                compact
              />
            </Panel>

            <Panel title="Who else is on it" depth="in">
              {detail?.assignments && detail.assignments.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {detail.assignments.map((a) => (
                    <li key={`${a.org_id}-${a.role}`} className="up-s p-3">
                      <div className="text-[13px] font-semibold text-ink">
                        {a.organizations?.name ?? a.org_id}
                      </div>
                      <div className="mono mt-1 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                        {humanise(a.role)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] leading-relaxed text-body">
                  Nobody is assigned yet. Assignment happens when a window is awarded, not when a
                  proposal is submitted.
                </p>
              )}
            </Panel>

            {c.ai_uncertainties?.length > 0 && (
              <Panel
                title="What the brief is unsure about"
                lede="Worth addressing explicitly — a proposal that resolves an uncertainty scores well on problem fit."
                depth="in"
              >
                <ul className="flex flex-col gap-2">
                  {c.ai_uncertainties.map((u, i) => (
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

            <Card depth="in" className="p-4">
              <div className="flex items-center gap-2">
                <Chip tone="neutral">Rubric v1</Chip>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-body">
                Problem fit 25 · Technical soundness 20 · Practicality in context 15 · Cost
                credibility 15 · Timeline credibility 10 · Requirements completeness 10 ·
                Maintenance and handover 5. Below 40 is refused outright.
              </p>
            </Card>
          </aside>
        </div>
      </Main>
    </>
  );
}
