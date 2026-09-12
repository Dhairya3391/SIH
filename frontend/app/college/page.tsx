'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  Trophy, 
  ArrowRight, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowDownRight, 
  Package, 
  Calendar, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { CountdownToClose } from '@/components/shared/CountdownToClose';
import { LeaderBadge } from '@/components/shared/LeaderBadge';

export default function CollegeDashboardPage() {
  const [showDisplacementAlert, setShowDisplacementAlert] = useState(true);

  return (
    <RouteGuard allowedRoles={['university', 'coordinator', 'admin']} consoleTitle="College R&D Console">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Top Heading Banner */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                Stage 3 & 5 · University R&D Engine
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027] mt-1">
                College R&D Command Center
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                BIT Mesra ECE Lab · Turning district disaster challenges into peer-reviewed engineering proposals and funded student field pilots.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/college/problems"
                className="touch-target px-4 py-2 bg-[#2E7180] hover:bg-[#245A66] text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <FileText className="w-3.5 h-3.5" />
                Browse Verified Problems
              </Link>
            </div>
          </div>

          {/* DISPLACEMENT NOTICE (In-app alert banner required by prompt) */}
          {showDisplacementAlert && (
            <div className="p-4 sm:p-5 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-800 shrink-0">
                  <ArrowDownRight className="w-6 h-6 text-amber-700" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                      Displacement Notice
                    </span>
                    <span className="text-xs font-mono text-amber-900 font-semibold">
                      Challenge C-GUM-100
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-amber-950">
                    Your proposal for C-GUM-100 is no longer leading.
                  </h3>
                  <p className="text-xs text-amber-850 leading-relaxed max-w-2xl">
                    Leading score is now <strong className="font-mono text-gray-900">84</strong>; your current draft scored{' '}
                    <strong className="font-mono text-gray-900">78</strong>. The proposal window closes in{' '}
                    <strong>3 days 4 hours</strong>. Review the rubric gap and resubmit.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/college/proposals/prop-1"
                  className="touch-target px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs transition"
                >
                  <span>View Breakdown & Resubmit</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowDisplacementAlert(false)}
                  className="text-xs text-amber-700 hover:underline px-2 py-1 font-mono"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Core Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#CCD1C7] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider block">
                Active Competitions
              </span>
              <div className="text-2xl font-extrabold font-mono text-[#102027] mt-1">4</div>
              <p className="text-[11px] text-[#2E7180] font-mono mt-1">2 closing this week</p>
            </div>

            <div className="bg-white border border-[#CCD1C7] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider block">
                Leading Submissions
              </span>
              <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-1">1</div>
              <p className="text-[11px] text-gray-500 font-mono mt-1">C-GUM-001 (Score 84)</p>
            </div>

            <div className="bg-white border border-[#CCD1C7] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider block">
                Won / Active Projects
              </span>
              <div className="text-2xl font-extrabold font-mono text-[#2E7180] mt-1">2</div>
              <p className="text-[11px] text-gray-500 font-mono mt-1">1 in pilot, 1 in procurement</p>
            </div>

            <div className="bg-white border border-[#CCD1C7] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider block">
                CSR Funding Pledged
              </span>
              <div className="text-2xl font-extrabold font-mono text-purple-700 mt-1">₹3,40,000</div>
              <p className="text-[11px] text-gray-500 font-mono mt-1">Tata Steel & CCL CSR</p>
            </div>
          </div>

          {/* Two Columns: Active Submissions & Projects Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Proposals in Competition */}
            <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#2E7180]" />
                  <h3 className="text-sm font-bold text-[#102027]">Active Proposals in Window</h3>
                </div>
                <Link
                  href="/college/problems"
                  className="text-xs font-mono font-bold text-[#2E7180] hover:underline"
                >
                  Browse All →
                </Link>
              </div>

              <div className="space-y-3">
                {/* Item 1: Leading */}
                <div className="p-3.5 bg-gray-50 border border-[#CCD1C7] rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-gray-800">CH-GUM-001</span>
                    <LeaderBadge state="leading" leadingScore={84} userScore={84} compact />
                  </div>
                  <h4 className="text-xs font-bold text-[#102027]">
                    Siren Relay for Official IMD/Damini Alerts + Low-Cost Field Shelters
                  </h4>
                  <div className="flex items-center justify-between pt-1">
                    <CountdownToClose leadingScore={84} compact />
                    <Link
                      href="/college/proposals/prop-1"
                      className="text-xs font-mono font-bold text-[#2E7180] hover:underline flex items-center gap-1"
                    >
                      Verdict & Rubric <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {/* Item 2: Outscored */}
                <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-gray-800">C-SAH-204</span>
                    <LeaderBadge state="outscored" leadingScore={84} userScore={78} compact />
                  </div>
                  <h4 className="text-xs font-bold text-[#102027]">
                    Mobile Solar Water Filtration & Disinfection Cart
                  </h4>
                  <div className="flex items-center justify-between pt-1">
                    <CountdownToClose leadingScore={84} compact />
                    <Link
                      href="/college/proposals/prop-1"
                      className="text-xs font-mono font-bold text-amber-800 hover:underline flex items-center gap-1"
                    >
                      Improve Draft <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Active Projects Tracker Preview */}
            <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#2E7180]" />
                  <h3 className="text-sm font-bold text-[#102027]">My Awarded R&D Projects</h3>
                </div>
                <Link
                  href="/college/projects"
                  className="text-xs font-mono font-bold text-[#2E7180] hover:underline"
                >
                  Manage Projects →
                </Link>
              </div>

              <div className="p-3.5 bg-[#F4F6F5] border border-[#CCD1C7] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#2E7180]">CH-GUM-001 (Awarded)</span>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                    PILOT STAGE
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#102027]">
                  Gumla Rural Lightning Siren Relay Network (12 Towers)
                </h4>
                <div className="text-xs text-gray-600 font-mono">
                  Funding: <strong>₹1,40,000 / ₹1,40,000 (100% Pledged)</strong> · Material: 800kg Steel in transit
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-gray-200">
                  <span className="text-[11px] font-mono text-amber-800 font-semibold">
                    1 dispatched delivery awaiting receipt confirmation
                  </span>
                  <Link
                    href="/college/projects"
                    className="text-xs font-mono font-bold text-[#2E7180] hover:underline"
                  >
                    Confirm Receipt →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
