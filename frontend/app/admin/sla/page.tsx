'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Gauge, RefreshCw, TrendingDown } from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { LoadingSkeleton } from '@/components/shell/LoadingSkeleton';
import { fetchSla } from '@/lib/api';

/**
 * Actual against target, per stage and per district.
 *
 * A stage nobody has completed shows "not measured yet", never 100%.
 * Attainment of nothing is not perfect attainment, and a government sponsor
 * reading a green gauge over an empty sample is being misled.
 */

interface Breach {
  challenge_id: string;
  ref: string;
  district: string;
  hours: number;
}
interface Stage {
  stage_key: string;
  label: string;
  target_hours: number;
  sample_size: number;
  median_hours: number | null;
  worst_hours: number | null;
  attainment_pct: number | null;
  breaches: Breach[];
}
interface DistrictRow {
  district: string;
  sample_size: number;
  attainment_pct: number;
  mean_hours: number;
}

function hoursLabel(h: number | null): string {
  if (h === null) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${Math.round(h * 10) / 10}h`;
  return `${Math.round(h / 24)}d`;
}

function Gauge_({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="font-mono text-[11px] text-gray-400">not measured yet</span>
    );
  }
  const tone =
    pct >= 90 ? 'bg-emerald-600' : pct >= 70 ? 'bg-amber-500' : 'bg-[#A8332A]';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full bg-[#E9EEEB] overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] font-semibold tabular-nums w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}

export default function SlaPage() {
  const [data, setData] = useState<{
    stages: Stage[];
    by_district: DistrictRow[];
    overall: { sample_size: number; stages_measured: number; stages_total: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await fetchSla());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load SLA data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <RouteGuard allowedRoles={['admin']} consoleTitle="SLA and Timings">
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Link
                href="/admin"
                className="font-mono text-[10px] tracking-wider uppercase text-[#2E7180] hover:underline flex items-center gap-1 mb-1"
              >
                <ArrowLeft className="w-3 h-3" /> Command centre
              </Link>
              <h1 className="text-2xl font-extrabold text-[#102027] tracking-tight">
                How long each stage actually takes
              </h1>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                Measured from the record, against the target for each stage.
                Where nothing has completed yet, this says so rather than
                showing a green gauge over an empty sample.
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
              <div className="bg-white rounded-xl border border-[#CCD1C7] p-4 flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                    Intervals measured
                  </div>
                  <div className="text-xl font-extrabold font-mono">
                    {data?.overall.sample_size ?? 0}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500">
                    Stages with data
                  </div>
                  <div className="text-xl font-extrabold font-mono">
                    {data?.overall.stages_measured ?? 0}
                    <span className="text-gray-400 text-sm"> / {data?.overall.stages_total ?? 0}</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 max-w-md leading-relaxed self-center">
                  Stages fill in as challenges pass through them. A brand-new
                  deployment measures almost nothing, and that is the honest
                  reading rather than a fault.
                </p>
              </div>

              {/* per stage */}
              <section>
                <h2 className="font-bold text-[#102027] mb-2 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-[#2E7180]" /> By stage
                </h2>
                <div className="bg-white rounded-xl border border-[#CCD1C7] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[760px]">
                      <thead>
                        <tr className="bg-[#F4F6F5] border-b border-[#CCD1C7]">
                          {['Stage', 'Target', 'Median', 'Worst', 'n', 'Attainment'].map((h) => (
                            <th
                              key={h}
                              className="text-left font-mono text-[10px] tracking-wider uppercase text-gray-500 px-4 py-2.5 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.stages ?? []).map((s) => (
                          <tr key={s.stage_key} className="border-b border-[#DFE4DC] last:border-0">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#102027]">{s.label}</div>
                              <div className="font-mono text-[10px] text-gray-500">
                                {s.stage_key}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-600 tabular-nums">
                              {hoursLabel(s.target_hours)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums">
                              {hoursLabel(s.median_hours)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-600 tabular-nums">
                              {hoursLabel(s.worst_hours)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500 tabular-nums">
                              {s.sample_size}
                            </td>
                            <td className="px-4 py-3">
                              <Gauge_ pct={s.attainment_pct} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* breaches */}
              {(data?.stages ?? []).some((s) => s.breaches.length > 0) && (
                <section>
                  <h2 className="font-bold text-[#102027] mb-2">Where the target was missed</h2>
                  <div className="space-y-2">
                    {(data?.stages ?? [])
                      .filter((s) => s.breaches.length > 0)
                      .map((s) => (
                        <div
                          key={s.stage_key}
                          className="bg-white rounded-xl border border-[#CCD1C7] p-3"
                        >
                          <div className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-2">
                            {s.label} · target {hoursLabel(s.target_hours)}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {s.breaches.map((b) => (
                              <Link
                                key={`${s.stage_key}-${b.challenge_id}`}
                                href={`/admin/challenges/${b.ref}`}
                                className="font-mono text-[11px] bg-red-50 border border-red-200 text-red-800 rounded px-2 py-1 hover:border-red-400"
                              >
                                {b.ref} · {b.district} · {hoursLabel(b.hours)}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* per district */}
              <section>
                <h2 className="font-bold text-[#102027] mb-2 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[#A8332A]" /> By district, worst first
                </h2>
                {(data?.by_district ?? []).length === 0 ? (
                  <div className="bg-white rounded-xl border border-[#CCD1C7] p-6 text-center text-xs text-gray-500">
                    No district has enough completed intervals to compare yet.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-[#CCD1C7] divide-y divide-[#DFE4DC]">
                    {(data?.by_district ?? []).map((d) => (
                      <div key={d.district} className="p-3 flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-sm text-[#102027] w-36">
                          {d.district}
                        </span>
                        <Gauge_ pct={d.attainment_pct} />
                        <span className="font-mono text-[10px] text-gray-500">
                          n={d.sample_size} · mean {hoursLabel(d.mean_hours)}
                        </span>
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
