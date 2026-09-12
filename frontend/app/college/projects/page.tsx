'use client';

import React from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  ArrowLeft, 
  Sliders, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  TrendingUp, 
  Users, 
  Building,
  Award,
  ChevronRight
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { SEED_CHALLENGES } from '@/data/seedData';

export default function CollegeProjectsPage() {
  const activeProjects = [
    {
      id: 'proj-01',
      challengeRef: 'CHAL-WATER-001',
      challengeTitle: 'Subsurface Arsenic Contamination in Sahebganj Aquifer',
      team: 'BIT Mesra · Dept of Civil Engg',
      advisor: 'Dr. Anirban Roy',
      stage: 'Field Pilot (Phase 3)',
      progress: 75,
      funding: '₹ 2.4 L (Tata CSR)',
      district: 'Sahebganj',
      nextMilestone: 'Deploy 5 test filtration units at Taljhari block',
      dueDate: 'Sep 25, 2026'
    },
    {
      id: 'proj-02',
      challengeRef: 'CHAL-ROADS-004',
      challengeTitle: 'Monsoon Culvert Washout Bridge Failure',
      team: 'NIT Jamshedpur · Structural Lab',
      advisor: 'Prof. K. Sinha',
      stage: 'Prototype Testing (Phase 2)',
      progress: 50,
      funding: '₹ 3.8 L (Coal India CSR)',
      district: 'Gumla',
      nextMilestone: 'Load deflection stress test on recycled composite beam',
      dueDate: 'Oct 02, 2026'
    },
    {
      id: 'proj-03',
      challengeRef: 'CHAL-HEALTH-003',
      challengeTitle: 'Solar Cold-Chain Vaccine Carrier for Off-Grid PHCs',
      team: 'IIT ISM Dhanbad · Electronics & Power',
      advisor: 'Dr. V. Prasad',
      stage: 'Lab Benchmarking (Phase 1)',
      progress: 30,
      funding: '₹ 1.5 L (State Innovation Fund)',
      district: 'Palamu',
      nextMilestone: 'Thermal insulation hold-over test under 45°C ambient simulation',
      dueDate: 'Oct 15, 2026'
    },
  ];

  return (
    <RoleGuard 
      allowedRoles={['university', 'coordinator', 'admin']} 
      title="Active Campus Projects Tracker"
      description="Track university engineering capstones, research lab prototypes, grant expenditures, and milestone achievements in the field."
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-blue-700">
              <Link href="/college" className="hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Campus R&D Node
              </Link>
              <span>/</span>
              <span>Active Projects</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              Active University R&D Pilots & Capstone Projects
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Live engineering deployments solving high-priority district challenges.
            </p>
          </div>

          <Link
            href="/college/problems"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition shadow-sm"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Adopt Another Challenge</span>
          </Link>
        </div>

        {/* Project List */}
        <div className="space-y-6">
          {activeProjects.map((proj) => (
            <div
              key={proj.id}
              className="bg-white rounded-2xl border border-[#CCD1C7] p-6 shadow-sm hover:border-blue-400 transition space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {proj.challengeRef}
                    </span>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                      {proj.stage}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#102027]">
                    {proj.challengeTitle}
                  </h3>
                  <div className="text-xs text-gray-500">
                    Team: <strong>{proj.team}</strong> · Lead Advisor: {proj.advisor}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono text-gray-500">CSR Grant Allocation</div>
                  <div className="text-base font-bold text-purple-700 font-mono">{proj.funding}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-700">Milestone Progress</span>
                  <span className="font-mono text-blue-800">{proj.progress}% Completed</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
              </div>

              {/* Milestone Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F4F6F5] p-4 rounded-xl text-xs">
                <div>
                  <span className="text-gray-500 block font-mono">Current Target Milestone:</span>
                  <span className="font-bold text-[#102027]">{proj.nextMilestone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 block font-mono">Target Delivery:</span>
                    <span className="font-bold text-gray-800">{proj.dueDate}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block font-mono">District Deployment:</span>
                    <span className="font-bold text-gray-800">{proj.district}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Link
                  href={`/college/proposals/prop-101`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline"
                >
                  <span>View Proposal Rubric</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>

      </div>
    </RoleGuard>
  );
}
