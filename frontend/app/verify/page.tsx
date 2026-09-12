'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  MapPin, 
  AlertTriangle, 
  Clock, 
  Camera, 
  Navigation, 
  ArrowRight,
  Filter,
  ShieldCheck,
  Search
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { SEED_REPORTS } from '@/data/seedData';

export default function VerifyQueuePage() {
  const [districtFilter, setDistrictFilter] = useState('all');
  const [search, setSearch] = useState('');

  const reports = SEED_REPORTS.filter(r => {
    if (districtFilter !== 'all' && r.district.toLowerCase() !== districtFilter.toLowerCase()) return false;
    if (search && !r.original_text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <RoleGuard 
      allowedRoles={['volunteer', 'coordinator', 'admin']} 
      title="Ground Verifier Console"
      description="Field verification protocol for volunteer coordinators and ground officers to inspect community reports, capture geocoded proof, and corroborate severity scores."
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-amber-700">
              <ShieldCheck className="w-4 h-4" />
              <span>Field Operations · Ground Verification</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              Field Verification & Signal Corroboration Queue
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Active Verifier: <strong>Sanjay Kisku</strong> · Assigned Zone: <strong>Torpa / Gumla Sub-division</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 font-mono text-xs font-bold">
              {reports.length} Reports Awaiting Ground Check
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#CCD1C7]">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none"
            >
              <option value="all">All Districts (5)</option>
              <option value="Gumla">Gumla</option>
              <option value="Sahebganj">Sahebganj</option>
              <option value="Palamu">Palamu</option>
              <option value="Dhanbad">Dhanbad</option>
              <option value="Ranchi">Ranchi</option>
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reports or symptoms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#2E7180]"
            />
          </div>
        </div>

        {/* Reports Verification Grid */}
        <div className="space-y-4">
          {reports.map((report, idx) => {
            const isUrgent = report.urgency >= 4;
            const distanceEst = ((idx + 1) * 3.4).toFixed(1);

            return (
              <div 
                key={report.id}
                className="bg-white rounded-xl border border-[#CCD1C7] p-5 hover:border-amber-400 transition space-y-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {report.id.toUpperCase()}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                        {report.category.toUpperCase()}
                      </span>
                      {isUrgent && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> URGENCY {report.urgency}/5
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[#102027]">
                      {report.original_text}
                    </h3>
                  </div>

                  <div className="shrink-0">
                    <Link
                      href={`/verify/${report.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Start Field Check</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-600 bg-[#F4F6F5] p-3 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    <span>{report.district} ({report.village || 'Field site'})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-amber-700" />
                    <span className="font-semibold text-amber-800">~{distanceEst} km away</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <span>~{report.people_est} residents affected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                    <span>Reporter: {report.reporter_name || 'Community Member'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </RoleGuard>
  );
}
