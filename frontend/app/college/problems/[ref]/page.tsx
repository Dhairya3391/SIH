"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { BackLink, Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button, ButtonLink, Toggle } from "@/components/ui/Button";
import { BandChip, Chip, ConfidenceChip, Tag } from "@/components/ui/Chip";
import { Caveat, ErrorNote, Skeleton } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { WindowState } from "@/components/domain/Competition";
import { ScoreFactors } from "@/components/domain/ScoreFactors";
import * as apiClient from "@/lib/api";
import type { SubmittedProposal } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { countdown, dateTime, humanise, num } from "@/lib/format";

/**
 * Read the brief, then submit a proposal against it.
 *
 * A college uploads its proposal as a PDF. The server reads the text page by
 * page, keeps the file private, and the AI analyses it on the published rubric
 * straight after - a proposal it finds not viable comes back with the reasons.
 * Pasting the text is kept for a college that cannot produce a PDF.
 */
export default function ProposePage() {
  return (
    <RouteGuard>
      <Propose />
    </RouteGuard>
  );
}

const MIN_TEXT = 200;
const MAX_PDF_BYTES = 12 * 1024 * 1024;

function Propose() {
  const params = useParams<{ ref: string }>();
  const reference = params?.ref ?? "";
  const router = useRouter();

  const detailRes = useResource(() => apiClient.fetchChallenge(reference), [reference], {
    enabled: Boolean(reference),
  });
  const problemsRes = useResource(() => apiClient.fetchCollegeProblems(), []);

  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedProposal | null>(null);

  const detail = detailRes.data;
  const c = detail?.challenge;

  const row = useMemo(
    () => problemsRes.data?.problems.find((p) => p.ref === reference) ?? null,
    [problemsRes.data, reference],
  );

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const enoughText = text.trim().length >= MIN_TEXT;
  const fileProblem = file
    ? file.size > MAX_PDF_BYTES
      ? "That PDF is larger than 12 MB."
      : !/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)
        ? "That is not a PDF."
        : null
    : null;
  const ready = mode === "pdf" ? Boolean(file) && !fileProblem : enoughText;

  async function submit() {
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "pdf" && file
          ? await apiClient.submitProposalDocument(c.id, file)
          : await apiClient.submitProposal({
              challenge_id: c.id,
              extracted_text: text.trim(),
              document_name: name.trim() || "proposal.txt",
            });
      setSubmitted(result);
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
    const cd = countdown(submitted.window?.closes_at ?? null);
    return (
      <>
        <BackLink href="/college/problems" label="Problems" trail={c.ref} />
        <PageHead
          eyebrow={`${c.ref} · submitted`}
          title={submitted.first_in_window ? "You opened the window" : "You are in the window"}
          lede={
            submitted.first_in_window
              ? "Yours is the first proposal for this problem, which starts the clock rather than winning it. Any college can now submit until the window closes, and the highest viable score takes the work."
              : "Your document is in. The AI is analysing it against the published rubric now, and the verdict appears on your proposals page within a minute."
          }
        />
        <Main className="max-w-[720px]">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Window closes"
              value={cd.closed ? "closed" : cd.text}
              sub={submitted.window?.closes_at ? dateTime(submitted.window.closes_at) : "not recorded"}
              tone={cd.urgent ? "alert" : undefined}
            />
            <Stat
              label="Document"
              value={submitted.document_url ? `${num(submitted.document_pages)} p` : "text"}
              sub={submitted.document_url ? "PDF read page by page" : "Pasted text"}
            />
            <Stat
              label="Score to beat"
              value={submitted.window?.leader_score !== null && submitted.window?.leader_score !== undefined ? `${submitted.window.leader_score}` : "none yet"}
              sub="The leading score, not the leading document"
            />
          </div>

          <Panel title="What happens next">
            <ol className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-body">
              <li>
                <strong className="text-ink">1. Analysis.</strong> The reviewer reads the document
                against seven published criteria and writes a reason for each. Below 40 the
                proposal is rejected as not viable, with the changes it needs.
              </li>
              <li>
                <strong className="text-ink">2. The lead.</strong> If yours is the highest viable
                score, you lead. If you are overtaken you are told the score to beat, and can send a
                new version while the window is open.
              </li>
              <li>
                <strong className="text-ink">3. The award.</strong> When the window closes the
                leader wins, delivery stages are drawn from its document, and it publishes the
                funding and materials it needs for companies and NGOs.
              </li>
            </ol>
          </Panel>

          <div className="flex flex-wrap gap-3">
            <Button variant="primary" iconAfter="arrow" onClick={() => router.push("/college/proposals")}>
              See my proposals
            </Button>
            <ButtonLink href="/college/problems" variant="secondary" icon="list">
              Back to problems
            </ButtonLink>
          </div>

          <p className="mono text-center text-[10px] uppercase tracking-[0.1em] text-mute">
            proposal {submitted.proposal_id.slice(0, 8)} · v{submitted.version}
          </p>
        </Main>
      </>
    );
  }

  const openForProposals = ["VERIFIED", "OPEN", "TEAM_FORMED"].includes(c.status);
  const closed = !openForProposals || (row?.competition?.state && !["not_opened", "open", "reopened"].includes(row.competition.state));

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
            <Panel title="Your proposal" lede="Upload the PDF. The AI reads it page by page and scores it on the rubric.">
              {closed && (
                <Card depth="in" className="mb-4 flex items-start gap-3 p-4">
                  <span className="mt-px text-alert-ink">
                    <Icon name="alert" size={16} />
                  </span>
                  <p className="text-[13px] leading-relaxed text-body">
                    This problem is no longer open for proposals — it has been awarded to a college
                    or is not verified. A submission now will be refused by the server.
                  </p>
                </Card>
              )}

              <div className="mb-4 flex flex-wrap gap-2">
                <Toggle active={mode === "pdf"} onClick={() => setMode("pdf")}>
                  <Icon name="upload" size={13} /> Upload a PDF
                </Toggle>
                <Toggle active={mode === "text"} onClick={() => setMode("text")}>
                  <Icon name="file" size={13} /> Paste the text instead
                </Toggle>
              </div>

              {mode === "pdf" ? (
                <div className="flex flex-col gap-4">
                  <label className="in flex cursor-pointer flex-col items-center gap-2 p-7 text-center">
                    <span className="up-s grid h-12 w-12 place-items-center text-navy">
                      <Icon name="upload" size={20} />
                    </span>
                    <span className="text-[14px] font-bold text-navy-dark">
                      {file ? file.name : "Choose the proposal PDF"}
                    </span>
                    <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
                      {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "PDF with selectable text · up to 12 MB"}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {fileProblem && <p className="text-[12.5px] text-alert-ink">{fileProblem}</p>}
                  <Caveat icon="info">
                    Include the approach, a bill of materials with quantities and units (e.g.
                    &ldquo;Galvanised steel - 10 kg&rdquo;), the total budget in rupees, the timeline
                    with phases, and who maintains it after handover. The materials and budget you
                    list pre-fill the requirements you publish if you win.
                  </Caveat>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2">
                    <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                      Document name
                    </span>
                    <input
                      className="field"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="gumla-siren-shelters"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                      The document
                    </span>
                    <textarea
                      className="field min-h-[320px]"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={
                        "Problem addressed…\nApproach…\nBill of materials:\n- Galvanised steel - 10 kg\n- Siren units - 12 units\nTotal budget: Rs 2,00,000\nTimeline: 60 days\nPhase 1: Site survey (7 days)\nWho maintains it after handover…"
                      }
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
                      {num(words)} words · {num(text.trim().length)} characters
                    </span>
                    <span
                      className={`mono text-[10.5px] uppercase tracking-[0.1em] ${enoughText ? "text-teal-ink" : "text-alert-ink"}`}
                    >
                      {enoughText ? "long enough to score" : `at least ${MIN_TEXT} characters`}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="in-s mt-4 flex items-start gap-2.5 p-3.5" role="alert">
                  <span className="mt-px text-alert-ink">
                    <Icon name="alert" size={15} />
                  </span>
                  <p className="text-[13px] leading-relaxed text-body">{error}</p>
                </div>
              )}

              <div className="mt-4">
                <Button variant="primary" busy={busy} disabled={!ready || Boolean(closed)} icon="upload" onClick={submit}>
                  {busy ? (mode === "pdf" ? "Reading the PDF" : "Submitting") : "Submit this proposal"}
                </Button>
              </div>
            </Panel>

            <Panel
              title="What you are solving"
              lede="Scored against this brief specifically — a strong solution to a different problem scores zero on problem fit."
            >
              <p className="text-[14.5px] leading-relaxed text-ink">{c.brief?.problem ?? c.why_critical}</p>

              {c.brief?.outcome && (
                <div className="in mt-4 p-4">
                  <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                    What success looks like
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{c.brief.outcome}</p>
                  {c.brief.success_metric && (
                    <p className="mt-2.5 text-[12.5px] leading-relaxed text-body">
                      <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-mute">measured by </span>
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
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{c.brief.translated_text}</p>
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
              <WindowState competition={row?.competition} myScore={row?.my_proposal?.score ?? null} />
              {row?.my_proposal && (
                <div className="up-s mt-3 p-4">
                  <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">your current submission</div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="text-[13.5px] font-semibold text-ink">
                      v{row.my_proposal.version} · {humanise(row.my_proposal.state)}
                    </span>
                    {row.my_proposal.score !== null && (
                      <span className="mono text-[16px] font-semibold text-ink">{row.my_proposal.score}/100</span>
                    )}
                  </div>
                  {row.my_proposal.verdict === "not_viable" && (
                    <p className="mt-2 text-[12.5px] leading-relaxed text-alert-ink">
                      Rejected as not viable. Read the reasons, fix them, and submit a new version.
                    </p>
                  )}
                  {row.my_proposal.is_leading === false && (
                    <p className="mt-2 text-[12.5px] leading-relaxed text-body">
                      Another proposal is ahead. A new version replaces yours in the comparison; the
                      earlier one stays on the record.
                    </p>
                  )}
                  <div className="mt-3">
                    <ButtonLink href={`/college/proposals/${row.my_proposal.id}`} variant="secondary" size="sm" iconAfter="arrow">
                      Read the verdict
                    </ButtonLink>
                  </div>
                </div>
              )}
            </Panel>

            {row?.verification && (
              <Panel title="How it was verified" depth="in">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="teal">
                    {row.verification.method === "ai" ? "AI, from independent sources" : `By a ${row.verification.method}`}
                  </Chip>
                  <Tag>{row.verification.sources} source(s)</Tag>
                  {row.verification.photos > 0 && <Tag>{row.verification.photos} photo(s)</Tag>}
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-body">
                  Verified {dateTime(row.verification.at)}. The sources are on the full brief.
                </p>
              </Panel>
            )}

            <Panel title="Why it is ranked here" lede="The district's own scoring, opened.">
              <ScoreFactors breakdown={c.score_breakdown} whyCritical={c.why_critical} compact />
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
                Maintenance and handover 5. Below 40 is rejected as not viable.
              </p>
            </Card>
          </aside>
        </div>
      </Main>
    </>
  );
}
