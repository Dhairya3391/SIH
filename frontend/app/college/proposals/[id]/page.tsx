'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Award, 
  CheckCircle2, 
  GraduationCap, 
  Layers, 
  FileText, 
  ShieldCheck, 
  Clock, 
  TrendingUp,
  Cpu,
  Coins,
  Shield,
  Users
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';

export default function CollegeProposalScorecardPage() {
  const params = useParams();
  const id = params?.id as string;

  // Evaluation breakdown
  const proposal = {
    id: id || 'prop-101',
    title: 'Low-Cost IoT Solar-Powered Water Quality & Arsenic Sensor Node',
    team: 'BIT Mesra · Team HydroSense',
    lead: 'Dr. Anirban Roy (Faculty Advisor) & Priya Kumari (Lead Student)',
    readinessScore: 88,
    status: 'approved_for_pilot',
    cost: '₹ 1,85,000',
    timeline: '21 days',
    ratings: {
      technical: { score: 18, max: 20, label: 'Technical Feasibility' },
      cost: { score: 14, max: 15, label: 'Cost Effectiveness' },
      time: { score: 13, max: 15, label: 'Deployment Speed' },
      local_res: { score: 13, max: 15, label: 'Use of Local Materials' },
      safety: { score: 14, max: 15, label: 'Environmental & Community Safety' },
      community: { score: 9, max: 10, label: 'Community Usability' },
      scalability: { score: 7, max: 10, label: 'Multi-District Scalability' },
    },
    aiVerdict: 'Strong candidate for immediate pilot deployment in Sahebganj block. Low unit fabrication cost (under ₹4,000/unit) with off-grid solar recharge and GSM telemetry matches local power constraints.'
  };

  return (
    <RoleGuard 
      allowedRoles={['university', 'coordinator', 'admin']} 
      title="Proposal Evaluation Scorecard"
      description="Multi-factor technical rubric evaluating readiness, safety, local material utilization, and district scalability for university engineering proposals."
    >
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* Back navigation */}
        <Link
          href="/college"
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to College Console</span>
        </Link>

        {/* Header Score Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#CCD1C7] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  PROPOSAL #{proposal.id.toUpperCase()}
                </span>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  APPROVED FOR PILOT
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#102027] mt-2">
                {proposal.title}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Submitted by: <strong>{proposal.team}</strong> ({proposal.lead})
              </p>
            </div>

            {/* Overall Readiness Badge */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-blue-50 border border-blue-200 text-center shrink-0">
              <span className="text-[10px] font-mono font-bold text-blue-700 uppercase">
                Readiness Score
              </span>
              <span className="text-3xl font-extrabold text-blue-800 font-mono">
                {proposal.readinessScore}
                <span className="text-sm font-normal text-blue-600">/100</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-bold mt-0.5">
                Top 5% Tier 1 Pilot
              </span>
            </div>
          </div>

          {/* AI Verdict Summary */}
          <div className="bg-[#F4F6F5] p-4 rounded-xl border border-[#CCD1C7] space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-[#2E7180]">
              <ShieldCheck className="w-4 h-4" />
              <span>Technical Review & Automated Screening Verdict</span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              {proposal.aiVerdict}
            </p>
          </div>

          {/* 7-Factor Rubric Breakdown */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-gray-700">
              Evaluation Rubric Breakdown (7 Dimensions)
            </h2>

            <div className="space-y-3">
              {Object.entries(proposal.ratings).map(([key, item]) => {
                const pct = (item.score / item.max) * 100;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-[#102027]">
                      <span>{item.label}</span>
                      <span className="font-mono text-blue-800">
                        {item.score} / {item.max} ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              Co-Funding: <strong className="text-gray-800">{proposal.cost}</strong> · Deployment Lead Time: <strong className="text-gray-800">{proposal.timeline}</strong>
            </div>
            <Link
              href="/college/projects"
              className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition shadow-sm text-center"
            >
              View Active Campus Projects
            </Link>
          </div>
        </div>

      </div>
    </RoleGuard>
  );
}
