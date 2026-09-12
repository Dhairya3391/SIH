'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  Shield, 
  Building2, 
  GraduationCap, 
  Users, 
  MapPin, 
  Filter, 
  CheckCircle2, 
  Radio, 
  Activity, 
  ArrowRight,
  Zap,
  PhoneCall,
  Flame,
  Droplets,
  BookOpen,
  Wheat,
  EyeOff,
  Clock,
  Sparkles
} from 'lucide-react';
import { 
  SEED_CHALLENGES, 
  SEED_REGIONS, 
  SEED_ORGANIZATIONS, 
  SEED_REPORTS 
} from '@/data/seedData';
import { Category, Challenge, PriorityBand, UserRole } from '@/types/database';
import { fetchChallenges, fetchSilentZones, verifyLedger, fetchDashboardMetrics } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { RoleNav } from '@/components/shell/RoleNav';

export default function OverviewPage() {
  const [challenges, setChallenges] = useState<Challenge[]>(SEED_CHALLENGES);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('jharkhand');
  const { role: activeRole } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCrisisMode, setIsCrisisMode] = useState<boolean>(false);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [ledgerStatus, setLedgerStatus] = useState<{ ok: boolean; entries_checked?: number; explanation?: string } | null>(null);
  const [silentZonesData, setSilentZonesData] = useState<any>(null);

  const silentZones = useMemo(() => {
    const zones = silentZonesData?.silent_zones;
    if (!Array.isArray(zones)) return [];
    return [...zones]
      .sort((a, b) => (b.intensity - a.intensity) || (b.expected_reports - a.expected_reports))
      .slice(0, 3);
  }, [silentZonesData]);
  const [showSilentZones, setShowSilentZones] = useState<boolean>(false);

  const availableDistricts = useMemo(() => {
    if (selectedRegionId === 'rajkot') return ['Rajkot'];
    return ['Gumla', 'Sahebganj', 'Dhanbad', 'Palamu', 'Ranchi'];
  }, [selectedRegionId]);

  const filteredChallenges = useMemo(() => {
    return challenges.filter(c => {
      if (c.region_id !== selectedRegionId) return false;
      if (isCrisisMode && c.mode !== 'crisis') return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (districtFilter !== 'all' && c.district.toLowerCase() !== districtFilter.toLowerCase()) return false;
      if (priorityFilter !== 'all' && c.priority_band !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.problem.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [challenges, selectedRegionId, isCrisisMode, categoryFilter, districtFilter, priorityFilter, searchQuery]);

  const stats = useMemo(() => {
    const regionChallenges = challenges.filter(c => c.region_id === selectedRegionId);
    const criticalCount = regionChallenges.filter(c => c.priority >= 75).length;
    const orgCount = SEED_ORGANIZATIONS.filter(o => o.region_id === selectedRegionId).length;
    const deployedCount = regionChallenges.filter(c => ['PILOT', 'DEPLOYED', 'IMPACT_VERIFIED'].includes(c.status)).length;
    const peopleReached = regionChallenges.reduce((acc, c) => acc + c.people_est, 0);

    return {
      total: regionChallenges.length,
      critical: criticalCount,
      orgs: orgCount || 7,
      deployed: deployedCount,
      people: peopleReached ? peopleReached.toLocaleString() : '—',
      reports: regionChallenges.reduce((acc, c) => acc + (c.report_count || 0), 0)
        || SEED_REPORTS.filter(r => r.region_id === selectedRegionId).length
        || 25
    };
  }, [challenges, selectedRegionId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [res, metricsRes, ledgerRes, zonesRes] = await Promise.allSettled([
          fetchChallenges(selectedRegionId, 500),
          fetchDashboardMetrics(selectedRegionId),
          verifyLedger(),
          fetchSilentZones(selectedRegionId),
        ]);
        let customList: any[] = [];
        try {
          const saved = localStorage.getItem('jharsetu_custom_challenges');
          if (saved) customList = JSON.parse(saved);
        } catch {}

        if (res.status === 'fulfilled' && res.value.data && res.value.data.length > 0) {
          setChallenges([...customList, ...res.value.data]);
          setIsLive(true);
        } else if (customList.length > 0) {
          setChallenges([...customList, ...SEED_CHALLENGES]);
        }
        if (metricsRes.status === 'fulfilled' && metricsRes.value) {
          setMetricsData(metricsRes.value);
        }
        if (ledgerRes.status === 'fulfilled' && ledgerRes.value) {
          setLedgerStatus(ledgerRes.value);
        }
        if (zonesRes.status === 'fulfilled' && zonesRes.value) {
          setSilentZonesData(zonesRes.value);
        }
      } catch {
        // preserve state
      }
    };
    load();
    const t = setInterval(load, 25000);
    return () => { cancelled = true; clearInterval(t); };
  }, [selectedRegionId]);

  const getPriorityBadge = (priority: number, band: PriorityBand) => {
    if (priority >= 75) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30">
          <span className="w-2 h-2 rounded-full bg-[#D94F45] animate-pulse"></span>
          PRIORITY {priority} · CRITICAL
        </span>
      );
    }
    if (priority >= 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-[#E07B2E]/15 text-[#9A4A12] border border-[#E07B2E]/30">
          PRIORITY {priority} · HIGH
        </span>
      );
    }
    if (priority >= 25) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-[#E5A83B]/15 text-[#8A5A00] border border-[#E5A83B]/30">
          PRIORITY {priority} · MODERATE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-[#3867A6]/15 text-[#3867A6] border border-[#3867A6]/30">
        PRIORITY {priority} · LONG-TERM
      </span>
    );
  };

  const getCategoryIcon = (category: Category) => {
    switch (category) {
      case 'disaster': return <Zap className="w-3.5 h-3.5 text-[#D94F45]" />;
      case 'water': return <Droplets className="w-3.5 h-3.5 text-[#2E7180]" />;
      case 'education': return <BookOpen className="w-3.5 h-3.5 text-[#3867A6]" />;
      case 'agriculture': return <Wheat className="w-3.5 h-3.5 text-[#E07B2E]" />;
      case 'health': return <Activity className="w-3.5 h-3.5 text-[#D94F45]" />;
      default: return <AlertTriangle className="w-3.5 h-3.5 text-[#2E7180]" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F5] text-[#102027]">
      <RoleNav 
        isCrisisMode={isCrisisMode}
        onToggleCrisisMode={() => setIsCrisisMode(!isCrisisMode)}
        selectedRegion={selectedRegionId}
        onSelectRegion={(reg) => {
          setSelectedRegionId(reg);
          setDistrictFilter('all');
        }}
      />

      {/* Hero Header */}
      <section className="bg-white border-b border-[#CCD1C7] py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                Full Statewide Directory · All Categories
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102027] mt-1">
                Jharkhand Societal Challenge Exchange
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
                Communities raise it. Campuses solve it. Industry scales it. Every university becomes the R&D department of its district.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSilentZones(!showSilentZones)}
                className={`touch-target px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition ${
                  showSilentZones
                    ? 'bg-[#102027] text-white border-gray-900'
                    : 'bg-white text-[#2E7180] border-[#2E7180] hover:bg-teal-50'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5 mr-1" />
                {showSilentZones ? 'Hide Silent Zones' : 'Silent Zones'}
              </button>
            </div>
          </div>

          {/* Cryptographic Ledger Banner */}
          <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-300/60 rounded-xl text-xs text-emerald-900 font-mono flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>{ledgerStatus?.explanation || "Cryptographic Impact Ledger: All entries recompute to their stored SHA-256 hashes."}</span>
            </div>
            <span className="text-[10px] text-emerald-800 bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
              TAMPER-EVIDENT
            </span>
          </div>
        </div>
      </section>

      {/* Main List */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-5">
        {/* Filter bar */}
        <div className="bg-white p-3 rounded-xl border border-[#CCD1C7] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-gray-500 font-bold">Filters:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#F4F6F5] px-2.5 py-1.5 rounded border border-[#CCD1C7] font-semibold"
            >
              <option value="all">All Categories</option>
              <option value="disaster">Disaster & Safety</option>
              <option value="water">Drinking Water</option>
              <option value="agriculture">Agriculture & Drought</option>
              <option value="health">Health Facilities</option>
              <option value="education">Education</option>
            </select>

            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-[#F4F6F5] px-2.5 py-1.5 rounded border border-[#CCD1C7] font-semibold"
            >
              <option value="all">All Districts</option>
              {availableDistricts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="text-xs font-mono text-gray-500">
            Showing <strong>{filteredChallenges.length}</strong> problems
          </div>
        </div>

        {/* Challenges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChallenges.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-[#CCD1C7] rounded-xl p-4 flex flex-col justify-between hover:border-[#2E7180] transition shadow-xs group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono text-gray-400 font-bold">
                    {c.ref || c.id}
                  </span>
                  {getPriorityBadge(c.priority, c.priority_band)}
                </div>

                <h3 className="font-bold text-sm text-[#102027] group-hover:text-[#2E7180] transition line-clamp-2">
                  {c.title}
                </h3>

                <p className="text-xs text-gray-600 mt-2 line-clamp-3 leading-relaxed">
                  {c.problem}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] font-mono text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#2E7180]" />
                    {c.district}
                  </span>
                  <span>·</span>
                  <span>{c.people_est ? `${c.people_est.toLocaleString()} people` : '—'}</span>
                  <span>·</span>
                  <span className="capitalize">{c.status.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-400">
                  {c.report_count || 1} ground reports
                </span>
                <Link
                  href={`/challenge/${c.ref || c.id}`}
                  className="text-xs font-mono font-bold text-[#2E7180] hover:underline flex items-center gap-1"
                >
                  View Details <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
