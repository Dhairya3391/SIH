'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  ClipboardCheck, 
  Filter, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  CloudRain, 
  ExternalLink, 
  ArrowRight, 
  Layers, 
  Clock, 
  FileText,
  Search,
  Sparkles,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { Category, PriorityBand } from '@/types/database';

export interface UnverifiedReport {
  id: string;
  ref: string;
  district: string;
  block: string;
  category: Category;
  hazard: string;
  priority: number;
  priorityBand: PriorityBand;
  reportCount: number;
  summary: string;
  submittedAgo: string;
  aiVerdict: 'corroborated' | 'contradicted' | 'nothing_found';
  aiConfidence: number; // e.g. 88%
  weatherCondition?: string;
  weatherProvider?: string;
  weatherEstimateType?: 'point' | 'district';
  newsCount: number;
  contradictionFlag?: string;
  clusterMembers: Array<{ id: string; text: string; village: string; time: string }>;
}

export const SEED_UNVERIFIED_REPORTS: UnverifiedReport[] = [
  {
    id: 'rep-gum-01',
    ref: 'C-GUM-100',
    district: 'Gumla',
    block: 'Sisai & Bharno',
    category: 'disaster',
    hazard: 'Lightning Storm',
    priority: 82,
    priorityBand: 'critical',
    reportCount: 31,
    summary: 'High flash rate lightning strikes in open paddy fields with 2 fatalities. Community requests acoustic siren alert relay from panchayat.',
    submittedAgo: '2 hours ago',
    aiVerdict: 'corroborated',
    aiConfidence: 92,
    weatherCondition: 'Cloud-to-ground flash rate 48 strikes/hr, severe thunderstorm cell detected',
    weatherProvider: 'IMD Mausam / Damini Doppler API',
    weatherEstimateType: 'point',
    newsCount: 2,
    clusterMembers: [
      { id: 'rep-1', village: 'Sisai', text: 'Bijli girne se kisan ki maut khet me, siren lagao', time: '10:15 AM' },
      { id: 'rep-2', village: 'Bharno', text: 'Lightning strike 2 casualties, no mobile alert received', time: '11:00 AM' },
      { id: 'rep-3', village: 'Sisai Block', text: 'Thunderstorm heavy, field workers trapped without shelter', time: '11:20 AM' },
    ],
  },
  {
    id: 'rep-sah-02',
    ref: 'C-SAH-204',
    district: 'Sahebganj',
    block: 'Rajmahal',
    category: 'water',
    hazard: 'Ganga Flood Overflow',
    priority: 76,
    priorityBand: 'critical',
    reportCount: 14,
    summary: 'Water level +1.4m above danger mark. Drinking water handpumps submerged with silt in Diara villages.',
    submittedAgo: '4 hours ago',
    aiVerdict: 'corroborated',
    aiConfidence: 89,
    weatherCondition: 'River stage 27.65m (0.45m above danger level), discharge 18,400 m3/s',
    weatherProvider: 'Central Water Commission (CWC) Telemetry',
    weatherEstimateType: 'point',
    newsCount: 3,
    clusterMembers: [
      { id: 'rep-4', village: 'Rajmahal Diara', text: 'Ganga pani ghus gaya, peene ka pani nahi', time: '8:30 AM' },
      { id: 'rep-5', village: 'Kalyanpur', text: 'All handpumps muddy flood water', time: '9:15 AM' },
    ],
  },
  {
    id: 'rep-dhn-03',
    ref: 'C-DHN-301',
    district: 'Dhanbad',
    block: 'Jharia',
    category: 'roads',
    hazard: 'Coal Seam Fire Subsidence',
    priority: 68,
    priorityBand: 'high',
    reportCount: 8,
    summary: 'Underground coal fire smoke fissures opened along settlement road near Jharia fire zone #4.',
    submittedAgo: '6 hours ago',
    aiVerdict: 'nothing_found',
    aiConfidence: 45,
    weatherCondition: 'Surface ambient 38°C, thermal satellite resolution obscured by smog',
    weatherProvider: 'MODIS / Sentinel-3 Thermal Anomaly',
    weatherEstimateType: 'district',
    newsCount: 0,
    clusterMembers: [
      { id: 'rep-6', village: 'Jharia Ward 4', text: 'Road cracked with smoke venting', time: 'Yesterday' },
    ],
  },
  {
    id: 'rep-pal-04',
    ref: 'C-PAL-402',
    district: 'Palamu',
    block: 'Medininagar',
    category: 'agriculture',
    hazard: 'Flash Drought',
    priority: 54,
    priorityBand: 'high',
    reportCount: 5,
    summary: 'Paddy nursery drying up due to 18 consecutive dry days in mid-monsoon. Requesting community diesel pump relay.',
    submittedAgo: '1 day ago',
    aiVerdict: 'contradicted',
    aiConfidence: 61,
    weatherCondition: 'Rainfall recorded: 14mm in last 48 hours at Medininagar IMD automated weather station',
    weatherProvider: 'IMD District Agromet Unit Palamu',
    weatherEstimateType: 'district',
    contradictionFlag: 'IMD rain gauge recorded 14mm rainfall nearby, but farmer reports dry nurseries in micro-pocket. Ground check advised.',
    newsCount: 0,
    clusterMembers: [
      { id: 'rep-7', village: 'Chainpur', text: 'Paddy seedling scorched, check local canal branch', time: '2 days ago' },
    ],
  },
];

export default function VerifierQueuePage() {
  const [reports, setReports] = useState<UnverifiedReport[]>(SEED_UNVERIFIED_REPORTS);
  const [districtFilter, setDistrictFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [clearedCount, setClearedCount] = useState(0);

  // Quick inline actions for acceptance: verifier clears items without leaving console
  const handleInlineVerify = (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    setClearedCount((c) => c + 1);
  };

  const handleInlineReject = (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    setClearedCount((c) => c + 1);
  };

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (districtFilter !== 'all' && r.district !== districtFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (verdictFilter !== 'all' && r.aiVerdict !== verdictFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.ref.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.hazard.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reports, districtFilter, categoryFilter, verdictFilter, searchQuery]);

  return (
    <RouteGuard allowedRoles={['volunteer', 'coordinator', 'admin']} consoleTitle="Verifier Console">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-5">
          {/* Header Banner */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                  Stage 2 · Ground Verification & Evidence
                </span>
                <span className="bg-[#2E7180]/10 text-[#245A66] px-2 py-0.5 rounded text-xs font-mono font-bold">
                  {reports.length} pending review
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027] mt-1">
                Triage & Verification Queue
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                Validate unverified citizen clusters against real meteorological telemetry and news reports before dispatching to engineering colleges.
              </p>
            </div>

            {clearedCount > 0 && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-2 font-mono text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  <strong>{clearedCount}</strong> reports verified/cleared this session!
                </span>
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#CCD1C7] flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-gray-500 font-bold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filters:
              </span>

              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="bg-[#F4F6F5] px-2.5 py-1.5 rounded-lg border border-[#CCD1C7] font-semibold font-mono"
              >
                <option value="all">All Districts</option>
                <option value="Gumla">Gumla</option>
                <option value="Sahebganj">Sahebganj</option>
                <option value="Dhanbad">Dhanbad</option>
                <option value="Palamu">Palamu</option>
              </select>

              <select
                value={verdictFilter}
                onChange={(e) => setVerdictFilter(e.target.value)}
                className="bg-[#F4F6F5] px-2.5 py-1.5 rounded-lg border border-[#CCD1C7] font-semibold font-mono"
              >
                <option value="all">All AI Verdicts</option>
                <option value="corroborated">Corroborated</option>
                <option value="contradicted">Contradicted</option>
                <option value="nothing_found">Nothing Found</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Search ref, hazard, summary..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-[#CCD1C7] font-mono text-xs outline-none focus:border-[#2E7180]"
                />
              </div>
            </div>

            <div className="font-mono text-xs text-gray-500">
              Ranked by Priority Score (Desc)
            </div>
          </div>

          {/* Queue Rows */}
          {filtered.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-dashed border-[#CCD1C7] text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-sm text-[#102027]">Verification Queue Clear</h3>
              <p className="text-xs text-gray-500">
                All citizen reports have been verified or resolved against current filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#CCD1C7] rounded-xl p-4 sm:p-5 hover:border-[#2E7180] transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Top badging row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                        {item.ref}
                      </span>

                      {/* Priority Badge */}
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                          item.priority >= 75
                            ? 'bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30'
                            : 'bg-[#E07B2E]/15 text-[#9A4A12] border border-[#E07B2E]/30'
                        }`}
                      >
                        PRIORITY {item.priority} · {item.priorityBand.toUpperCase()}
                      </span>

                      {/* AI Verdict Badge */}
                      {item.aiVerdict === 'corroborated' && (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Corroborated ({item.aiConfidence}%)
                        </span>
                      )}
                      {item.aiVerdict === 'contradicted' && (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          Contradicted Flag
                        </span>
                      )}
                      {item.aiVerdict === 'nothing_found' && (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-300">
                          No External Evidence Found
                        </span>
                      )}

                      <span className="text-[11px] font-mono text-gray-400">· {item.submittedAgo}</span>
                    </div>

                    {/* Problem Summary */}
                    <h3 className="text-sm font-bold text-[#102027] group-hover:text-[#2E7180] transition leading-snug">
                      {item.hazard}: {item.summary}
                    </h3>

                    {/* Meteorological and Cluster Details */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 font-mono">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#2E7180]" />
                        {item.block}, {item.district}
                      </span>

                      <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                        <Layers className="w-3 h-3 text-emerald-600" />
                        {item.reportCount} reports in cluster
                      </span>

                      {item.weatherCondition && (
                        <span className="flex items-center gap-1 text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-[11px] truncate max-w-sm">
                          <CloudRain className="w-3 h-3 text-sky-600 shrink-0" />
                          {item.weatherProvider}: {item.weatherCondition}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex md:flex-col items-center justify-end gap-2 shrink-0 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4">
                    <Link
                      href={`/verify/${item.id}`}
                      className="touch-target px-4 py-2 bg-[#2E7180] hover:bg-[#245A66] text-white text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-1.5 transition shadow-2xs w-full whitespace-nowrap"
                    >
                      <span>Corroboration Panel</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <div className="flex items-center gap-1.5 w-full">
                      <button
                        type="button"
                        onClick={() => handleInlineVerify(item.id)}
                        className="touch-target flex-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-mono font-bold flex items-center justify-center gap-1 transition"
                        title="Fast verify cluster"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Verify
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInlineReject(item.id)}
                        className="touch-target flex-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded text-xs font-mono font-bold flex items-center justify-center gap-1 transition"
                        title="Reject with consequence notice"
                      >
                        <XCircle className="w-3 h-3 text-red-600" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </RouteGuard>
  );
}
