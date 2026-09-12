'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  GraduationCap, 
  CheckCircle2, 
  MapPin, 
  Users, 
  Lightbulb, 
  FileText, 
  Send, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { SEED_CHALLENGES } from '@/data/seedData';

export default function CollegeProblemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ref = params?.ref as string;

  const challenge = SEED_CHALLENGES.find(c => c.ref === ref || c.id === ref) || SEED_CHALLENGES[0];

  const [teamName, setTeamName] = useState('BIT Mesra - HydroTech Team 4');
  const [approach, setApproach] = useState('');
  const [costEst, setCostEst] = useState('₹ 1,80,000');
  const [deployDays, setDeployDays] = useState(21);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      router.push('/college/projects');
    }, 2000);
  };

  return (
    <RoleGuard 
      allowedRoles={['university', 'coordinator', 'admin']} 
      title="Adopt Challenge & Submit Proposal"
      description="Register your university research team, define technical methodology, estimated pilot deployment timeline, and co-funding requirements."
    >
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* Back navigation */}
        <Link
          href="/college/problems"
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Problem Statements Catalog</span>
        </Link>

        {/* Problem Brief Header */}
        <div className="bg-white p-6 rounded-2xl border border-[#CCD1C7] space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                {challenge.ref || challenge.id}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                {challenge.category.toUpperCase()}
              </span>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
              PRIORITY {challenge.priority} · {challenge.priority_band.toUpperCase()}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#102027]">
            {challenge.title}
          </h1>

          <div className="p-4 bg-[#F4F6F5] rounded-xl text-xs text-gray-700 leading-relaxed space-y-2">
            <div className="font-bold text-[#102027] uppercase tracking-wider font-mono text-[11px]">
              Problem Statement:
            </div>
            <p>{challenge.problem}</p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-gray-600 font-mono">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-700" />
              District: {challenge.district}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-700" />
              Impact: ~{challenge.people_est.toLocaleString()} residents
            </span>
          </div>
        </div>

        {/* Proposal Submission Form */}
        {submitted ? (
          <div className="bg-blue-50 border border-blue-300 p-8 rounded-2xl text-center space-y-4 shadow-sm animate-in fade-in">
            <div className="w-16 h-16 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-blue-900">
              Proposal Registered Successfully!
            </h2>
            <p className="text-xs text-blue-700 max-w-md mx-auto">
              Your R&D adoption proposal has been submitted to the District Coordinator and CSR Co-Funding Board. Redirecting to Campus Projects...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-[#CCD1C7] space-y-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
              <GraduationCap className="w-5 h-5 text-blue-700" />
              <h2 className="text-lg font-bold text-[#102027]">
                University R&D Proposal Form
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">
                  Academic Team / Lab Name
                </label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">
                  Estimated Pilot Cost (CSR Grant Request)
                </label>
                <input
                  type="text"
                  required
                  value={costEst}
                  onChange={(e) => setCostEst(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-bold text-gray-700">
                  Technical Approach & Methodology
                </label>
                <textarea
                  rows={4}
                  required
                  value={approach}
                  onChange={(e) => setApproach(e.target.value)}
                  placeholder="Describe the engineering design, prototype materials, sensor payload, or local deployment workflow..."
                  className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">
                  Pilot Deployment Lead Time (Days)
                </label>
                <input
                  type="number"
                  required
                  value={deployDays}
                  onChange={(e) => setDeployDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-600 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <Link
                href="/college/problems"
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-100 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit R&D Proposal</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </RoleGuard>
  );
}
