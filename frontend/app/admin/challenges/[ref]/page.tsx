'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Clock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import { TimelineGaps, TimelineEvent } from '@/components/shared/TimelineGaps';
import { fetchChallengeHistory } from '@/lib/api';

/**
 * Everything that ever happened to one challenge, in order, with the gap
 * between each step.
 *
 * This is the view that answers "what happened here, and when" without the
 * system owner opening the database, and it reads from the same endpoint the
 * narrator does, so the two can never disagree.
 */

interface Event {
  at: string;
  kind: string;
  actor: string | null;
  summary: string;
  detail: Record<string, unknown>;
  gap_hours: number | null;
}

const KIND_LABEL: Record<string, string> = {
  report: 'Citizen report',
  external_check: 'AI corroboration',
  verified: 'Human verification',
  rejected: 'Rejected by verifier',
  proposal: 'Proposal submitted',
  lead_change: 'Lead changed',
  contribution: 'Contribution',
  progress_update: 'Progress update',
  ledger: 'Ledger entry',
};

const KIND_TONE: Record<string, string> = {
  report: 'bg-gray-100 text-gray-700',
  external_check: 'bg-blue-50 text-blue-800',
  verified: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  proposal: 'bg-[#E5A83B]/20 text-[#8A5A00]',
  lead_change: 'bg-purple-50 text-purple-800',
  contribution: 'bg-teal-50 text-teal-800',
  progress_update: 'bg-emerald-50 text-emerald-800',
  ledger: 'bg-gray-100 text-gray-600',
};

function gapLabel(h: number | null): string {
  if (h === null) return 'first event';
  if (h < 1) return `${Math.round(h * 60)}m later`;
  if (h < 48) return `${Math.round(h * 10) / 10}h later`;
  return `${Math.round(h / 24)}d later`;
}

export default function AdminChallengeHistoryPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const [ref, setRef] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    params.then((p) => setRef(p.ref));
  }, [params]);

  const load = useCallback(async () => {
    if (!ref) return;
    setError('');
    try {
      setData(await fetchChallengeHistory(ref));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the history.');
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  const events: Event[] = data?.timeline ?? [];
  const counts: Record<string, number> = data?.counts ?? {};

  const timelineEvents: TimelineEvent[] = events.map((e, i) => ({
    id: `${e.kind}-${i}`,
    label: `${KIND_LABEL[e.kind] ?? e.kind}: ${e.summary.slice(0, 70)}`,
    date: e.at,
    actor: e.actor ?? undefined,
    daysSincePrevious: e.gap_hours !== null ? Math.round((e.gap_hours / 24) * 10) / 10 : undefined,
    isBottleneck: (e.gap_hours ?? 0) > 168,
    status: 'completed',
  }));

  return (
    <RouteGuard allowedRoles={['admin']} consoleTitle="Challenge History">
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Link
                href="/admin"
                className="font-mono text-[10px] tracking-wider uppercase text-[#2E7180] hover:underline flex items-center gap-1 mb-1"
              >
                <ArrowLeft className="w-3 h-3" /> Command centre
              </Link>
              <h1 className="text-2xl font-extrabold text-[#102027] tracking-tight">
                {data?.challenge?.ref ?? ref} — complete record
              </h1>
              {data?.challenge?.title && (
                <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                  {data.challenge.title}
                </p>
              )}
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
          ) : (
            <>
              {/* counts */}
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {Object.entries(counts).map(([k, v]) => (
                  <div key={k} className="bg-white rounded-lg border border-[#CCD1C7] p-2.5">
                    <div className="font-mono text-[9px] tracking-wider uppercase text-gray-500 leading-tight">
                      {k.replace(/_/g, ' ')}
                    </div>
                    <div className="font-mono text-lg font-extrabold text-[#102027]">{v}</div>
                  </div>
                ))}
              </div>

              {/* window */}
              {data?.window && (
                <div className="bg-white rounded-xl border border-[#CCD1C7] p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div>
                    <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                      Proposal window
                    </div>
                    <div className="font-semibold uppercase font-mono text-xs">
                      {data.window.state}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                      Length
                    </div>
                    <div className="font-mono text-xs">{data.window.window_days} days</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                      Leading score
                    </div>
                    <div className="font-mono text-xs">{data.window.leader_score ?? '—'}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                      Reopened
                    </div>
                    <div className="font-mono text-xs">{data.window.reopen_count} times</div>
                  </div>
                </div>
              )}

              {/* the gaps, which is the specified ask */}
              {events.length > 0 && (
                <section>
                  <h2 className="font-bold text-[#102027] mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#2E7180]" /> Time between each step
                  </h2>
                  <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
                    <TimelineGaps
                      events={timelineEvents}
                      projectTitle={data?.challenge?.title}
                      slaThresholdDays={7}
                    />
                    {data?.longest_gap_hours > 0 && (
                      <p className="font-mono text-[11px] text-gray-500 mt-3 pt-3 border-t border-[#DFE4DC]">
                        Longest single gap: {gapLabel(data.longest_gap_hours)}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* the record */}
              <section>
                <h2 className="font-bold text-[#102027] mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2E7180]" /> Every entry, in order
                </h2>
                {events.length === 0 ? (
                  <div className="bg-white rounded-xl border border-[#CCD1C7] p-8 text-center">
                    <p className="text-sm font-semibold text-[#102027]">
                      Nothing has happened to this challenge yet
                    </p>
                    <p className="text-xs text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                      No reports are clustered to it, and no verification,
                      proposal or contribution has been recorded. That is the
                      honest reading, not a loading failure.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-[#CCD1C7] divide-y divide-[#DFE4DC]">
                    {events.map((e, i) => (
                      <div key={`${e.kind}-${e.at}-${i}`}>
                        <button
                          onClick={() => setOpenIdx(openIdx === i ? null : i)}
                          className="w-full text-left p-3.5 flex flex-wrap items-start gap-3 hover:bg-[#F4F6F5]"
                        >
                          <span
                            className={`font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded shrink-0 ${
                              KIND_TONE[e.kind] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {(KIND_LABEL[e.kind] ?? e.kind).toUpperCase()}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-[#102027] leading-snug">
                              {e.summary}
                            </span>
                            <span className="block font-mono text-[10px] text-gray-500 mt-0.5">
                              {new Date(e.at).toLocaleString('en-IN')}
                              {e.actor ? ` · ${e.actor}` : ''}
                            </span>
                          </span>
                          <span
                            className={`font-mono text-[10px] shrink-0 ${
                              (e.gap_hours ?? 0) > 168 ? 'text-[#A8332A] font-bold' : 'text-gray-500'
                            }`}
                          >
                            {gapLabel(e.gap_hours)}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                              openIdx === i ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {openIdx === i && (
                          <pre className="mx-3.5 mb-3.5 p-3 rounded-lg bg-[#0D1619] text-[#E2E9E7] font-mono text-[10.5px] leading-relaxed overflow-x-auto">
                            {JSON.stringify(e.detail, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </RouteGuard>
  );
}
