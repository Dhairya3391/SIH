'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Truck, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  ArrowRight, 
  MessageSquare, 
  Package, 
  FileCheck,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { MessageThread } from '@/components/shared/MessageThread';
import { formatIndianCurrency, formatIndianNumber } from '@/components/shared/ContributionSplitter';

export type DeliveryState = 'pledged' | 'dispatched' | 'delivered' | 'confirmed_by_college';

interface ContributionRecord {
  id: string;
  challengeRef: string;
  challengeTitle: string;
  collegeName: string;
  itemName: string;
  amountPledged: string;
  pledgeDate: string;
  deliveryState: DeliveryState;
  dispatchDate?: string;
  receiptConfirmedDate?: string;
  isProjectClosed: boolean;
}

const SEED_MY_CONTRIBUTIONS: ContributionRecord[] = [
  {
    id: 'c-1',
    challengeRef: 'CH-GUM-001',
    challengeTitle: 'Last-mile lightning alerts and safe shelter for farm workers, Gumla block',
    collegeName: 'BIT Mesra ECE Lab',
    itemName: 'Structural Steel Prefabricated Mounting Mast',
    amountPledged: '800 kg',
    pledgeDate: '2026-09-09',
    deliveryState: 'confirmed_by_college',
    dispatchDate: '2026-09-11',
    receiptConfirmedDate: '2026-09-12',
    isProjectClosed: false,
  },
  {
    id: 'c-2',
    challengeRef: 'CH-GUM-001',
    challengeTitle: 'Last-mile lightning alerts and safe shelter for farm workers, Gumla block',
    collegeName: 'BIT Mesra ECE Lab',
    itemName: 'Hardware Fabrication & Pilot Budget Grant',
    amountPledged: '₹80,000',
    pledgeDate: '2026-09-09',
    deliveryState: 'confirmed_by_college',
    receiptConfirmedDate: '2026-09-10',
    isProjectClosed: false,
  },
  {
    id: 'c-3',
    challengeRef: 'CH-SAH-002',
    challengeTitle: 'Ganga riverbank flood water filtration units',
    collegeName: 'IIT-ISM Dhanbad Environmental Lab',
    itemName: 'Mobile Gravity Ultrafiltration Cartridges',
    amountPledged: '10 cartridges',
    pledgeDate: '2026-09-11',
    deliveryState: 'dispatched',
    dispatchDate: '2026-09-12',
    isProjectClosed: false,
  },
  {
    id: 'c-4',
    challengeRef: 'CH-DHN-101',
    challengeTitle: 'Drinking Water Borewell Solar Submersible Repair',
    collegeName: 'IIT-ISM Mining Engineering',
    itemName: 'Submersible Pump Overhaul Grant',
    amountPledged: '₹45,000',
    pledgeDate: '2026-07-20',
    deliveryState: 'confirmed_by_college',
    receiptConfirmedDate: '2026-08-02',
    isProjectClosed: true, // Closed project, stays reachable
  },
];

export default function MyContributionsPage() {
  const [contributions, setContributions] = useState<ContributionRecord[]>(SEED_MY_CONTRIBUTIONS);
  const [filterView, setFilterView] = useState<'all' | 'active' | 'closed'>('all');
  const [selectedChatChallenge, setSelectedChatChallenge] = useState<string | null>('CH-GUM-001');

  // Dispatch Date Setter
  const handleUpdateDispatchDate = (id: string, newDate: string) => {
    setContributions((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, dispatchDate: newDate, deliveryState: 'dispatched' as DeliveryState }
          : c
      )
    );
  };

  const filtered = contributions.filter((c) => {
    if (filterView === 'active') return !c.isProjectClosed;
    if (filterView === 'closed') return c.isProjectClosed;
    return true;
  });

  return (
    <RouteGuard allowedRoles={['industry', 'coordinator', 'admin']} consoleTitle="My CSR Contributions">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Header */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                Tata Steel CSR Foundation · Corporate Dashboard
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027] mt-1">
                My CSR Contributions & Delivery Tracking
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                Track material dispatches, college receipts, and impact evidence for statutory Section 135 reporting.
              </p>
            </div>

            <Link
              href="/needs"
              className="touch-target px-4 py-2 bg-[#2E7180] hover:bg-[#245A66] text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              <Package className="w-3.5 h-3.5" />
              Browse Open Needs Marketplace
            </Link>
          </div>

          {/* Filter Bar (Active vs Closed Projects) */}
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#CCD1C7] text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-bold mr-2">Filter Projects:</span>
              <button
                type="button"
                onClick={() => setFilterView('all')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterView === 'all'
                    ? 'bg-[#2E7180] text-white font-bold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({contributions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('active')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterView === 'active'
                    ? 'bg-[#2E7180] text-white font-bold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active Pilots ({contributions.filter((c) => !c.isProjectClosed).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('closed')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterView === 'closed'
                    ? 'bg-[#2E7180] text-white font-bold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Closed & Completed ({contributions.filter((c) => c.isProjectClosed).length})
              </button>
            </div>

            <span className="text-gray-400 hidden sm:inline">
              Closed projects remain fully accessible
            </span>
          </div>

          {/* TWO COLUMNS: Contributions List (Left 7) vs Direct College Chat (Right 5) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Col (7 cols): Contributions List */}
            <div className="lg:col-span-7 space-y-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white border rounded-2xl p-5 shadow-xs space-y-3 transition ${
                    item.isProjectClosed ? 'border-gray-300 opacity-90' : 'border-[#CCD1C7] hover:border-[#2E7180]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                        {item.challengeRef}
                      </span>
                      {item.isProjectClosed && (
                        <span className="text-[10px] font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold">
                          CLOSED / IMPACT VERIFIED
                        </span>
                      )}
                    </div>

                    {/* Delivery State Badge */}
                    {item.deliveryState === 'confirmed_by_college' && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Confirmed Received by College
                      </span>
                    )}
                    {item.deliveryState === 'dispatched' && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-300">
                        <Truck className="w-3.5 h-3.5 text-sky-600" />
                        Dispatched in Transit
                      </span>
                    )}
                    {item.deliveryState === 'pledged' && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Pledged · Awaiting Dispatch
                      </span>
                    )}
                  </div>

                  {/* Item and Challenge info */}
                  <div>
                    <h3 className="text-sm font-bold text-[#102027]">{item.itemName}</h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      Pledged Share: <strong className="text-gray-900">{item.amountPledged}</strong> · Target Team:{' '}
                      <strong className="text-[#2E7180]">{item.collegeName}</strong>
                    </p>
                  </div>

                  {/* Dispatch and Receipt Status Dates */}
                  <div className="p-3 bg-[#F4F6F5] rounded-xl text-xs font-mono space-y-1.5 border border-[#CCD1C7]/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Dispatch Date:</span>
                        <input
                          type="date"
                          value={item.dispatchDate || ''}
                          disabled={item.deliveryState === 'confirmed_by_college'}
                          onChange={(e) => handleUpdateDispatchDate(item.id, e.target.value)}
                          className="px-2 py-0.5 rounded border border-[#CCD1C7] bg-white font-mono text-xs"
                        />
                      </div>

                      {item.receiptConfirmedDate && (
                        <div className="text-emerald-800 font-bold">
                          Receipt Confirmed: {item.receiptConfirmedDate}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card footer actions */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedChatChallenge(item.challengeRef)}
                      className="text-xs font-mono font-bold text-[#2E7180] hover:underline flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Message College Team ({item.collegeName})
                    </button>

                    <Link
                      href={`/challenge/${item.challengeRef}`}
                      className="text-xs font-mono text-gray-500 hover:text-gray-900 flex items-center gap-1"
                    >
                      View Live Project <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Col (5 cols): In-app Message Thread with College */}
            <div className="lg:col-span-5 sticky top-20">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#2E7180]" />
                    Direct College Chat (Stage 4)
                  </span>
                  <span className="text-[11px] font-mono text-gray-500">
                    Challenge {selectedChatChallenge}
                  </span>
                </div>

                <MessageThread
                  challengeRef={selectedChatChallenge || 'CH-GUM-001'}
                  projectTitle="Gumla Rural Lightning Siren Relay Network (12 Towers)"
                  messages={[
                    {
                      id: 'm-1',
                      senderName: 'R. S. Murthy',
                      senderRole: 'industry',
                      senderOrg: 'Tata Steel CSR',
                      content: 'We have approved 800kg structural steel mast batch under Dispatch #TS-RNC-4401. Truck left depot this morning.',
                      timestamp: 'Yesterday at 3:00 PM',
                      isSelf: true,
                    },
                    {
                      id: 'm-2',
                      senderName: 'Dr. A. Verma',
                      senderRole: 'university',
                      senderOrg: 'BIT Mesra ECE',
                      content: 'Thank you Mr. Murthy! We have received and confirmed the delivery on the ledger. Hardware assembly begins tomorrow.',
                      timestamp: 'Today at 10:15 AM',
                    },
                  ]}
                  currentUserRole="industry"
                  onSendMessage={async () => {}}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
