'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import { CountdownToClose } from '@/components/shared/CountdownToClose';
import { fetchCollegeProblems, fetchMyProposals } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * The college's landing console: what needs attention first.
 *
 * Ordered by urgency to the college rather than by database state - a window
 * about to close, or a rejection waiting to be fixed, matters more than a
 * project that is quietly on track.
 */

interface Problem {
  id: string;
  ref: string;
  title: string;
  district: string;
  priority: number;
  competition: { state: string; closes_at?: string; leader_score?: number | null };
  my_proposal: { state: string; score: number | null; is_leading: boolean | null } | null;
}

interface Proposal {
  id: string;
  version: number;
  state: string;
  ai_score: number | null;
  ai_rubric: { required_changes?: string[] } | null;
  challenge: { ref: string; title: string } | null;
  window: { state: string; closes_at: string } | null;
  score_to_beat: number | null;
  is_leading: boolean | null;
}

export default function CollegeHomePage() {
  const { organisation, user } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [p, m] = await Promise.all([fetchCollegeProblems(), fetchMyProposals()]);
      setProblems(p.problems as Problem[]);
      setProposals(m.proposals as Proposal[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your console.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const attention = useMemo(() => {
    const items: { key: string; urgency: number; node: React.ReactNode }[] = [];

    for (const p of proposals) {
      if (p.state === 'rejected_not_viable') {
        items.push({
          key: `fix-${p.id}`,
          urgency: 1,
          node: (
            <Link
              href={`/college/problems/${p.challenge?.ref ?? ''}`}
              className="block bg-white rounded-xl border border-red-300 p-4 hover:border-red-500"
            >
              <div className="font-mono text-[10px] font-bold tracking-wider uppercase text-red-800 mb-1">
                Rejected · {p.ai_rubric?.required_changes?.length ?? 0} change(s) needed
              </div>
              <div className="font-semibold text-sm text-[#102027]">{p.challenge?.title}</div>
              <div className="font-mono text-[10px] text-gray-500 mt-1">
                {p.challenge?.ref} · v{p.version} · scored {p.ai_score}
              </div>
            </Link>
          ),
        });
      } else if (p.score_to_beat !== null) {
        items.push({
          key: `beat-${p.id}`,
          urgency: 2,
          node: (
            <Link
              href={`/college/problems/${p.challenge?.ref ?? ''}`}
              className="block bg-white rounded-xl border border-amber-300 p-4 hover:border-amber-500"
            >
              <div className="font-mono text-[10px] font-bold tracking-wider uppercase text-amber-800 mb-1">
                Outscored · beat {p.score_to_beat}
              </div>
              <div className="font-semibold text-sm text-[#102027]">{p.challenge?.title}</div>
              <div className="font-mono text-[10px] text-gray-500 mt-1 flex items-center gap-1.5">
                yours {p.ai_score}
                {p.window?.closes_at && (
                  <>
                    <Clock className="w-3 h-3" />
                    <CountdownToClose closeDate={p.window.closes_at} compact />
                  </>
                )}
              </div>
            </Link>
          ),
        });
      } else if (p.state === 'winner') {
        items.push({
          key: `won-${p.id}`,
          urgency: 3,
          node: (
            <Link
              href="/college/projects"
              className="block bg-white rounded-xl border border-emerald-300 p-4 hover:border-emerald-500"
            >
              <div className="font-mono text-[10px] font-bold tracking-wider uppercase text-emerald-800 mb-1 flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Won · publish what you need
              </div>
              <div className="font-semibold text-sm text-[#102027]">{p.challenge?.title}</div>
              <div className="font-mono text-[10px] text-gray-500 mt-1">
                {p.challenge?.ref} · scored {p.ai_score}
              </div>
            </Link>
          ),
        });
      } else if (p.state === 'submitted' || p.state === 'scoring') {
        items.push({
          key: `wait-${p.id}`,
          urgency: 4,
          node: (
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] font-bold tracking-wider uppercase text-gray-600 mb-1 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Being scored
              </div>
              <div className="font-semibold text-sm text-[#102027]">{p.challenge?.title}</div>
              <div className="font-mono text-[10px] text-gray-500 mt-1">
                {p.challenge?.ref} · v{p.version}
              </div>
            </div>
          ),
        });
      }
    }

    return items.sort((a, b) => a.urgency - b.urgency);
  }, [proposals]);

  const openSoon = useMemo(
    () =>
      problems
        .filter((p) => p.competition.state === 'open' && !p.my_proposal)
        .sort(
          (a, b) =>
            new Date(a.competition.closes_at ?? 0).getTime() -
            new Date(b.competition.closes_at ?? 0).getTime(),
        )
        .slice(0, 4),
    [problems],
  );

  const unclaimed = useMemo(
    () =>
      problems
        .filter((p) => p.competition.state === 'not_opened')
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 4),
    [problems],
  );

  return (
    <RoleGuard allowedRoles={['university', 'coordinator', 'admin']} consoleTitle="College Console">
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Stage 3 · Academic solution portal
              </div>
              <h1 className="text-2xl font-extrabold text-[#102027] tracking-tight">
                {organisation?.name ?? 'Your college'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.full_name ? `Signed in as ${user.full_name}. ` : ''}
                Every district problem is a live R&amp;D brief.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/college/problems"
                className="h-9 px-3 rounded-lg bg-[#102027] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#1D3540]"
              >
                Browse problems <ArrowRight className="w-3.5 h-3.5" />
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
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { k: 'Open to propose', v: problems.length },
                  { k: 'Your submissions', v: proposals.length },
                  { k: 'Leading', v: proposals.filter((p) => p.is_leading).length },
                  { k: 'Won', v: proposals.filter((p) => p.state === 'winner').length },
                ].map((s) => (
                  <div key={s.k} className="bg-white rounded-xl border border-[#CCD1C7] p-4">
                    <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                      {s.k}
                    </div>
                    <div className="text-2xl font-extrabold font-mono text-[#102027]">{s.v}</div>
                  </div>
                ))}
              </div>

              {attention.length > 0 && (
                <section>
                  <h2 className="font-bold text-[#102027] mb-2">Needs you first</h2>
                  <div className="grid md:grid-cols-2 gap-3">
                    {attention.map((a) => (
                      <div key={a.key}>{a.node}</div>
                    ))}
                  </div>
                </section>
              )}

              {openSoon.length > 0 && (
                <section>
                  <h2 className="font-bold text-[#102027] mb-2">
                    Windows closing soon that you are not in
                  </h2>
                  <div className="bg-white rounded-xl border border-[#CCD1C7] divide-y divide-[#DFE4DC]">
                    {openSoon.map((p) => (
                      <Link
                        key={p.id}
                        href={`/college/problems/${p.ref}`}
                        className="flex flex-wrap items-center gap-3 p-3.5 hover:bg-[#F4F6F5]"
                      >
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#E5A83B]/20 text-[#8A5A00]">
                          BEAT {p.competition.leader_score ?? '—'}
                        </span>
                        <span className="flex-1 min-w-0 text-sm text-[#102027] leading-snug">
                          {p.title}
                        </span>
                        <span className="font-mono text-[10px] text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {p.competition.closes_at && (
                            <CountdownToClose closeDate={p.competition.closes_at} compact />
                          )}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="font-bold text-[#102027] mb-2">
                  Nobody has proposed for these yet
                </h2>
                {unclaimed.length === 0 ? (
                  <div className="bg-white rounded-xl border border-[#CCD1C7] p-6 text-center text-xs text-gray-500">
                    Every verified problem already has at least one proposal in.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-[#CCD1C7] divide-y divide-[#DFE4DC]">
                    {unclaimed.map((p) => (
                      <Link
                        key={p.id}
                        href={`/college/problems/${p.ref}`}
                        className="flex flex-wrap items-center gap-3 p-3.5 hover:bg-[#F4F6F5]"
                      >
                        <span
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                            p.priority >= 75
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.priority}
                        </span>
                        <span className="flex-1 min-w-0 text-sm text-[#102027] leading-snug">
                          {p.title}
                        </span>
                        <span className="font-mono text-[10px] text-gray-500">{p.district}</span>
                        <span className="font-mono text-[10px] text-[#2E7180]">
                          you would open the window
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="grid md:grid-cols-2 gap-3">
                <Link
                  href="/college/problems"
                  className="bg-white rounded-xl border border-[#CCD1C7] p-4 hover:border-[#2E7180] flex items-start gap-3"
                >
                  <GraduationCap className="w-5 h-5 text-[#2E7180] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm text-[#102027]">Verified problems</div>
                    <div className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      Every problem a human verifier has confirmed, with the
                      score to beat and time left.
                    </div>
                  </div>
                </Link>
                <Link
                  href="/college/projects"
                  className="bg-white rounded-xl border border-[#CCD1C7] p-4 hover:border-[#2E7180] flex items-start gap-3"
                >
                  <FileText className="w-5 h-5 text-[#2E7180] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm text-[#102027]">Your proposals</div>
                    <div className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      Grouped by what you can do about each one.
                    </div>
                  </div>
                </Link>
              </section>
            </>
          )}
        </main>
      </div>
    </RoleGuard>
  );
}
