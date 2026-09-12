'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  HeartHandshake, 
  Filter, 
  Search, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  Package,
  Layers,
  Sparkles,
  Zap,
  Droplets
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { ContributionSplitter, formatIndianCurrency, formatIndianNumber } from '@/components/shared/ContributionSplitter';
import { Category, PriorityBand } from '@/types/database';

export interface OpenNeedItem {
  id: string;
  challengeRef: string;
  challengeTitle: string;
  category: Category;
  district: string;
  severity: number;
  priority: number;
  priorityBand: PriorityBand;
  ageDays: number;
  itemName: string;
  unit: string;
  totalNeeded: number;
  alreadyPledged: number;
  isCurrency: boolean;
  leadCollege: string;
}

const SEED_OPEN_NEEDS: OpenNeedItem[] = [
  {
    id: 'need-1',
    challengeRef: 'CH-GUM-001',
    challengeTitle: 'Last-mile lightning alerts and safe shelter for farm workers, Gumla block',
    category: 'disaster',
    district: 'Gumla',
    severity: 5,
    priority: 82,
    priorityBand: 'critical',
    ageDays: 4,
    itemName: '120dB Solar Acoustic Siren Towers',
    unit: 'towers',
    totalNeeded: 12,
    alreadyPledged: 5, // 5 pledged by another company -> 7 remaining
    isCurrency: false,
    leadCollege: 'BIT Mesra ECE Lab',
  },
  {
    id: 'need-2',
    challengeRef: 'CH-GUM-001',
    challengeTitle: 'Last-mile lightning alerts and safe shelter for farm workers, Gumla block',
    category: 'disaster',
    district: 'Gumla',
    severity: 5,
    priority: 82,
    priorityBand: 'critical',
    ageDays: 4,
    itemName: 'Hardware Fabrication & Pilot Installation Budget',
    unit: 'INR',
    totalNeeded: 140000,
    alreadyPledged: 60000, // 80,000 remaining
    isCurrency: true,
    leadCollege: 'BIT Mesra ECE Lab',
  },
  {
    id: 'need-3',
    challengeRef: 'CH-SAH-002',
    challengeTitle: 'Ganga riverbank flood water filtration and pathogen elimination',
    category: 'water',
    district: 'Sahebganj',
    severity: 5,
    priority: 76,
    priorityBand: 'critical',
    ageDays: 2,
    itemName: 'Mobile Gravity Ultrafiltration Cartridges (500L/hr)',
    unit: 'cartridges',
    totalNeeded: 20,
    alreadyPledged: 8,
    isCurrency: false,
    leadCollege: 'IIT-ISM Dhanbad Environmental Lab',
  },
  {
    id: 'need-4',
    challengeRef: 'CH-DHN-003',
    challengeTitle: 'Coal seam methane and toxic gas monitoring, Jharia basti',
    category: 'roads',
    district: 'Dhanbad',
    severity: 4,
    priority: 68,
    priorityBand: 'high',
    ageDays: 6,
    itemName: 'Methane Gas Detection LoRa Nodes',
    unit: 'nodes',
    totalNeeded: 15,
    alreadyPledged: 0,
    isCurrency: false,
    leadCollege: 'IIT-ISM Dhanbad Geotech',
  },
  {
    id: 'need-5',
    challengeRef: 'CH-PAL-004',
    challengeTitle: 'Low-cost solar sub-surface drip irrigation for drought uplands',
    category: 'agriculture',
    district: 'Palamu',
    severity: 4,
    priority: 54,
    priorityBand: 'high',
    ageDays: 8,
    itemName: 'Solar Submersible Water Pump Array Budget',
    unit: 'INR',
    totalNeeded: 220000,
    alreadyPledged: 70000,
    isCurrency: true,
    leadCollege: 'Birsa Agricultural University (BAU)',
  },
];

export default function NeedsMarketplacePage() {
  const [needs, setNeeds] = useState<OpenNeedItem[]>(SEED_OPEN_NEEDS);
  const [districtFilter, setDistrictFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return needs.filter((n) => {
      if (districtFilter !== 'all' && n.district !== districtFilter) return false;
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          n.itemName.toLowerCase().includes(q) ||
          n.challengeTitle.toLowerCase().includes(q) ||
          n.district.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [needs, districtFilter, categoryFilter, searchQuery]);

  return (
    <RouteGuard allowedRoles={['industry', 'coordinator', 'admin']} consoleTitle="CSR Needs Marketplace">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Header */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                Stage 4 · Corporate & NGO Resource Swarm
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027] mt-1">
                The Needs Marketplace
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                Pledge partial material lines and CSR capital directly to university pilots. Every rupee and kilogram is tracked to verified impact.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/contributions"
                className="touch-target px-4 py-2 bg-white border border-[#CCD1C7] hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition"
              >
                <Building2 className="w-3.5 h-3.5 text-purple-700" />
                My CSR Contributions & Tracking
              </Link>
            </div>
          </div>

          {/* Filters Bar */}
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
                <option value="water">Drinking Water</option>
                <option value="roads">Roads & Subsurface</option>
                <option value="agriculture">Agriculture</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter materials, budget lines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-[#CCD1C7] font-mono text-xs outline-none focus:border-[#2E7180]"
                />
              </div>
            </div>

            <span className="text-xs font-mono text-gray-400">
              Lines Display Remaining Gaps Only
            </span>
          </div>

          {/* Needs Marketplace Grid with Split-Contribution Control */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filtered.map((item) => {
              const remaining = Math.max(0, item.totalNeeded - item.alreadyPledged);

              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#CCD1C7] rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Urgency, District & Age Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                            item.priority >= 75
                              ? 'bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30'
                              : 'bg-[#E07B2E]/15 text-[#9A4A12] border border-[#E07B2E]/30'
                          }`}
                        >
                          PRIORITY {item.priority} · {item.priorityBand.toUpperCase()}
                        </span>
                        <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          Opened {item.ageDays} days ago
                        </span>
                      </div>

                      <span className="text-xs font-mono text-gray-600 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#2E7180]" />
                        {item.district}
                      </span>
                    </div>

                    {/* Challenge Parent Context */}
                    <div>
                      <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">
                        Challenge {item.challengeRef}
                      </span>
                      <h3 className="text-sm font-bold text-[#102027] line-clamp-1">
                        {item.challengeTitle}
                      </h3>
                      <p className="text-[11px] text-[#2E7180] font-mono mt-0.5">
                        Lead Engineering Partner: {item.leadCollege}
                      </p>
                    </div>

                    {/* THE SPLIT-CONTRIBUTION CONTROL COMPONENT */}
                    <ContributionSplitter
                      itemName={item.itemName}
                      totalNeeded={item.totalNeeded}
                      alreadyPledged={item.alreadyPledged}
                      unit={item.unit}
                      isCurrency={item.isCurrency}
                      onPledge={async (pledgedAmount) => {
                        // Update local remaining state
                        setNeeds((prev) =>
                          prev.map((n) =>
                            n.id === item.id
                              ? { ...n, alreadyPledged: n.alreadyPledged + pledgedAmount }
                              : n
                          )
                        );
                      }}
                    />
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-mono text-gray-500">
                    <span>CSR Eligible: Sec 135 Sch VII (Disaster Relief)</span>
                    <Link
                      href={`/challenge/${item.challengeRef}`}
                      className="text-[#2E7180] font-bold hover:underline flex items-center gap-1"
                    >
                      View Challenge <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
