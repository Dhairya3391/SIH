'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RefreshCw, 
  MapPin, 
  Users, 
  Flame, 
  CheckCircle2, 
  ChevronDown,
  ShieldQuestion,
  Wrench,
  PlusCircle,
  Loader2
} from 'lucide-react';
import { fetchChallenges, fetchChallengeDetail } from '@/lib/api';
import { Challenge, ScoreBreakdown } from '@/types/database';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';

export default function QueuePage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      let customList: any[] = [];
      try {
        const saved = localStorage.getItem('jharsetu_custom_challenges');
        if (saved) customList = JSON.parse(saved);
      } catch {}

      const res = await fetchChallenges();
      if (res.data) {
        setChallenges([...customList, ...res.data]);
      } else if (customList.length > 0) {
        setChallenges(customList);
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Top 3 urgent challenges for "Needs Immediate Action" strip
  const immediateActionChallenges = challenges.slice(0, 3);
  const remainingChallenges = challenges.slice(3);

  const getPriorityChip = (score: number) => {
    if (score >= 75) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D94F45] animate-pulse" />
          {score} · CRITICAL
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-[#E07B2E]/15 text-[#9A4A12] border border-[#E07B2E]/30">
          {score} · HIGH
        </span>
      );
    }
    if (score >= 25) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-[#E5A83B]/15 text-[#8A5A00] border border-[#E5A83B]/30">
          {score} · MODERATE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-[#3867A6]/15 text-[#3867A6] border border-[#3867A6]/30">
        {score} · LONG-TERM
      </span>
    );
  };

  return (
    <RouteGuard allowedRoles={['coordinator', 'admin']} consoleTitle="Coordinator Operations Console">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />
      <header className="bg-white border-b border-[#CCD1C7] px-4 py-3 sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-[#102027]">
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Coordinator Operations Console</span>
              <span className="text-[11px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                Live Queue
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-[#CCD1C7] hover:bg-gray-100 transition text-gray-600 flex items-center gap-1 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/report"
              className="bg-[#2E7180] hover:bg-[#245A66] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Submit New
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6">
        {/* 1. "NEEDS IMMEDIATE ACTION" STRIP */}
        <section className="bg-white rounded-2xl border-2 border-[#D94F45]/30 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-red-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-[#D94F45]/10 rounded-lg text-[#D94F45]">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#A8332A] uppercase tracking-wider font-mono">
                  Needs Immediate Action (Top Priority Hotspots)
                </h2>
                <p className="text-[11px] text-gray-500">
                  Ranked by multi-factor vulnerability and severity formula
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-[#D94F45] bg-red-50 px-2 py-0.5 rounded">
              3 Critical Items
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {immediateActionChallenges.map((item) => (
              <div 
                key={item.id} 
                className="bg-[#F4F6F5] p-3.5 rounded-xl border border-[#CCD1C7] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    {getPriorityChip(item.priority)}
                    <span className="text-[10px] font-mono text-gray-500 uppercase">{item.district}</span>
                  </div>
                  <h3 className="text-xs font-bold text-[#102027] line-clamp-2 mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-gray-600 line-clamp-2 mb-2">
                    {item.problem}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[11px]">
                  <span className="font-mono text-gray-500">{item.people_est} affected</span>
                  <span className="font-bold text-[#2E7180] hover:underline cursor-pointer">
                    Review Brief →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2. THE COMPLETE RANKED QUEUE */}
        <section className="bg-white rounded-2xl border border-[#CCD1C7] overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#CCD1C7] flex items-center justify-between">
            <h2 className="font-bold text-sm text-[#102027]">
              All Active Challenges ({challenges.length})
            </h2>
            <span className="text-xs text-gray-500 font-mono">
              Auto-refreshes on ground intake
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs text-gray-500">
              Loading queue...
            </div>
          ) : (
            <div className="divide-y divide-[#CCD1C7]">
              {challenges.map((challenge, idx) => (
                <div key={challenge.id}>
                <div className="p-4 hover:bg-[#F4F6F5]/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-mono text-xs font-bold text-gray-500 shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {getPriorityChip(challenge.priority)}
                        <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded capitalize">
                          {String(challenge.category).replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {challenge.district}
                        </span>
                      </div>
                      <Link href={`/challenge/${challenge.ref}`} className="hover:underline">
                        <h4 className="text-sm font-bold text-[#102027]">
                          {challenge.title}
                        </h4>
                      </Link>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {challenge.people_est} people
                        </span>
                        <span>·</span>
                        <span className="font-mono">{challenge.report_count} reports</span>
                        <span>·</span>
                        <span className="text-xs font-mono font-semibold text-[#2E7180]">
                          {challenge.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => setOpenId(openId === challenge.id ? null : challenge.id)}
                      aria-expanded={openId === challenge.id}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${openId === challenge.id ? 'bg-[#2E7180] border-[#2E7180] text-white' : 'border-[#2E7180] text-[#2E7180] hover:bg-teal-50'}`}
                    >
                      {openId === challenge.id ? 'Hide Brief' : 'Inspect Brief'}
                      <ChevronDown className={`w-3 h-3 transition-transform ${openId === challenge.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
                {openId === challenge.id && <ScoreBrief challenge={challenge} />}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      </div>
    </RouteGuard>
  );
}

const FACTORS: { key: keyof Omit<ScoreBreakdown, 'why_critical'>; label: string; max: number }[] = [
  { key: 'severity', label: 'Severity of harm', max: 25 },
  { key: 'urgency', label: 'Time urgency', max: 15 },
  { key: 'people_affected', label: 'People affected', max: 15 },
  { key: 'vulnerability', label: 'Vulnerable groups', max: 15 },
  { key: 'hazard_exposure', label: 'Hazard exposure', max: 10 },
  { key: 'resource_gap', label: 'Resource gap', max: 10 },
  { key: 'recurrence', label: 'Recurrence', max: 5 },
  { key: 'community_signal', label: 'Community signal (capped)', max: 5 },
];

type Factor = { key: string; label: string; max: number; points: number; reason?: string };

/**
 * The backend stores score_breakdown as { total, factors:[{key,label,max,points,reason}] };
 * the older intake route wrote flat { severity: 25, urgency: 12, ... }. Read both, so the
 * panel keeps working whichever service answered.
 */
function readFactors(sb: any): Factor[] {
  if (!sb) return [];
  if (Array.isArray(sb.factors)) {
    return sb.factors.map((f: any) => ({
      key: String(f.key),
      label: String(f.label ?? f.key),
      max: Number(f.max ?? 0),
      points: Number(f.points ?? 0),
      reason: f.reason ? String(f.reason) : undefined,
    }));
  }
  return FACTORS.map((f) => ({
    key: f.key as string,
    label: f.label,
    max: f.max,
    points: Number(sb[f.key] ?? 0),
  }));
}

function ScoreBrief({ challenge }: { challenge: Challenge }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchChallengeDetail(challenge.ref || challenge.id)
      .then((res) => {
        if (active) {
          setDetail(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load challenge detail:', err);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [challenge.ref, challenge.id]);

  const sb = challenge.score_breakdown as any;
  const factors = readFactors(sb);
  const c = detail?.challenge || challenge;

  return (
    <div className="px-4 pb-4 pt-1 bg-[#F4F6F5] border-t border-dashed border-[#CCD1C7]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Explainable score */}
        <div className="bg-white rounded-xl border border-[#CCD1C7] p-3">
          <div className="flex items-baseline justify-between mb-2.5">
            <h5 className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Why this rank
            </h5>
            <span className="font-mono text-sm font-bold text-[#102027]">
              {challenge.priority}<span className="text-gray-400 text-xs">/100</span>
            </span>
          </div>
          {factors.length > 0 ? (
            <div className="space-y-2">
              {factors.map((f) => {
                const pct = f.max > 0 ? Math.max(0, Math.min(100, (f.points / f.max) * 100)) : 0;
                return (
                  <div key={f.key}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 w-36 shrink-0">{f.label}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#2E7180]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-gray-500 w-12 text-right tabular-nums">
                        {Math.round(f.points * 10) / 10}/{f.max}
                      </span>
                    </div>
                    {f.reason && (
                      <p className="text-[10.5px] leading-snug text-gray-400 ml-[9.5rem] mt-0.5">
                        {f.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">
              No factor breakdown stored for this challenge yet.
            </p>
          )}
          {sb?.why_critical && (
            <p className="mt-2.5 pt-2.5 border-t border-gray-100 text-[11px] leading-relaxed text-[#102027]">
              <span className="font-bold">Verdict: </span>{sb.why_critical}
            </p>
          )}
        </div>

        {/* Brief + honesty panel */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-[#CCD1C7] p-3">
            <h5 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5 flex items-center justify-between">
              <span>Compiled brief · {c.ref ?? challenge.id}</span>
              {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
            </h5>
            <p className="text-[11px] leading-relaxed text-gray-700">
              {loading ? <span className="text-gray-400">Loading brief...</span> : c.problem}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-gray-600">
                confidence: {String(challenge.confidence || 'unverified').replace(/_/g, ' ')}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-gray-600">
                {challenge.report_count} reports merged
              </span>
              {c.compiler_source && (
                <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-gray-600">
                  compiled by: {c.compiler_source === 'fallback' ? 'rule engine' : c.compiler_source}
                </span>
              )}
            </div>
          </div>

          {(c.outcome || c.needs?.length > 0) && (
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-3">
              <h5 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                What good looks like
              </h5>
              {c.outcome && (
                <p className="text-[11px] leading-relaxed text-gray-700 mb-1.5">{c.outcome}</p>
              )}
              {c.needs?.length > 0 && (
                <ul className="space-y-0.5">
                  {c.needs.map((n: string) => (
                    <li key={n} className="text-[11px] text-gray-600 flex gap-1.5">
                      <span className="text-[#2E7180]">·</span>{n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {challenge.capabilities_needed?.length > 0 && (
            <div className="bg-white rounded-xl border border-[#CCD1C7] p-3">
              <h5 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Wrench className="w-3 h-3" /> Capabilities needed
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {challenge.capabilities_needed.map((c: string) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded-full bg-teal-50 border border-[#2E7180]/30 text-[10px] font-semibold text-[#2E7180]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
            <h5 className="text-[11px] font-bold uppercase tracking-wide text-amber-800 mb-1 flex items-center gap-1.5">
              <ShieldQuestion className="w-3 h-3" /> What the AI is unsure about
            </h5>
            <p className="text-[11px] leading-relaxed text-amber-900">
              {challenge.ai_unsure_about ||
                'Nothing flagged. A human coordinator must still confirm before resources move.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
