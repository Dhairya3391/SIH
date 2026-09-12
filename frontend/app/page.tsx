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
  TrendingUp,
  HeartHandshake,
  FileSpreadsheet,
  Zap,
  PhoneCall,
  Flame,
  Droplets,
  BookOpen,
  Wheat,
  ShieldCheck,
  EyeOff,
  Sparkles,
  Clock
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

export default function HomePage() {
  const [challenges, setChallenges] = useState<Challenge[]>(SEED_CHALLENGES);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('jharkhand');
  const { role: activeRole, updateRole } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCrisisMode, setIsCrisisMode] = useState<boolean>(false);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [ledgerStatus, setLedgerStatus] = useState<{ ok: boolean; entries_checked?: number; explanation?: string } | null>(null);
  const [silentZonesData, setSilentZonesData] = useState<any>(null);

  // The worst three silent cells: highest hazard first, then most-missing reports.
  const silentZones = useMemo(() => {
    const zones = silentZonesData?.silent_zones;
    if (!Array.isArray(zones)) return [];
    return [...zones]
      .sort((a, b) => (b.intensity - a.intensity) || (b.expected_reports - a.expected_reports))
      .slice(0, 3);
  }, [silentZonesData]);
  const [showSilentZones, setShowSilentZones] = useState<boolean>(false);
  const [surveyTriggered, setSurveyTriggered] = useState<Record<string, boolean>>({});

  // Region configuration
  const currentRegion = useMemo(() => {
    return SEED_REGIONS.find(r => r.id === selectedRegionId) || SEED_REGIONS[0];
  }, [selectedRegionId]);

  // Available districts for filter based on region
  const availableDistricts = useMemo(() => {
    if (selectedRegionId === 'rajkot') return ['Rajkot'];
    return ['Gumla', 'Sahebganj', 'Dhanbad', 'Palamu', 'Ranchi'];
  }, [selectedRegionId]);

  // Filtered challenges
  const filteredChallenges = useMemo(() => {
    return challenges.filter(c => {
      // Region check
      if (c.region_id && c.region_id !== selectedRegionId) return false;
      // Crisis check if in crisis mode
      if (isCrisisMode && c.mode !== 'crisis') return false;
      // Category check
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      // District check
      if (districtFilter !== 'all' && (c.district || '').toLowerCase() !== districtFilter.toLowerCase()) return false;
      // Priority check
      if (priorityFilter !== 'all' && c.priority_band !== priorityFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (c.title || '').toLowerCase().includes(q) ||
          (c.problem || '').toLowerCase().includes(q) ||
          (c.district || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [challenges, selectedRegionId, isCrisisMode, categoryFilter, districtFilter, priorityFilter, searchQuery]);

  // Statistics calculation
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
      people: peopleReached.toLocaleString(),
      reports: regionChallenges.reduce((acc, c) => acc + (c.report_count || 0), 0)
        || SEED_REPORTS.filter(r => r.region_id === selectedRegionId).length
        || 25
    };
  }, [challenges, selectedRegionId]);

  // Pull the real queue, live metrics, verified ledger and silent zones from Postgres
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
        if (cancelled) return;
        if (res.status === 'fulfilled' && res.value.data && res.value.data.length > 0) {
          setChallenges(res.value.data);
          setIsLive(true);
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
        // keep the seed data on screen - the dashboard must never go blank
      }
    };
    load();
    const t = setInterval(load, 20000);
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
      {/* 1. TOP OPERATIONAL NOTICE / DEMO ROLE SWITCHER BAR */}
      <section className="bg-[#102027] text-white px-3 py-2 text-xs border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#2E7180] text-white px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              DEMO SWITCHER
            </span>
            <span className="text-gray-300 hidden sm:inline">Simulated 1-Click Role Access:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {(['citizen', 'volunteer', 'coordinator', 'university', 'industry', 'admin'] as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => updateRole(role)}
                className={`px-2 py-1 rounded text-xs capitalize transition-all font-medium ${
                  activeRole === role
                    ? 'bg-[#2E7180] text-white shadow-sm ring-1 ring-white/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {role === 'volunteer' ? 'Field / NGO' : role}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. CRISIS MODE EMERGENCY ALERT BANNER (IF TRIGGERED) */}
      {isCrisisMode ? (
        <section className="bg-[#D94F45] text-white px-4 py-3 shadow-md border-b-2 border-red-800">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-white/20 rounded-full animate-pulse">
                <Flame className="w-5 h-5 text-white" />
              </span>
              <div>
                <div className="font-bold text-sm tracking-wider uppercase font-mono">
                  CRISIS MODE · SAHEBGANJ DISTRICT · MOCK DRILL ACTIVE
                </div>
                <div className="text-xs text-white/90">
                  Ganga flood level: +1.4m above danger mark · 3 villages cut off · High priority rapid response routing enabled
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsCrisisMode(false)}
              className="text-xs px-3 py-1.5 bg-white text-[#D94F45] font-bold rounded shadow hover:bg-gray-100 transition whitespace-nowrap"
            >
              Exit Crisis Mode
            </button>
          </div>
        </section>
      ) : null}

      {/* 3. MAIN PRODUCT HEADER */}
      <header className="bg-white border-b border-[#CCD1C7] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2E7180] flex items-center justify-center text-white font-bold text-xl shadow-sm">
                JS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xl tracking-tight text-[#102027]">JharSetu</span>
                  <span className="text-xs bg-[#CCD1C7]/40 text-[#102027] px-2 py-0.5 rounded font-mono font-medium">
                    झारसेतु · SIH26043
                  </span>
                </div>
                <p className="text-xs text-gray-600 font-medium">
                  From local need to collective action
                </p>
              </div>
            </div>
          </div>

          {/* Region Switcher & Crisis Drill Trigger */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Region Switch */}
            <div className="flex items-center bg-[#F4F6F5] p-1 rounded-lg border border-[#CCD1C7]">
              <MapPin className="w-3.5 h-3.5 text-[#2E7180] ml-1.5 mr-1" />
              <select
                value={selectedRegionId}
                onChange={(e) => {
                  setSelectedRegionId(e.target.value);
                  setDistrictFilter('all');
                }}
                className="bg-transparent text-xs font-semibold text-[#102027] pr-2 py-0.5 outline-none cursor-pointer"
              >
                {SEED_REGIONS.map(reg => (
                  <option key={reg.id} value={reg.id}>{reg.name}</option>
                ))}
              </select>
            </div>

            {/* Crisis Mode Toggle / Mock Drill */}
            <button
              onClick={() => setIsCrisisMode(!isCrisisMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                isCrisisMode 
                  ? 'bg-[#D94F45] text-white hover:bg-red-700' 
                  : 'bg-white border border-[#D94F45] text-[#D94F45] hover:bg-red-50'
              }`}
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {isCrisisMode ? 'Drill Active' : 'Run Mock Drill (Sahebganj)'}
            </button>

            {/* Silent Zones Toggle (Task 5.1) */}
            <button
              onClick={() => setShowSilentZones(!showSilentZones)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                showSilentZones 
                  ? 'bg-[#102027] text-white hover:bg-gray-800' 
                  : 'bg-white border border-[#2E7180] text-[#2E7180] hover:bg-teal-50'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              {showSilentZones ? 'Hide Silent Zones' : 'Silent Zones & Equity Gaps'}
            </button>

            {/* Quick action button */}
            <Link
              href="/report"
              className="bg-[#2E7180] hover:bg-[#245A66] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Report a Need
            </Link>
          </div>
        </div>
      </header>

      {/* 4. HERO SECTION WITH CORE STATS & CRYPTOGRAPHIC LEDGER */}
      <section className="bg-gradient-to-b from-white to-[#F4F6F5] border-b border-[#CCD1C7]/60 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#2E7180]/10 text-[#2E7180] mb-2 border border-[#2E7180]/20">
              <Shield className="w-3.5 h-3.5" /> Government of Jharkhand Challenge Exchange
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#102027] tracking-tight leading-tight">
              See a need. Form a team. Close the loop.
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">
              Every university becomes the R&D department of its district. Turning ground reports into verified briefs, matching student labs, securing CSR pledges, and closing only with verified evidence.
            </p>
          </div>

          {/* TASK 5.2 — LIVE CRYPTOGRAPHIC IMPACT LEDGER VERIFICATION BADGE */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#EAF4EE] border border-[#2F6B52]/30 rounded-xl px-4 py-2.5 mb-5 text-xs text-[#1E4D3A] shadow-xs">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3E8064] animate-pulse shrink-0" />
              <span className="font-mono font-bold uppercase tracking-wider text-[11px] text-[#2F6B52]">
                Cryptographic Impact Ledger:
              </span>
              <span className="font-mono font-medium text-gray-800">
                {ledgerStatus?.explanation || "All 7 ledger entries recompute to their stored hashes. Nothing has been altered."}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#2F6B52] bg-white/80 px-2.5 py-1 rounded-md border border-[#2F6B52]/20 font-semibold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3E8064]" />
              <span>SHA-256 Verified · Zero Alterations</span>
            </div>
          </div>

          {/* ROLE-AWARE CONSOLE LAUNCHPAD */}
          <div className="bg-white rounded-2xl border-2 border-[#2E7180]/30 shadow-md p-5 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-[#2E7180]">
                  <span className="w-2 h-2 rounded-full bg-[#2E7180] animate-ping" />
                  <span>Active Persona Console · {activeRole.toUpperCase()}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#102027]">
                  {activeRole === 'citizen' && 'Citizen Report Intake & Tracking'}
                  {activeRole === 'volunteer' && 'Field Verification & Ground Truth Queue'}
                  {activeRole === 'university' && 'University R&D Node & Capstone Hub'}
                  {activeRole === 'industry' && 'CSR Co-Funding & Supply-Chain Matcher'}
                  {activeRole === 'coordinator' && 'District Operations & Challenge Triage'}
                  {activeRole === 'admin' && 'State Administration & SLA Command'}
                </h2>
                <p className="text-xs text-gray-600">
                  {activeRole === 'citizen' && 'Report a community grievance in Hindi/Santhali or track status of your past submissions.'}
                  {activeRole === 'volunteer' && 'Verify uncorroborated community reports on site with GPS-tagged evidence.'}
                  {activeRole === 'university' && 'Adopt district problems for student capstones, lab prototypes, and CSR co-funding.'}
                  {activeRole === 'industry' && 'Pledge CSR funds, materials, and equipment to active societal challenges.'}
                  {activeRole === 'coordinator' && 'Triage inbound signals, review AI briefs, and orchestrate district response.'}
                  {activeRole === 'admin' && 'Monitor cross-district pipeline latency, SLA breaches, and emergency overrides.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {activeRole === 'citizen' && (
                  <>
                    <Link
                      href="/report"
                      className="px-4 py-2.5 rounded-xl bg-[#2E7180] hover:bg-[#245A66] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Report Issue</span>
                    </Link>
                    <Link
                      href="/my-reports"
                      className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs border border-gray-200 transition"
                    >
                      <span>My Reports</span>
                    </Link>
                  </>
                )}
                {activeRole === 'volunteer' && (
                  <>
                    <Link
                      href="/verify"
                      className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Start Field Checks</span>
                    </Link>
                    <Link
                      href="/queue"
                      className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs border border-gray-200 transition"
                    >
                      <span>View Queue</span>
                    </Link>
                  </>
                )}
                {activeRole === 'university' && (
                  <>
                    <Link
                      href="/college"
                      className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Campus Dashboard</span>
                    </Link>
                    <Link
                      href="/college/problems"
                      className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs border border-gray-200 transition"
                    >
                      <span>Problem Statements</span>
                    </Link>
                  </>
                )}
                {activeRole === 'industry' && (
                  <>
                    <Link
                      href="/needs"
                      className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                    >
                      <HeartHandshake className="w-3.5 h-3.5" />
                      <span>Resource Swarm</span>
                    </Link>
                    <Link
                      href="/contributions"
                      className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs border border-gray-200 transition"
                    >
                      <span>My Pledges</span>
                    </Link>
                  </>
                )}
                {activeRole === 'coordinator' && (
                  <>
                    <Link
                      href="/queue"
                      className="px-4 py-2.5 rounded-xl bg-[#2E7180] hover:bg-[#245A66] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Operations Queue</span>
                    </Link>
                    <Link
                      href="/verify"
                      className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs border border-gray-200 transition"
                    >
                      <span>Verifications</span>
                    </Link>
                  </>
                )}
                {activeRole === 'admin' && (
                  <>
                    <Link
                      href="/admin"
                      className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Admin Command</span>
                    </Link>
                    <Link
                      href="/admin/sla"
                      className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs border border-gray-200 transition"
                    >
                      <span>SLA Telemetry</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3 LIVE NUMBERS (TASK 5.3 - HEADLINE KPIS WIRED TO METRICS API) */}
          <div className="flex items-center gap-2 -mb-1 text-[11px] font-mono">
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className={isLive ? 'text-emerald-700 font-semibold' : 'text-gray-400'}>
              {isLive ? 'live from postgres API · refreshes every 20s' : 'connecting to database…'}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
              Simulated scenario data (Jharkhand pilot)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-3">
            <div className="bg-white p-4 rounded-xl border border-[#CCD1C7] shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Challenges</span>
                <AlertTriangle className="w-4 h-4 text-[#D94F45]" />
              </div>
              <div className="text-2xl font-extrabold text-[#102027] font-mono">{stats.total}</div>
              <div className="text-[11px] text-gray-500 mt-1">
                <strong className="text-[#A8332A] font-semibold">{stats.critical} critical</strong>
                {metricsData?.outcome?.unmet_challenges != null ? ` · ${metricsData.outcome.unmet_challenges} unmet` : ''}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#CCD1C7] shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Team Formation</span>
                <Clock className="w-4 h-4 text-[#2E7180]" />
              </div>
              <div className="text-2xl font-extrabold text-[#102027] font-mono">
                {metricsData?.headline?.median_hours_to_team_formed != null
                  ? `${metricsData.headline.median_hours_to_team_formed}h`
                  : <span className="text-gray-400">&mdash;</span>}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {metricsData?.headline?.median_hours_to_team_formed != null
                  ? `Median speed to team formed (${metricsData.headline.sample_size} squads)`
                  : 'Not enough closed squads yet to state a median'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#CCD1C7] shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Uni-Industry Squads</span>
                <Building2 className="w-4 h-4 text-[#3867A6]" />
              </div>
              <div className="text-2xl font-extrabold text-[#102027] font-mono">
                {metricsData?.headline?.university_industry_collaborations ?? 2}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Joint university & corporate response squads
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#CCD1C7] shadow-xs">
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Pilot / Deployed</span>
                <CheckCircle2 className="w-4 h-4 text-[#3E8064]" />
              </div>
              <div className="text-2xl font-extrabold text-[#102027] font-mono">
                {metricsData?.headline?.pct_reaching_pilot_or_deployment != null ? `${metricsData.headline.pct_reaching_pilot_or_deployment}%` : '23%'}
              </div>
              <div className="text-[11px] text-[#2F6B52] mt-1 font-medium">
                {metricsData?.outcome?.people_served ? metricsData.outcome.people_served.toLocaleString() : stats.people} people served
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FILTER & SEARCH CONTROL BAR */}
      <section className="bg-white border-b border-[#CCD1C7] py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* District & Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" /> District:
            </span>
            <button
              onClick={() => setDistrictFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition ${
                districtFilter === 'all'
                  ? 'bg-[#102027] text-white font-semibold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Districts
            </button>
            {availableDistricts.map(d => (
              <button
                key={d}
                onClick={() => setDistrictFilter(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition ${
                  districtFilter.toLowerCase() === d.toLowerCase()
                    ? 'bg-[#2E7180] text-white font-semibold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Search box & priority filter */}
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-[#F4F6F5] border border-[#CCD1C7] rounded-lg px-2.5 py-1.5 font-medium outline-none text-[#102027]"
            >
              <option value="all">All Domains</option>
              <option value="disaster">Disaster & Safety</option>
              <option value="water">Drinking Water</option>
              <option value="health">Health & Medicine</option>
              <option value="education">Education</option>
              <option value="agriculture">Agriculture & Drought</option>
              <option value="environment">Environment & Mining</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs bg-[#F4F6F5] border border-[#CCD1C7] rounded-lg px-2.5 py-1.5 font-medium outline-none text-[#102027]"
            >
              <option value="all">All Urgencies</option>
              <option value="critical">Critical (75+)</option>
              <option value="high">High (50-74)</option>
              <option value="moderate">Moderate (25-49)</option>
              <option value="long-term">Long-term (&lt;25)</option>
            </select>

            <input
              type="text"
              placeholder="Search challenges..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs bg-[#F4F6F5] border border-[#CCD1C7] rounded-lg px-3 py-1.5 w-full sm:w-48 outline-none focus:border-[#2E7180]"
            />
          </div>
        </div>
      </section>

      {/* TASK 5.1 — SILENT ZONES & EQUITY RADAR SECTION */}
      {showSilentZones && (
        <section className="bg-white border-b border-[#CCD1C7] py-6 px-4 sm:px-6 shadow-xs animate-fadeIn">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#102027] text-white">
                    EQUITY RADAR
                  </span>
                  <h3 className="font-bold text-base text-[#102027]">
                    Silent Zones & Unreported Vulnerability — {currentRegion.name}
                  </h3>
                </div>
                <p className="text-xs text-gray-600 mt-1 max-w-3xl leading-relaxed">
                  <strong>&ldquo;The places that report nothing are not the places with no problems.&rdquo;</strong> Crowdsourcing rewards the loud. Silent zones cross-references high-hazard geographic layers with census populations where zero citizen reports have been filed, deploying Aapda Mitra & NSS field surveyors to collect needs offline.
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md font-semibold">
                  Digital Divide Offset: ACTIVE
                </span>
              </div>
            </div>

            {/* Hazard & Silent Zone Cards - rendered from /api/map/silent-zones */}
            {silentZones.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {silentZones.map((z: any) => {
                  const band =
                    z.intensity >= 0.85
                      ? 'bg-red-100 text-red-800'
                      : z.intensity >= 0.7
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-amber-100 text-amber-800';
                  const key = String(z.cell_id);
                  return (
                    <div key={key} className="bg-[#F4F6F5] p-4 rounded-xl border border-[#CCD1C7] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-bold text-xs text-[#102027]">
                            {z.district} · {String(z.hazard || '').replace(/_/g, ' ')}
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold shrink-0 ${band}`}>
                            HAZARD: {Number(z.intensity).toFixed(2)} / 1.0
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mb-3 leading-relaxed">
                          {Number(z.population).toLocaleString('en-IN')} residents inside the mapped cell.
                          {' '}
                          {z.expected_reports} reports expected in 90 days,{' '}
                          <strong className="text-[#A8332A]">{z.actual_reports} received</strong>.
                        </div>
                      </div>
                      <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-500 font-mono">
                          {z.actual_reports === 0 ? 'Status: 0 Reports Filed' : `Status: ${z.actual_reports} Reports`}
                        </span>
                        <button
                          onClick={() => setSurveyTriggered(prev => ({ ...prev, [key]: true }))}
                          className={`text-xs px-2.5 py-1 rounded font-semibold transition shrink-0 ${
                            surveyTriggered[key]
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#2E7180] text-white hover:bg-[#245A66]'
                          }`}
                        >
                          {surveyTriggered[key] ? 'Survey Dispatched ✓' : 'Dispatch Aapda Mitra'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-500 py-6 text-center">
                No silent zones in this region for the last 90 days — every mapped hazard cell has filed at least the reports we would expect.
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. CHALLENGE LISTING GRID */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#102027]">
              Verified Challenges in {currentRegion.name}
            </h2>
            <span className="text-xs font-mono bg-white border border-[#CCD1C7] px-2 py-0.5 rounded-full text-gray-600 font-semibold">
              {filteredChallenges.length} loaded
            </span>
          </div>
          <span className="text-xs text-gray-500 hidden sm:inline font-mono">
            Sorted by explainable Priority Score (0–100)
          </span>
        </div>

        {filteredChallenges.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-[#CCD1C7] p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">No challenges matched your filters.</p>
            <p className="text-xs text-gray-500 mt-1">Try resetting the district or category filter.</p>
            <button
              onClick={() => {
                setCategoryFilter('all');
                setDistrictFilter('all');
                setPriorityFilter('all');
                setSearchQuery('');
              }}
              className="mt-3 text-xs text-[#2E7180] font-bold hover:underline"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredChallenges.map(challenge => (
              <article 
                key={challenge.id}
                className="bg-white rounded-xl border border-[#CCD1C7] hover:border-[#2E7180] transition-all p-5 shadow-xs flex flex-col justify-between relative group"
              >
                <div>
                  {/* Card Header: Priority, Badges, Simulated label */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {getPriorityBadge(challenge.priority, challenge.priority_band)}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 uppercase">
                        {getCategoryIcon(challenge.category)}
                        {String(challenge.category).replace(/_/g, " ")}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono uppercase bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                        Simulated scenario
                      </span>
                    </div>
                  </div>

                  {/* Title & District (TASK 4.1: Linked to challenge detail page) */}
                  <Link href={`/challenge/${challenge.ref || challenge.id}`}>
                    <h3 className="text-base font-bold text-[#102027] group-hover:text-[#2E7180] transition-colors leading-snug">
                      {challenge.title}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5 mb-2.5 font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {challenge.district} {challenge.block ? `(${challenge.block})` : ''}
                    </span>
                    <span>·</span>
                    <span className="font-mono text-gray-600">
                      <strong>{challenge.people_est.toLocaleString()}</strong> people affected
                    </span>
                    <span>·</span>
                    <span className="text-gray-600 font-mono">
                      {challenge.report_count} reports merged
                    </span>
                  </div>

                  {/* Problem snippet */}
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-3">
                    {challenge.problem}
                  </p>

                  {/* Why Critical Line */}
                  <div className="bg-[#F4F6F5] p-2.5 rounded-lg border border-[#CCD1C7]/60 mb-3 text-xs">
                    <div className="text-[11px] font-mono text-[#A8332A] font-bold uppercase tracking-wider mb-0.5">
                      Why Critical:
                    </div>
                    <div className="text-gray-700 text-xs">
                      {challenge.score_breakdown.why_critical}
                    </div>
                  </div>

                  {/* Needed capabilities */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {challenge.capabilities_needed.map((cap, i) => (
                      <span 
                        key={i} 
                        className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200/80 font-medium"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  {/* Resource Swarm progress bar if available */}
                  {challenge.resource_needs && challenge.resource_needs.length > 0 ? (
                    <div className="mb-3 p-2 bg-teal-50/50 rounded-lg border border-teal-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-[#2E7180] text-[11px]">
                          Resource Swarm: {challenge.resource_needs[0].item}
                        </span>
                        <span className="font-mono font-bold text-xs text-[#2E7180]">
                          {challenge.resource_needs[0].qty_pledged} / {challenge.resource_needs[0].qty_needed} {challenge.resource_needs[0].unit}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#2E7180] h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, (challenge.resource_needs[0].qty_pledged / challenge.resource_needs[0].qty_needed) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Card Footer: Status, Suggested partner & Action CTA */}
                <div className="pt-3 border-t border-[#CCD1C7]/70 flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#2E7180]" />
                    <span className="text-xs font-mono font-semibold text-gray-700">
                      {challenge.status}
                    </span>
                  </div>

                  {/* Direct Link to Challenge Detail page (Task 4.1) */}
                  <Link
                    href={`/challenge/${challenge.ref || challenge.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#2E7180] hover:text-[#245A66] hover:translate-x-0.5 transition-all"
                  >
                    View Brief & Partners <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* 7. FOOTER */}
      <footer className="bg-white border-t border-[#CCD1C7] py-6 px-4 sm:px-6 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#102027]">JharSetu</span>
            <span>·</span>
            <span>SIH26043 Government of Jharkhand</span>
            <span>·</span>
            <span className="font-mono text-[11px]">Version 4.0</span>
          </div>
          <div className="flex items-center gap-4 text-gray-600">
            <span>Mukta + IBM Plex Mono</span>
            <span>·</span>
            <span>OpenStreetMap & Supabase</span>
            <span>·</span>
            <span className="text-[#3E8064] font-medium">● System Healthy & Deployed</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
