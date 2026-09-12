'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  GraduationCap,
  MapPin,
  RefreshCw,
  Trophy,
  Users,
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import { CountdownToClose } from '@/components/shared/CountdownToClose';
import { fetchCollegeProblems } from '@/lib/api';
import { formatIndianNumber } from '@/components/shared/ContributionSplitter';

/**
 * Verified problems a college may propose against, with the competition state
 * on every card, because that is what a college actually decides on: is a
 * window open, when does it close, what is the score to beat, and am I in it.
 *
 * The leading SCORE is shown. The leading document and the leading college are
 * not, until the window closes - showing the number motivates a better
 * proposal, showing the rest invites copying and off-platform pressure.
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
  confidence: string;
  status: string;
  brief: { problem?: string; needs?: string[] } | null;
  capabilities: string[] | null;
  competition: {
    state: string;
    closes_at?: string;
    window_days?: number;
    leader_score?: number | null;
    proposal_count?: number;
  };
  my_proposal: {
    id: string;
    version: number;
    state: string;
    score: number | null;
    verdict: string | null;
    is_leading: boolean | null;
  } | null;
}

function CompetitionBadge({ p }: { p: Problem }) {
  const c = p.competition;
  const mine = p.my_proposal;

  if (c.state === 'not_opened') {
    return (
      <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-[#102027] text-white">
        NO PROPOSALS YET — YOU WOULD OPEN THE WINDOW
      </span>
    );
  }
  if (c.state === 'awarded') {
    return (
      <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-gray-200 text-gray-700">
        CLOSED — AWARDED
      </span>
    );
  }
  if (c.state === 'reopened') {
    return (
      <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-amber-100 text-amber-800">
        REOPENED — NO VIABLE PROPOSAL LAST TIME
      </span>
    );
  }
  if (mine && mine.is_leading) {
    return (
      <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
        <Trophy className="w-3 h-3" /> YOUR PROPOSAL IS LEADING · {mine.score}
      </span>
    );
  }
  if (mine && mine.is_leading === false) {
    return (
      <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-red-100 text-red-800 border border-red-300">
        OUTSCORED · LEADING {c.leader_score} · YOURS {mine.score ?? '—'}
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-[#E5A83B]/20 text-[#8A5A00]">
      {c.leader_score != null ? `SCORE TO BEAT · ${c.leader_score}` : 'OPEN FOR PROPOSALS'}
    </span>
  );
}

export default function CollegeProblemsPage() {
  const [rows, setRows] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [district, setDistrict] = useState('all');
  const [onlyOpen, setOnlyOpen] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetchCollegeProblems({
        district: district === 'all' ? undefined : district,
      });
      setRows(res.problems as Problem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load verified problems.');
    } finally {
      setLoading(false);
    }
  }, [district]);

  useEffect(() => {
    load();
  }, [load]);

  const districts = useMemo(() => [...new Set(rows.map((r) => r.district))].sort(), [rows]);

  const shown = useMemo(
    () =>
      onlyOpen
        ? rows.filter((r) => r.competition.state === 'open' || r.competition.state === 'not_opened')
        : rows,
    [rows, onlyOpen],
  );

  const stats = useMemo(
    () => ({
      total: rows.length,
      unclaimed: rows.filter((r) => r.competition.state === 'not_opened').length,
      open: rows.filter((r) => r.competition.state === 'open').length,
      mine: rows.filter((r) => r.my_proposal).length,
    }),
    [rows],
  );

  return (
    <RoleGuard
      allowedRoles={['university', 'coordinator', 'admin']}
      consoleTitle="Verified Problems"
    >
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Stage 3 · Academic solution portal
              </div>
              <h1 className="text-2xl font-extrabold text-[#102027] tracking-tight">
                Problems open for proposals
              </h1>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                Human-verified only. A proposal written against an unverified
                report risks a semester of work on something that turns out to
                be wrong.
              </p>
            </div>
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { k: 'Verified and open', v: stats.total, sub: 'available to propose against' },
              { k: 'No proposals yet', v: stats.unclaimed, sub: 'you would open the window' },
              { k: 'Windows running', v: stats.open, sub: 'a score already to beat' },
              { k: 'Your submissions', v: stats.mine, sub: 'across these problems' },
            ].map((s) => (
              <div key={s.k} className="bg-white rounded-xl border border-[#CCD1C7] p-4">
                <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                  {s.k}
                </div>
                <div className="text-2xl font-extrabold font-mono text-[#102027]">{s.v}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[#CCD1C7] p-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] tracking-wider uppercase text-gray-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Filter
            </span>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-xs outline-none focus:border-[#2E7180]"
            >
              <option value="all">All districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(e) => setOnlyOpen(e.target.checked)}
                className="w-4 h-4 accent-[#2E7180]"
              />
              Only ones I can still enter
            </label>
            <Link
              href="/college/projects"
              className="ml-auto text-xs font-semibold text-[#2E7180] hover:underline"
            >
              My proposals and projects →
            </Link>
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
            <LoadingSkeleton rows={4} />
          ) : shown.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-10 text-center">
              <GraduationCap className="w-7 h-7 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#102027]">
                Nothing verified is waiting for a proposal
              </p>
              <p className="text-xs text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                Problems appear here once a verifier has confirmed them with
                sources or a field photo. Until then they sit on the verifier
                desk, not here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shown.map((p) => (
                <article
                  key={p.id}
                  className="bg-white rounded-xl border border-[#CCD1C7] overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${
                          p.priority >= 75
                            ? 'bg-red-100 text-red-800'
                            : p.priority >= 55
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {p.priority >= 75 ? 'CRITICAL' : p.priority >= 55 ? 'HIGH' : 'MODERATE'}{' '}
                        {p.priority}
                      </span>
                      <span className="font-mono text-[10px] text-gray-600 border border-[#CCD1C7] px-1.5 py-0.5 rounded uppercase">
                        {String(p.category).replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-[10px] text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {String(p.confidence).replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-[10px] text-gray-500">{p.ref}</span>
                    </div>

                    <h2 className="font-bold text-[#102027] leading-snug">{p.title}</h2>
                    {p.brief?.problem && (
                      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-2">
                        {p.brief.problem}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 font-mono text-[10px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {p.district}
                        {p.block ? ` · ${p.block}` : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {formatIndianNumber(p.people_est)} people
                      </span>
                      <span>{p.report_count} reports merged</span>
                    </div>

                    {p.capabilities && p.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {p.capabilities.map((c) => (
                          <span
                            key={c}
                            className="font-mono text-[10px] bg-[#F4F6F5] border border-[#CCD1C7] px-1.5 py-0.5 rounded"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3 bg-[#F4F6F5] border-t border-[#CCD1C7] flex flex-wrap items-center gap-3">
                    <CompetitionBadge p={p} />
                    {p.competition.state === 'open' && p.competition.closes_at && (
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-gray-600">
                        <Clock className="w-3.5 h-3.5" />
                        <CountdownToClose
                          closeDate={p.competition.closes_at}
                          status={p.competition.state}
                          leadingScore={p.competition.leader_score ?? undefined}
                          compact
                        />
                      </span>
                    )}
                    {p.competition.proposal_count ? (
                      <span className="font-mono text-[10px] text-gray-500">
                        {p.competition.proposal_count} proposal
                        {p.competition.proposal_count === 1 ? '' : 's'} in
                      </span>
                    ) : null}
                    <Link
                      href={`/college/problems/${p.ref}`}
                      className="ml-auto h-9 px-4 rounded-lg bg-[#102027] text-white text-xs font-semibold flex items-center hover:bg-[#1D3540]"
                    >
                      {p.my_proposal ? 'Resubmit or review' : 'Read and propose'}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </RoleGuard>
  );
}
