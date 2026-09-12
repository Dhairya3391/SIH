'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Trophy,
  XCircle,
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import { CountdownToClose } from '@/components/shared/CountdownToClose';
import { fetchMyProposals } from '@/lib/api';
import { formatIndianCurrency } from '@/components/shared/ContributionSplitter';

/**
 * Every proposal this college has submitted, and where each one stands.
 *
 * Grouped by what the college has to DO about it - resubmit, wait, or start
 * delivering - rather than by database state, because "runner_up" is not an
 * instruction.
 */

interface Proposal {
  id: string;
  challenge_id: string;
  version: number;
  state: string;
  ai_score: number | null;
  ai_verdict: string | null;
  ai_rubric: { summary?: string; required_changes?: string[] } | null;
  ai_error: string | null;
  funding_required: number | null;
  duration_days: number | null;
  document_name: string | null;
  submitted_at: string;
  scored_at: string | null;
  challenge: { ref: string; title: string } | null;
  window: { state: string; closes_at: string; leader_score: number | null } | null;
  is_leading: boolean | null;
  score_to_beat: number | null;
}

const STATE_META: Record<
  string,
  { label: string; tone: string; Icon: typeof CheckCircle2; action: string }
> = {
  submitted: { label: 'Waiting to be scored', tone: 'bg-gray-100 text-gray-700', Icon: Loader2, action: 'wait' },
  scoring: { label: 'Being scored', tone: 'bg-gray-100 text-gray-700', Icon: Loader2, action: 'wait' },
  scored: { label: 'Scored', tone: 'bg-blue-50 text-blue-800', Icon: FileText, action: 'compete' },
  rejected_not_viable: { label: 'Not viable', tone: 'bg-red-100 text-red-800', Icon: XCircle, action: 'fix' },
  winner: { label: 'Won', tone: 'bg-emerald-100 text-emerald-800', Icon: Trophy, action: 'deliver' },
  runner_up: { label: 'Runner-up', tone: 'bg-amber-100 text-amber-800', Icon: FileText, action: 'none' },
  lapsed: { label: 'Window closed', tone: 'bg-gray-100 text-gray-600', Icon: Clock, action: 'none' },
  withdrawn: { label: 'Withdrawn', tone: 'bg-gray-100 text-gray-600', Icon: XCircle, action: 'none' },
};

export default function CollegeProjectsPage() {
  const [rows, setRows] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetchMyProposals();
      setRows(res.proposals as Proposal[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your proposals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!rows.some((r) => r.state === 'submitted' || r.state === 'scoring')) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [rows, load]);

  const groups = useMemo(() => {
    const act = (p: Proposal) => STATE_META[p.state]?.action ?? 'none';
    return [
      { key: 'deliver', title: 'Won — start delivering', list: rows.filter((p) => act(p) === 'deliver') },
      { key: 'fix', title: 'Needs changes before it can compete', list: rows.filter((p) => act(p) === 'fix') },
      { key: 'compete', title: 'In competition', list: rows.filter((p) => act(p) === 'compete') },
      { key: 'wait', title: 'Being scored', list: rows.filter((p) => act(p) === 'wait') },
      { key: 'none', title: 'Closed', list: rows.filter((p) => act(p) === 'none') },
    ].filter((g) => g.list.length > 0);
  }, [rows]);

  return (
    <RoleGuard allowedRoles={['university', 'coordinator', 'admin']} consoleTitle="My Proposals">
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Stage 3 and 5 · Proposals and delivery
              </div>
              <h1 className="text-2xl font-extrabold text-[#102027] tracking-tight">
                Your proposals
              </h1>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                Grouped by what you can do about each one.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/college/problems"
                className="h-9 px-3 rounded-lg bg-[#102027] text-white text-xs font-semibold flex items-center hover:bg-[#1D3540]"
              >
                Find a problem
              </Link>
              <button
                onClick={() => {
                  setLoading(true);
                  load();
                }}
                className="h-9 px-3 rounded-lg border border-[#CCD1C7] bg-white text-xs font-semibold text-gray-700 flex items-center gap-1.5 hover:border-[#2E7180]"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 text-xs text-[#A8332A] bg-red-50 border border-red-200 rounded-xl p-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : rows.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-10 text-center">
              <FileText className="w-7 h-7 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#102027]">
                You have not submitted a proposal yet
              </p>
              <p className="text-xs text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                Verified problems are listed with the score to beat and how long
                is left on each window.
              </p>
              <Link
                href="/college/problems"
                className="inline-flex mt-4 h-9 px-4 rounded-lg bg-[#102027] text-white text-xs font-semibold items-center hover:bg-[#1D3540]"
              >
                Browse verified problems
              </Link>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key}>
                <h2 className="font-bold text-[#102027] mb-2">{g.title}</h2>
                <div className="space-y-2">
                  {g.list.map((p) => {
                    const meta = STATE_META[p.state] ?? STATE_META.lapsed;
                    const spinning = meta.action === 'wait';
                    return (
                      <article
                        key={p.id}
                        className="bg-white rounded-xl border border-[#CCD1C7] p-4"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <span
                            className={`font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded flex items-center gap-1 shrink-0 ${meta.tone}`}
                          >
                            <meta.Icon className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`} />
                            {meta.label.toUpperCase()}
                          </span>

                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/college/problems/${p.challenge?.ref ?? ''}`}
                              className="font-semibold text-sm text-[#102027] hover:text-[#2E7180] leading-snug"
                            >
                              {p.challenge?.title ?? 'Unknown challenge'}
                            </Link>
                            <div className="font-mono text-[10px] text-gray-500 mt-0.5">
                              {p.challenge?.ref} · v{p.version} · {p.document_name} ·{' '}
                              {new Date(p.submitted_at).toLocaleDateString('en-IN')}
                            </div>

                            {p.ai_rubric?.summary && (
                              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-2">
                                {p.ai_rubric.summary}
                              </p>
                            )}

                            {p.ai_error && (
                              <p className="text-xs text-[#A8332A] mt-1.5">
                                Scoring failed: {p.ai_error}. It will be retried.
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 font-mono text-[10px] text-gray-500">
                              {p.funding_required ? (
                                <span>{formatIndianCurrency(p.funding_required)}</span>
                              ) : null}
                              {p.duration_days ? <span>{p.duration_days} days</span> : null}
                              {p.window?.state === 'open' && p.window.closes_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <CountdownToClose
                                    closeDate={p.window.closes_at}
                                    status={p.window.state}
                                    leadingScore={p.window.leader_score ?? undefined}
                                    compact
                                  />
                                </span>
                              )}
                            </div>

                            {p.score_to_beat !== null && (
                              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">
                                Another college leads at{' '}
                                <strong className="font-mono">{p.score_to_beat}</strong>. You can
                                resubmit while the window is open.
                              </p>
                            )}
                            {p.is_leading && p.state === 'scored' && (
                              <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 mt-2 flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5" /> Yours is the leading proposal.
                              </p>
                            )}
                            {(p.ai_rubric?.required_changes?.length ?? 0) > 0 && (
                              <p className="text-xs text-gray-700 mt-2">
                                <strong>{p.ai_rubric!.required_changes!.length} change(s)</strong>{' '}
                                needed —{' '}
                                <Link
                                  href={`/college/problems/${p.challenge?.ref ?? ''}`}
                                  className="text-[#2E7180] hover:underline"
                                >
                                  read them
                                </Link>
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                              Score
                            </div>
                            <div className="font-mono text-2xl font-extrabold text-[#102027]">
                              {p.ai_score ?? '—'}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </main>
      </div>
    </RoleGuard>
  );
}
