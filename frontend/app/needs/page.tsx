'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  Filter,
  MapPin,
  Package,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import {
  ContributionSplitter,
  formatIndianCurrency,
  formatIndianNumber,
} from '@/components/shared/ContributionSplitter';
import { fetchNeeds, pledgeResource } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * The contribution marketplace.
 *
 * Every line shows what REMAINS, not what was originally asked for, because
 * the mechanic the whole pitch turns on is two contributors closing one line
 * between them: 12 units needed, 5 taken by someone else, 7 left for you.
 */

interface NeedRow {
  need_id: string;
  item: string;
  unit: string | null;
  kind: string;
  capability: string | null;
  qty_needed: number;
  qty_pledged: number;
  qty_remaining: number;
  pct_closed: number;
  contributor_count: number;
  challenge: {
    id: string;
    ref: string;
    title: string;
    district: string;
    category: string;
    priority: number;
    people_est: number;
    age_days: number;
  };
}

const KIND_LABEL: Record<string, string> = {
  money: 'Funding',
  equipment: 'Materials',
  people: 'People',
  expertise: 'Expertise',
};

export default function NeedsMarketplacePage() {
  const { organisation } = useAuth();
  const [rows, setRows] = useState<NeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [district, setDistrict] = useState('all');
  const [kind, setKind] = useState('all');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetchNeeds({
        district: district === 'all' ? undefined : district,
        kind: kind === 'all' ? undefined : kind,
        limit: 80,
      });
      setRows(res.needs as NeedRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load open needs.');
    } finally {
      setLoading(false);
    }
  }, [district, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const districts = useMemo(
    () => [...new Set(rows.map((r) => r.challenge.district))].sort(),
    [rows],
  );

  const totals = useMemo(() => {
    const money = rows.filter((r) => r.kind === 'money');
    const material = rows.filter((r) => r.kind !== 'money');
    return {
      lines: rows.length,
      challenges: new Set(rows.map((r) => r.challenge.ref)).size,
      moneyRemaining: money.reduce((s, r) => s + r.qty_remaining, 0),
      materialLines: material.length,
      partlyClosed: rows.filter((r) => r.qty_pledged > 0).length,
    };
  }, [rows]);

  const onPledge = async (row: NeedRow, amount: number, note?: string) => {
    if (!organisation?.id) {
      throw new Error('This account is not linked to an organisation, so it cannot pledge yet.');
    }
    await pledgeResource(row.challenge.id, {
      need_id: row.need_id,
      org_id: organisation.id,
      qty: amount,
      kind: row.kind,
      note: note || `Pledged via the needs marketplace`,
    });
    await load();
  };

  return (
    <RoleGuard
      allowedRoles={['industry', 'university', 'coordinator', 'admin']}
      consoleTitle="Contribution Marketplace"
    >
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Stage 4 · Fractional CSR and NGO sponsorship
              </div>
              <h1 className="text-2xl font-extrabold text-[#102027] tracking-tight">
                What still needs covering
              </h1>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                Open lines across every funded project. You can take part of a
                line — another partner can take the rest.
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

          {/* live totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Open lines
              </div>
              <div className="text-2xl font-extrabold font-mono text-[#102027]">
                {totals.lines}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                across {totals.challenges} projects
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Funding still open
              </div>
              <div className="text-2xl font-extrabold font-mono text-[#102027]">
                {totals.moneyRemaining > 0 ? formatIndianCurrency(totals.moneyRemaining) : '—'}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">across all money lines</div>
            </div>
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                Material lines
              </div>
              <div className="text-2xl font-extrabold font-mono text-[#102027]">
                {totals.materialLines}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">equipment and supplies</div>
            </div>
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-4">
              <div className="font-mono text-[10px] tracking-wider uppercase text-emerald-700 mb-1">
                Part-covered
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-700">
                {totals.partlyClosed}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                someone has already started these
              </div>
            </div>
          </div>

          {/* filters */}
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
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-[#CCD1C7] bg-[#F4F6F5] text-xs outline-none focus:border-[#2E7180]"
            >
              <option value="all">Funding and materials</option>
              <option value="money">Funding only</option>
              <option value="equipment">Materials only</option>
              <option value="people">People</option>
              <option value="expertise">Expertise</option>
            </select>
            {organisation && (
              <span className="ml-auto text-[11px] text-gray-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Pledging as{' '}
                <strong className="text-[#102027]">{organisation.name}</strong>
              </span>
            )}
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

          {/* the lines */}
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : rows.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-10 text-center">
              <Package className="w-7 h-7 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#102027]">
                Nothing is waiting for a contribution right now
              </p>
              <p className="text-xs text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                Lines appear here once a college wins a proposal and publishes
                what it needs. Every line already open has been fully covered.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <article
                  key={row.need_id}
                  className="bg-white rounded-xl border border-[#CCD1C7] overflow-hidden"
                >
                  <div className="p-4 border-b border-[#CCD1C7] flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#102027] text-white">
                          {KIND_LABEL[row.kind] ?? row.kind}
                        </span>
                        {row.challenge.priority >= 75 && (
                          <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800">
                            CRITICAL {row.challenge.priority}
                          </span>
                        )}
                        {row.qty_pledged > 0 && (
                          <span className="font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {row.pct_closed}% COVERED
                          </span>
                        )}
                        {row.capability && (
                          <span className="font-mono text-[10px] text-gray-500 border border-[#CCD1C7] px-1.5 py-0.5 rounded">
                            {row.capability}
                          </span>
                        )}
                      </div>
                      <h2 className="font-bold text-[#102027]">{row.item}</h2>
                      <Link
                        href={`/challenge/${row.challenge.ref}`}
                        className="text-xs text-[#2E7180] hover:underline mt-1 inline-block"
                      >
                        {row.challenge.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 font-mono text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {row.challenge.district}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />{' '}
                          {formatIndianNumber(row.challenge.people_est)} people
                        </span>
                        <span>{row.challenge.ref}</span>
                        <span>open {row.challenge.age_days}d</span>
                        {row.contributor_count > 0 && (
                          <span className="text-emerald-700">
                            {row.contributor_count} partner
                            {row.contributor_count === 1 ? '' : 's'} already in
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                        Remaining
                      </div>
                      <div className="text-xl font-extrabold font-mono text-[#102027]">
                        {row.kind === 'money'
                          ? formatIndianCurrency(row.qty_remaining)
                          : `${formatIndianNumber(row.qty_remaining)} ${row.unit ?? ''}`}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500">
                        of {formatIndianNumber(row.qty_needed)} {row.unit ?? ''}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#F4F6F5]">
                    <ContributionSplitter
                      itemName={row.item}
                      totalNeeded={row.qty_needed}
                      alreadyPledged={row.qty_pledged}
                      unit={row.unit ?? 'units'}
                      isCurrency={row.kind === 'money'}
                      orgName={organisation?.name}
                      disabled={!organisation}
                      onPledge={(amount, note) => onPledge(row, amount, note)}
                    />
                    {!organisation && (
                      <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" />
                        This account has no organisation attached, so it can
                        browse but not pledge.
                      </p>
                    )}
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
