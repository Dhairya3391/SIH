'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Send,
  Trophy,
  Upload,
  XCircle,
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import { RubricBreakdown, RubricCriterion } from '@/components/shared/RubricBreakdown';
import { CountdownToClose } from '@/components/shared/CountdownToClose';
import { fetchCollegeProblems, fetchMyProposals, submitProposal } from '@/lib/api';
import { formatIndianCurrency } from '@/components/shared/ContributionSplitter';

/**
 * Read the problem, submit a proposal, and read the verdict.
 *
 * The verdict screen is the most consequential in the product: a college's
 * work is being judged by a model, so every criterion shows its own points,
 * its reason and the page it read them from, and a rejection arrives as
 * actionable changes rather than a number to argue with.
 */

interface Problem {
  id: string;
  ref: string;
  title: string;
  district: string;
  block: string | null;
  category: string;
  priority: number;
  people_est: number;
  report_count: number;
  brief: { problem?: string; needs?: string[]; outcome?: string } | null;
  capabilities: string[] | null;
  competition: {
    state: string;
    closes_at?: string;
    window_days?: number;
    leader_score?: number | null;
    proposal_count?: number;
  };
}

interface Proposal {
  id: string;
  challenge_id: string;
  version: number;
  state: string;
  ai_score: number | null;
  ai_verdict: string | null;
  ai_rubric: {
    total?: number;
    criteria?: { key: string; label: string; max: number; points: number; reason: string; pages: number[] }[];
    summary?: string;
    required_changes?: string[];
  } | null;
  ai_error: string | null;
  funding_required: number | null;
  duration_days: number | null;
  document_name: string | null;
  submitted_at: string;
  is_leading: boolean | null;
  score_to_beat: number | null;
}

const VERDICT_STYLE: Record<string, { bg: string; label: string; Icon: typeof CheckCircle2 }> = {
  viable: { bg: 'bg-emerald-50 border-emerald-300 text-emerald-900', label: 'Viable', Icon: CheckCircle2 },
  needs_changes: { bg: 'bg-amber-50 border-amber-300 text-amber-900', label: 'Needs changes', Icon: AlertCircle },
  not_viable: { bg: 'bg-red-50 border-red-300 text-red-900', label: 'Not viable', Icon: XCircle },
};

export default function CollegeProblemDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const [ref, setRef] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [mine, setMine] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [text, setText] = useState('');
  const [docName, setDocName] = useState('proposal.pdf');
  const [pages, setPages] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    params.then((p) => setRef(p.ref));
  }, [params]);

  const load = useCallback(async () => {
    if (!ref) return;
    setError('');
    try {
      const [probs, props] = await Promise.all([fetchCollegeProblems(), fetchMyProposals()]);
      const found = (probs.problems as Problem[]).find(
        (p) => p.ref?.toUpperCase() === ref.toUpperCase(),
      );
      setProblem(found ?? null);
      if (!found) {
        setError(
          'This problem is not open to your college. It may not be verified yet, or its window may have closed.',
        );
      }
      setMine(
        (props.proposals as Proposal[]).filter(
          (p) => found && p.challenge_id === found.id,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this problem.');
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  // While a submission is waiting to be scored, keep checking.
  useEffect(() => {
    const waiting = mine.some((p) => p.state === 'submitted' || p.state === 'scoring');
    if (!waiting) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [mine, load]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem) return;
    setNotice('');
    setError('');
    setSubmitting(true);
    try {
      const res = await submitProposal({
        challenge_id: problem.id,
        extracted_text: text,
        document_name: docName,
        document_pages: pages,
      });
      setNotice(
        `Submitted as version ${res.version}. Scoring is queued — the window closes ${new Date(
          res.window.closes_at,
        ).toLocaleString('en-IN')}.`,
      );
      setText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  };

  const latest = mine.length > 0 ? mine.reduce((a, b) => (b.version > a.version ? b : a)) : null;
  const awaiting = latest && (latest.state === 'submitted' || latest.state === 'scoring');

  const toRubric = (p: Proposal): RubricCriterion[] =>
    (p.ai_rubric?.criteria ?? []).map((c) => ({
      id: c.key,
      name: c.label,
      score: c.points,
      max: c.max,
      reason: c.reason,
      page: c.pages?.[0],
    }));

  return (
    <RoleGuard allowedRoles={['university', 'coordinator', 'admin']} consoleTitle="Propose a Solution">
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <Link
            href="/college/problems"
            className="font-mono text-[10px] tracking-wider uppercase text-[#2E7180] hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> All verified problems
          </Link>

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 text-xs text-[#A8332A] bg-red-50 border border-red-200 rounded-xl p-3"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              {problem && (
                <>
                  {/* the brief */}
                  <section className="bg-white rounded-xl border border-[#CCD1C7] p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                          problem.priority >= 75
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        PRIORITY {problem.priority}
                      </span>
                      <span className="font-mono text-[10px] text-gray-600 border border-[#CCD1C7] px-1.5 py-0.5 rounded uppercase">
                        {String(problem.category).replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-[10px] text-gray-500">{problem.ref}</span>
                    </div>
                    <h1 className="text-xl font-extrabold text-[#102027] tracking-tight leading-snug">
                      {problem.title}
                    </h1>
                    <div className="font-mono text-[10px] text-gray-500 mt-1.5">
                      {problem.district}
                      {problem.block ? ` · ${problem.block}` : ''} ·{' '}
                      {problem.people_est?.toLocaleString('en-IN')} people ·{' '}
                      {problem.report_count} reports merged
                    </div>

                    {problem.brief?.problem && (
                      <>
                        <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mt-4 mb-1.5">
                          The problem
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {problem.brief.problem}
                        </p>
                      </>
                    )}
                    {problem.brief?.outcome && (
                      <>
                        <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mt-4 mb-1.5">
                          What good looks like
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {problem.brief.outcome}
                        </p>
                      </>
                    )}
                    {problem.brief?.needs && problem.brief.needs.length > 0 && (
                      <>
                        <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mt-4 mb-1.5">
                          What it needs
                        </div>
                        <ul className="space-y-1">
                          {problem.brief.needs.map((n) => (
                            <li key={n} className="text-sm text-gray-700 flex gap-2">
                              <span className="text-[#2E7180]">·</span>
                              {n}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </section>

                  {/* the competition */}
                  <section className="bg-white rounded-xl border border-[#CCD1C7] p-4 flex flex-wrap items-center gap-4">
                    <div>
                      <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                        Competition
                      </div>
                      {problem.competition.state === 'not_opened' ? (
                        <p className="text-sm font-semibold text-[#102027]">
                          No proposals yet — yours would start the clock
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-semibold text-[#102027]">
                            Score to beat:{' '}
                            <span className="font-mono">
                              {problem.competition.leader_score ?? '—'}
                            </span>
                          </span>
                          {problem.competition.closes_at && (
                            <span className="flex items-center gap-1.5 font-mono text-[11px] text-gray-600">
                              <Clock className="w-3.5 h-3.5" />
                              <CountdownToClose
                                closeDate={problem.competition.closes_at}
                                status={problem.competition.state}
                                leadingScore={problem.competition.leader_score ?? undefined}
                                compact
                              />
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-gray-500 mt-1 max-w-xl leading-relaxed">
                        The leading score is public; the leading document and
                        the college behind it are not, until the window closes.
                      </p>
                    </div>
                    {latest?.is_leading && (
                      <span className="ml-auto font-mono text-[10px] font-bold tracking-wider px-2.5 py-1.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5" /> YOU ARE LEADING
                      </span>
                    )}
                  </section>

                  {/* verdicts on submissions so far */}
                  {mine.map((p) => {
                    const style = p.ai_verdict ? VERDICT_STYLE[p.ai_verdict] : null;
                    return (
                      <section
                        key={p.id}
                        className="bg-white rounded-xl border border-[#CCD1C7] overflow-hidden"
                      >
                        <div className="p-4 border-b border-[#CCD1C7] flex flex-wrap items-center gap-3">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-sm text-[#102027]">
                            Version {p.version}
                          </span>
                          <span className="font-mono text-[10px] text-gray-500">
                            {p.document_name} ·{' '}
                            {new Date(p.submitted_at).toLocaleString('en-IN')}
                          </span>
                          {p.state === 'submitted' || p.state === 'scoring' ? (
                            <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-gray-600">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              reading the document and scoring…
                            </span>
                          ) : (
                            <span className="ml-auto flex items-center gap-2">
                              {style && (
                                <span
                                  className={`font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded border ${style.bg}`}
                                >
                                  {style.label.toUpperCase()}
                                </span>
                              )}
                              <span className="font-mono text-lg font-extrabold text-[#102027]">
                                {p.ai_score ?? '—'}
                                <span className="text-gray-400 text-xs">/100</span>
                              </span>
                            </span>
                          )}
                        </div>

                        {p.ai_error && (
                          <div className="px-4 py-3 bg-red-50 text-xs text-[#A8332A]">
                            Scoring could not complete: {p.ai_error}. It will be retried.
                          </div>
                        )}

                        {p.ai_rubric?.summary && (
                          <div className="px-4 pt-4">
                            <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1.5">
                              Summary
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {p.ai_rubric.summary}
                            </p>
                          </div>
                        )}

                        {(p.ai_rubric?.criteria?.length ?? 0) > 0 && (
                          <div className="p-4">
                            <RubricBreakdown criteria={toRubric(p)} />
                          </div>
                        )}

                        {(p.ai_rubric?.required_changes?.length ?? 0) > 0 && (
                          <div className="px-4 pb-4">
                            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                              <div className="font-mono text-[10px] font-bold tracking-wider uppercase text-amber-800 mb-2">
                                What to change before resubmitting
                              </div>
                              <ol className="space-y-1.5">
                                {p.ai_rubric!.required_changes!.map((c, i) => (
                                  <li
                                    key={c}
                                    className="text-sm text-amber-900 leading-relaxed flex gap-2"
                                  >
                                    <span className="font-mono text-xs shrink-0">
                                      {String(i + 1).padStart(2, '0')}
                                    </span>
                                    {c}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        )}

                        {(p.funding_required || p.duration_days) && (
                          <div className="px-4 pb-4 flex flex-wrap gap-6">
                            {p.funding_required ? (
                              <div>
                                <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                                  Funding read from your document
                                </div>
                                <div className="font-mono font-bold text-[#102027]">
                                  {formatIndianCurrency(p.funding_required)}
                                </div>
                              </div>
                            ) : null}
                            {p.duration_days ? (
                              <div>
                                <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                                  Duration
                                </div>
                                <div className="font-mono font-bold text-[#102027]">
                                  {p.duration_days} days
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {p.score_to_beat !== null && (
                          <div className="px-4 py-3 bg-[#F4F6F5] border-t border-[#CCD1C7] text-xs text-gray-700">
                            Another college is ahead at{' '}
                            <strong className="font-mono">{p.score_to_beat}</strong>. You can
                            resubmit an improved version while the window is open.
                          </div>
                        )}
                      </section>
                    );
                  })}

                  {/* submit */}
                  {problem.competition.state === 'open' ||
                  problem.competition.state === 'not_opened' ? (
                    <section className="bg-white rounded-xl border border-[#CCD1C7] p-5">
                      <h2 className="font-bold text-[#102027] mb-1">
                        {mine.length > 0 ? 'Submit an improved version' : 'Submit your proposal'}
                      </h2>
                      <p className="text-xs text-gray-600 mb-4 leading-relaxed max-w-2xl">
                        Paste the text of your proposal document. It is scored
                        against a published seven-criterion rubric, once, and
                        the score is never recomputed — so a later submission by
                        anyone cannot change what yours was given.
                      </p>

                      {notice && (
                        <div className="flex items-start gap-2 text-xs text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-xl p-3 mb-4">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{notice}</span>
                        </div>
                      )}

                      <form onSubmit={onSubmit} className="space-y-3">
                        <div className="flex flex-wrap gap-3">
                          <label className="flex-1 min-w-[200px]">
                            <span className="block font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                              Document name
                            </span>
                            <input
                              value={docName}
                              onChange={(e) => setDocName(e.target.value)}
                              className="w-full h-10 px-3 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-sm outline-none focus:border-[#2E7180]"
                            />
                          </label>
                          <label className="w-32">
                            <span className="block font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                              Pages
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              value={pages}
                              onChange={(e) => setPages(Number(e.target.value) || 1)}
                              className="w-full h-10 px-3 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-sm outline-none focus:border-[#2E7180]"
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="block font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                            Proposal text
                          </span>
                          <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            required
                            minLength={200}
                            rows={12}
                            placeholder={`Address the problem above directly. The rubric rewards:\n\n1. Problem fit — does it solve THIS problem\n2. Technical soundness\n3. Practicality in a rural block: power cuts, no internet, local labour, monsoon\n4. A credible cost, itemised\n5. A credible timeline\n6. Materials with quantities and units a company can pledge against\n7. Who maintains it in year two`}
                            className="w-full px-3 py-2.5 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-sm leading-relaxed outline-none focus:border-[#2E7180] font-mono"
                          />
                          <span className="font-mono text-[10px] text-gray-500">
                            {text.trim().length} characters · 200 minimum
                          </span>
                        </label>

                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            disabled={submitting || text.trim().length < 200}
                            className="h-11 px-5 rounded-lg bg-[#102027] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#1D3540] disabled:opacity-50"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" /> Submit for scoring
                              </>
                            )}
                          </button>
                          <span className="font-mono text-[10px] text-gray-500 flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5" />
                            PDF upload arrives with the document store
                          </span>
                        </div>
                      </form>
                    </section>
                  ) : (
                    <section className="bg-white rounded-xl border border-[#CCD1C7] p-5 text-center">
                      <p className="text-sm font-semibold text-[#102027]">
                        This window is closed
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Proposals are no longer accepted for {problem.ref}.
                      </p>
                    </section>
                  )}

                  {awaiting && (
                    <p className="font-mono text-[11px] text-gray-500 text-center">
                      Checking for your score every few seconds…
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </RoleGuard>
  );
}
