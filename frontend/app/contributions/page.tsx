'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import { fetchMyContributions } from '@/lib/api';
import { formatIndianCurrency, formatIndianNumber } from '@/components/shared/ContributionSplitter';
import { useAuth } from '@/lib/auth';

/**
 * What this organisation gave, and what happened to it.
 *
 * Closed projects stay here on purpose. A company that funded something is
 * entitled to see how it finished; a project leaving the main list must not
 * take its funders' record of it away.
 */

interface Contribution {
  id: string;
  qty: number;
  kind: string;
  state: string;
  note: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  receipt_note: string | null;
  created_at: string;
  awaiting: string | null;
  need: { item: string; unit: string | null; qty_needed: number } | null;
  challenge: {
    id: string;
    ref: string;
    title: string;
    district: string;
    status: string;
    closed: boolean;
  } | null;
}

interface Project {
  id: string;
  ref: string;
  title: string;
  district: string;
  status: string;
  closed: boolean;
  my_contributions: number;
  my_money: number;
  stages_total: number;
  stages_done: number;
  progress_pct: number | null;
  latest_update: { note: string; at: string; photos: string[] } | null;
  days_since_update: number | null;
}

const STATE_STYLE: Record<string, string> = {
  offered: 'bg-gray-100 text-gray-700',
  committed: 'bg-blue-50 text-blue-800 border border-blue-200',
  dispatched: 'bg-amber-100 text-amber-800 border border-amber-300',
  received: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  withdrawn: 'bg-red-50 text-red-700',
};

export default function MyContributionsPage() {
  const { organisation } = useAuth();
  const [data, setData] = useState<{
    contributions: Contribution[];
    projects: Project[];
    totals: Record<string, number> | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await fetchMyContributions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your contributions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;
  const openProjects = (data?.projects ?? []).filter((p) => !p.closed);
  const closedProjects = (data?.projects ?? []).filter((p) => p.closed);

  return (
    <RoleGuard
      allowedRoles={['industry', 'university', 'admin']}
      consoleTitle="My Contributions"
    >
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Stage 4 and 5 · Sponsorship and delivery
              </div>
              <h1 className="text-2xl font-extrabold text-[#102027] tracking-tight">
                What you have given
              </h1>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                {organisation
                  ? `Everything ${organisation.name} has pledged, its delivery state, and the projects it funded — including the finished ones.`
                  : 'Everything your organisation has pledged and what happened to it.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/needs"
                className="h-9 px-3 rounded-lg bg-[#102027] text-white text-xs font-semibold flex items-center hover:bg-[#1D3540]"
              >
                Find something to fund
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

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Funding given
              </div>
              <div className="text-2xl font-extrabold font-mono text-[#102027]">
                {t?.money ? formatIndianCurrency(t.money) : '—'}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Lines taken
              </div>
              <div className="text-2xl font-extrabold font-mono text-[#102027]">
                {t?.lines ?? '—'}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] tracking-wider uppercase text-emerald-700 mb-1">
                Confirmed received
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-700">
                {t?.delivered ?? '—'}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Awaiting dispatch
              </div>
              <div className="text-2xl font-extrabold font-mono text-[#102027]">
                {t?.awaiting_dispatch ?? '—'}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] tracking-wider uppercase text-amber-800 mb-1">
                With the college
              </div>
              <div className="text-2xl font-extrabold font-mono text-amber-800">
                {t?.awaiting_confirmation ?? '—'}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">awaiting confirmation</div>
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
          ) : (data?.contributions ?? []).length === 0 ? (
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-10 text-center">
              <Package className="w-7 h-7 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#102027]">
                You have not pledged anything yet
              </p>
              <p className="text-xs text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                Open lines across every funded project are on the marketplace.
                You can take part of a line — another partner can take the rest.
              </p>
              <Link
                href="/needs"
                className="inline-flex mt-4 h-9 px-4 rounded-lg bg-[#102027] text-white text-xs font-semibold items-center hover:bg-[#1D3540]"
              >
                Browse open needs
              </Link>
            </div>
          ) : (
            <>
              {/* contributions */}
              <section>
                <h2 className="font-bold text-[#102027] mb-2">Every pledge</h2>
                <div className="bg-white rounded-xl border border-[#CCD1C7] divide-y divide-[#CCD1C7]">
                  {(data?.contributions ?? []).map((c) => (
                    <div key={c.id} className="p-4 flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={`font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded uppercase ${
                              STATE_STYLE[c.state] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {c.state}
                          </span>
                          {c.challenge?.closed && (
                            <span className="font-mono text-[10px] text-gray-500 flex items-center gap-1">
                              <Archive className="w-3 h-3" /> project closed
                            </span>
                          )}
                          {c.awaiting && (
                            <span className="font-mono text-[10px] text-amber-800 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> waiting on {c.awaiting}
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-sm text-[#102027]">
                          {c.kind === 'money'
                            ? formatIndianCurrency(c.qty)
                            : `${formatIndianNumber(c.qty)} ${c.need?.unit ?? ''}`}{' '}
                          <span className="font-normal text-gray-600">
                            {c.need?.item ? `· ${c.need.item}` : ''}
                          </span>
                        </div>
                        {c.challenge && (
                          <Link
                            href={`/challenge/${c.challenge.ref}`}
                            className="text-xs text-[#2E7180] hover:underline"
                          >
                            {c.challenge.ref} · {c.challenge.title}
                          </Link>
                        )}
                        {c.receipt_note && (
                          <p className="text-[11px] text-emerald-800 mt-1 flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            {c.receipt_note}
                          </p>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500 text-right shrink-0 leading-relaxed">
                        <div>pledged {new Date(c.created_at).toLocaleDateString('en-IN')}</div>
                        {c.dispatched_at && (
                          <div className="flex items-center gap-1 justify-end">
                            <Truck className="w-3 h-3" />
                            {new Date(c.dispatched_at).toLocaleDateString('en-IN')}
                          </div>
                        )}
                        {c.received_at && (
                          <div className="text-emerald-700">
                            received {new Date(c.received_at).toLocaleDateString('en-IN')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* projects */}
              {[
                { label: 'Projects you are funding', list: openProjects },
                { label: 'Finished projects', list: closedProjects },
              ]
                .filter((g) => g.list.length > 0)
                .map((g) => (
                  <section key={g.label}>
                    <h2 className="font-bold text-[#102027] mb-2">{g.label}</h2>
                    <div className="grid md:grid-cols-2 gap-3">
                      {g.list.map((p) => (
                        <div
                          key={p.id}
                          className="bg-white rounded-xl border border-[#CCD1C7] p-4"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <Link
                              href={`/challenge/${p.ref}`}
                              className="font-semibold text-sm text-[#102027] hover:text-[#2E7180] leading-snug"
                            >
                              {p.title}
                            </Link>
                            <span className="font-mono text-[10px] text-gray-500 shrink-0">
                              {p.ref}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-gray-500 mb-2.5">
                            {p.district} · {String(p.status).replace(/_/g, ' ')} ·{' '}
                            {p.my_contributions} pledge{p.my_contributions === 1 ? '' : 's'} from you
                          </div>

                          {p.stages_total > 0 ? (
                            <>
                              <div className="flex items-center justify-between font-mono text-[10px] text-gray-500 mb-1">
                                <span>
                                  {p.stages_done} of {p.stages_total} stages done
                                </span>
                                <span>{p.progress_pct}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-[#E9EEEB] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#2E7180]"
                                  style={{ width: `${p.progress_pct ?? 0}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <p className="font-mono text-[10px] text-gray-500">
                              No delivery plan published yet
                            </p>
                          )}

                          {p.latest_update ? (
                            <p className="text-[11px] text-gray-700 mt-2.5 leading-relaxed">
                              <span className="font-mono text-[10px] text-gray-500">
                                {p.days_since_update === 0
                                  ? 'today'
                                  : `${p.days_since_update}d ago`}
                                {' · '}
                              </span>
                              {p.latest_update.note.slice(0, 130)}
                            </p>
                          ) : (
                            <p className="text-[11px] text-gray-500 mt-2.5">
                              No progress update posted yet.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
            </>
          )}
        </main>
      </div>
    </RoleGuard>
  );
}
