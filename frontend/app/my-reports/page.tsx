'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Sparkles,
  ArrowRight,
  PhoneCall,
  Volume2,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { SEED_REPORTS, SEED_CHALLENGES } from '@/data/seedData';
import { useAuth } from '@/lib/auth';

export default function MyReportsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [customReports, setCustomReports] = useState<any[]>([]);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('jharsetu_custom_reports');
      if (saved) setCustomReports(JSON.parse(saved));
    } catch {}
  }, []);

  // Combine custom newly submitted reports with seed reports
  const myReports = [...customReports, ...SEED_REPORTS.filter(r => r.district === 'Gumla' || r.reporter_name?.includes('Sunita') || true)].slice(0, 6);

  return (
    <RoleGuard 
      allowedRoles={['citizen', 'coordinator', 'admin']} 
      title="Citizen Report Tracking"
      description="Track the status of your submitted community issues, view AI transcription notes, and see which college teams are working on solutions."
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-[#2E7180]">
              <FileText className="w-4 h-4" />
              <span>Citizen Service Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              My Submissions & Community Grievances
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Registered Reporter: <strong>Sunita Soren</strong> (+91 94311-XXXXX) · Gumla District
            </p>
          </div>

          <Link
            href="/report"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2E7180] text-white font-bold text-sm hover:bg-[#235864] transition shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Submit New Report</span>
          </Link>
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">Total Reports Filed</div>
            <div className="text-2xl font-bold text-[#102027] mt-1">4</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-amber-700 font-mono">Field Verified</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">3</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-[#2E7180] font-mono">Adopted by College</div>
            <div className="text-2xl font-bold text-[#2E7180] mt-1">2</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-emerald-700 font-mono">Action Deployed</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">1</div>
          </div>
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#102027] flex items-center justify-between">
            <span>Submitted Issues Timeline</span>
            <span className="text-xs text-gray-500 font-normal">Real-time status updates</span>
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {myReports.map((report, idx) => {
              const matchedChallenge = SEED_CHALLENGES.find(c => c.district === report.district) || SEED_CHALLENGES[0];
              const isFirst = idx === 0;

              return (
                <div 
                  key={report.id}
                  className="bg-white rounded-xl border border-[#CCD1C7] p-5 hover:border-[#2E7180] transition space-y-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          REF #{report.id.toUpperCase()}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {report.category.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {new Date(report.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[#102027]">
                        {report.original_text}
                      </h3>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isFirst ? 'Adopted by BIT Mesra' : 'Verified by Field Officer'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata & Location */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600 bg-[#F4F6F5] p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#2E7180]" />
                      <span>{report.district} ({report.village || 'Panchayat Area'})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>Est. {report.people_est} People Affected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>AI Pipeline: Multilingual Whisper + GPT</span>
                    </div>
                  </div>

                  {/* Solved Challenge Link */}
                  {matchedChallenge && (
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50/50 p-3 rounded-lg border border-teal-100">
                      <div>
                        <div className="text-[11px] font-mono font-bold uppercase text-[#2E7180]">
                          Compiled Societal Challenge:
                        </div>
                        <div className="text-xs font-bold text-[#102027]">
                          {matchedChallenge.title}
                        </div>
                      </div>
                      <Link
                        href={`/challenge/${matchedChallenge.ref || matchedChallenge.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E7180] hover:underline shrink-0"
                      >
                        <span>View Full Challenge</span>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </RoleGuard>
  );
}
