'use client';

import React from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  Search, 
  Sliders, 
  FileText, 
  CheckCircle2, 
  Award, 
  Users, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  Zap,
  Building
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { SEED_CHALLENGES } from '@/data/seedData';

export default function CollegeDashboardPage() {
  const adoptedChallenges = SEED_CHALLENGES.filter(c => ['TEAM_FORMED', 'SOLUTION_PROPOSED', 'PILOT'].includes(c.status));
  const openChallenges = SEED_CHALLENGES.filter(c => ['VERIFIED', 'OPEN'].includes(c.status));

  return (
    <RoleGuard 
      allowedRoles={['university', 'coordinator', 'admin']} 
      title="University & R&D Hub Console"
      description="Connect academic labs, student engineering capstones, and faculty researchers with real-world district challenges."
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-blue-700">
              <GraduationCap className="w-4 h-4" />
              <span>Academic R&D · Capstone Matching</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              Birla Institute of Technology (BIT) Mesra · R&D Node
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Node Lead: <strong>Dr. Anirban Roy</strong> · Dept. of Civil & Environmental Engineering
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/college/problems"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition shadow-sm"
            >
              <Search className="w-4 h-4" />
              <span>Browse Problem Catalog</span>
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">Adopted Challenges</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">4</div>
            <div className="text-[11px] text-gray-400 mt-1">Active departmental teams</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">Student Capstone Teams</div>
            <div className="text-2xl font-bold text-[#102027] mt-1">12</div>
            <div className="text-[11px] text-gray-400 mt-1">36 student researchers</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">CSR Grant Co-Funding</div>
            <div className="text-2xl font-bold text-purple-700 mt-1">₹ 14.5 L</div>
            <div className="text-[11px] text-gray-400 mt-1">Pledged by Tata / Coal India</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">Deployments in Field</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">2</div>
            <div className="text-[11px] text-gray-400 mt-1">Live pilot trials</div>
          </div>
        </div>

        {/* Quick Nav Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/college/problems"
            className="group bg-white p-6 rounded-2xl border border-[#CCD1C7] hover:border-blue-500 transition shadow-sm space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#102027] group-hover:text-blue-700 transition">
                Problem Statements Catalog
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Explore real district problems compiled by AI from citizen reports, ready for faculty adoption.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-blue-700 flex items-center gap-1">
              <span>View {openChallenges.length} Unsolved Challenges</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          <Link
            href="/college/projects"
            className="group bg-white p-6 rounded-2xl border border-[#CCD1C7] hover:border-blue-500 transition shadow-sm space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#102027] group-hover:text-teal-700 transition">
                Active Campus R&D Projects
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Track lab prototypes, testing results, field deployment schedules, and milestone deliveries.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-teal-700 flex items-center gap-1">
              <span>Manage 4 Active Projects</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          <Link
            href="/college/proposals/prop-101"
            className="group bg-white p-6 rounded-2xl border border-[#CCD1C7] hover:border-blue-500 transition shadow-sm space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#102027] group-hover:text-purple-700 transition">
                Proposal Readiness Matrix
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Review automated technical, safety, scalability, and cost scoring for submitted solutions.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-purple-700 flex items-center gap-1">
              <span>Inspect Evaluation Rubric</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </Link>
        </div>

        {/* Adopted Challenges Section */}
        <div className="bg-white rounded-2xl border border-[#CCD1C7] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#102027]">
                Challenges Adopted by BIT Mesra
              </h2>
              <p className="text-xs text-gray-500">
                Official R&D commitments registered on the JharSetu state ledger.
              </p>
            </div>
            <Link
              href="/college/projects"
              className="text-xs font-bold text-blue-700 hover:underline"
            >
              View Full Tracker
            </Link>
          </div>

          <div className="space-y-3">
            {adoptedChallenges.slice(0, 3).map((ch) => (
              <div 
                key={ch.id}
                className="p-4 rounded-xl bg-[#F4F6F5] border border-[#CCD1C7] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {ch.ref || ch.id}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                      {ch.district} · {ch.category}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#102027]">
                    {ch.title}
                  </h4>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    STATUS: {ch.status}
                  </span>
                  <Link
                    href={`/college/problems/${ch.ref || ch.id}`}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#CCD1C7] text-xs font-bold text-[#102027] hover:bg-gray-50 transition"
                  >
                    View Brief
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </RoleGuard>
  );
}
