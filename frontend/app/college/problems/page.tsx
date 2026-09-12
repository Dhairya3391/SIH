'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  MapPin, 
  Users, 
  Clock, 
  ArrowRight, 
  Filter, 
  Search, 
  Trophy, 
  Sparkles,
  Zap,
  Droplets,
  BookOpen,
  Wheat,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { SEED_CHALLENGES } from '@/data/seedData';
import { CountdownToClose } from '@/components/shared/CountdownToClose';
import { LeaderBadge, CompetitionState } from '@/components/shared/LeaderBadge';
import { Category, PriorityBand } from '@/types/database';

interface ProblemCompetitionItem {
  id: string;
  ref: string;
  title: string;
  problem: string;
  category: Category;
  district: string;
  priority: number;
  priorityBand: PriorityBand;
  peopleEst: number;
  capabilitiesNeeded: string[];
  competitionState: CompetitionState;
  leadingScore?: number;
  userScore?: number;
  hasProposals: boolean;
  closeDate?: string;
}

const COLLEGE_PROBLEMS: ProblemCompetitionItem[] = [
  {
    id: 'CH-GUM-001',
    ref: 'CH-GUM-001',
    title: 'Last-mile lightning alerts and safe shelter for farm workers, Gumla block',
    problem: 'Official lightning alerts exist from IMD and IITM Damini app, but agricultural workers in open paddy fields without smartphones never receive them. Over 2,400 lives lost in 10 years.',
    category: 'disaster',
    district: 'Gumla',
    priority: 82,
    priorityBand: 'critical',
    peopleEst: 4800,
    capabilitiesNeeded: ['Acoustic Siren Relay', 'Embedded Hardware', 'Nagpuri Audio Warnings'],
    competitionState: 'leading',
    leadingScore: 84,
    userScore: 84,
    hasProposals: true,
  },
  {
    id: 'CH-SAH-002',
    ref: 'CH-SAH-002',
    title: 'Ganga riverbank flood water filtration and pathogen elimination',
    problem: 'Flood overflow submerges handpumps in Diara villages with high bacterial count. Needs rapid portable purification units deployable on country boats.',
    category: 'water',
    district: 'Sahebganj',
    priority: 76,
    priorityBand: 'critical',
    peopleEst: 1250,
    capabilitiesNeeded: ['Water Ultrafiltration', 'Solar Desalination', 'Boat Transport'],
    competitionState: 'outscored',
    leadingScore: 84,
    userScore: 78,
    hasProposals: true,
  },
  {
    id: 'CH-DHN-003',
    ref: 'CH-DHN-003',
    title: 'Coal seam methane and toxic gas monitoring for informal settlements, Jharia',
    problem: 'Subsurface mine fires emit carbon monoxide and methane fissures into basti pathways without early sensing or public evacuation beacons.',
    category: 'roads',
    district: 'Dhanbad',
    priority: 68,
    priorityBand: 'high',
    peopleEst: 3200,
    capabilitiesNeeded: ['Methane Gas Sensors', 'LoRa Mesh Network', 'Structural Geotech'],
    competitionState: 'open',
    leadingScore: 72,
    hasProposals: true,
  },
  {
    id: 'CH-PAL-004',
    ref: 'CH-PAL-004',
    title: 'Low-cost solar sub-surface drip irrigation for drought-prone uplands',
    problem: 'Palamu uplands face 20+ day dry spells during paddy tillering. Standard pumps drain falling groundwater table rapidly.',
    category: 'agriculture',
    district: 'Palamu',
    priority: 54,
    priorityBand: 'high',
    peopleEst: 1800,
    capabilitiesNeeded: ['Drip Irrigation', 'Soil Moisture Telemetry', 'Solar PV Control'],
    competitionState: 'no_proposals',
    hasProposals: false,
  },
];

export default function CollegeProblemsPage() {
  const [districtFilter, setDistrictFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return COLLEGE_PROBLEMS.filter((p) => {
      if (districtFilter !== 'all' && p.district !== districtFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.ref.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          p.problem.toLowerCase().includes(q) ||
          p.district.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [districtFilter, categoryFilter, searchQuery]);

  return (
    <RouteGuard allowedRoles={['university', 'coordinator', 'admin']} consoleTitle="College R&D Problems">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Header */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                Stage 3 · Open Engineering Challenges
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027] mt-1">
                Browse Verified Problems & Competition Windows
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                Review verified ground problems, inspect the competition state and deadlines, and submit your college engineering proposal.
              </p>
            </div>

            <span className="text-xs font-mono text-gray-500 bg-[#F4F6F5] px-3 py-1.5 rounded-lg border border-[#CCD1C7] shrink-0 font-bold">
              {filtered.length} Challenges Open
            </span>
          </div>

          {/* Filter Toolbar */}
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
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[#F4F6F5] px-2.5 py-1.5 rounded-lg border border-[#CCD1C7] font-semibold font-mono"
              >
                <option value="all">All Categories</option>
                <option value="disaster">Disaster & Safety</option>
                <option value="water">Water</option>
                <option value="roads">Roads & Subsurface</option>
                <option value="agriculture">Agriculture</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Search problem, ref, keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-[#CCD1C7] font-mono text-xs outline-none focus:border-[#2E7180]"
                />
              </div>
            </div>

            <span className="text-xs font-mono text-gray-400">
              Live Window Clocks Active
            </span>
          </div>

          {/* Problems Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-[#CCD1C7] rounded-2xl p-5 hover:border-[#2E7180] transition shadow-xs flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Top Bar: Ref & Competition State Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-gray-500">
                      {item.ref}
                    </span>

                    {/* The 5 Required Competition States */}
                    <LeaderBadge
                      state={item.competitionState}
                      leadingScore={item.leadingScore}
                      userScore={item.userScore}
                    />
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-[#102027] group-hover:text-[#2E7180] transition leading-snug">
                    {item.title}
                  </h3>

                  {/* Problem Brief */}
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-3">
                    {item.problem}
                  </p>

                  {/* Capabilities Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {item.capabilitiesNeeded.map((cap, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Bar: Live Countdown & Jump to Proposal Upload / Problem Detail */}
                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <CountdownToClose
                    hasProposals={item.hasProposals}
                    leadingScore={item.leadingScore}
                    status={item.competitionState === 'closed' ? 'closed' : undefined}
                    compact
                  />

                  <Link
                    href={`/college/problems/${item.ref}`}
                    className="touch-target px-4 py-2 bg-[#2E7180] hover:bg-[#245A66] text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 shadow-2xs transition whitespace-nowrap"
                  >
                    <span>Inspect Brief & Submit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
