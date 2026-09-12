'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Clock, 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ShieldAlert, 
  Flame, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminSLAPage() {
  const slaStats = [
    { district: 'Sahebganj', avgTriageHours: 18.4, breaches: 1, compliancePct: 92, status: 'warning' },
    { district: 'Gumla', avgTriageHours: 12.1, breaches: 0, compliancePct: 100, status: 'good' },
    { district: 'Palamu', avgTriageHours: 28.5, breaches: 1, compliancePct: 84, status: 'critical' },
    { district: 'Dhanbad', avgTriageHours: 16.2, breaches: 0, compliancePct: 96, status: 'good' },
    { district: 'Ranchi', avgTriageHours: 9.8, breaches: 0, compliancePct: 100, status: 'good' },
  ];

  const activeBreaches = [
    {
      id: 'SLA-BREACH-01',
      challengeRef: 'CHAL-WATER-001',
      title: 'Subsurface Arsenic Contamination in Sahebganj Aquifer',
      district: 'Sahebganj',
      elapsedHours: 36,
      slaLimit: '24 Hours (Critical Tier)',
      department: 'PHED Sahebganj Division',
      actionNeeded: 'Immediate Nodal Officer Response or State Fund Reallocation'
    },
    {
      id: 'SLA-BREACH-02',
      challengeRef: 'CHAL-HEALTH-003',
      title: 'Solar Cold-Chain Vaccine Carrier for Off-Grid PHCs',
      district: 'Palamu',
      elapsedHours: 32,
      slaLimit: '24 Hours (Critical Tier)',
      department: 'District Health Society, Daltonganj',
      actionNeeded: 'Expedite University Capstone Partner Matching'
    }
  ];

  return (
    <RoleGuard 
      allowedRoles={['admin']} 
      title="SLA Compliance & District Escalations"
      description="Real-time monitoring of response latency, departmental triage bottlenecks, and automated state-level escalation triggers."
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-rose-700">
              <Link href="/admin" className="hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Admin Command
              </Link>
              <span>/</span>
              <span>SLA Telemetry</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              District SLA Compliance & Automated Escalations
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Thresholds: <strong>Critical (24h)</strong> · <strong>High (72h)</strong> · <strong>Moderate (7 Days)</strong>
            </p>
          </div>

          <span className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 font-mono text-xs font-bold">
            2 Escalations Active
          </span>
        </div>

        {/* SLA Compliance Table */}
        <div className="bg-white rounded-2xl border border-[#CCD1C7] p-6 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-[#102027]">
            District Response Time Benchmarks
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-mono uppercase bg-gray-50">
                  <th className="p-3">District</th>
                  <th className="p-3">Avg Triage Latency</th>
                  <th className="p-3">SLA Adherence</th>
                  <th className="p-3">Breaches (&gt;24h)</th>
                  <th className="p-3">Health Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slaStats.map((st) => (
                  <tr key={st.district}>
                    <td className="p-3 font-bold text-[#102027]">{st.district}</td>
                    <td className="p-3 font-mono font-semibold">{st.avgTriageHours} Hours</td>
                    <td className="p-3 font-mono font-bold text-gray-800">{st.compliancePct}%</td>
                    <td className="p-3 font-mono">
                      {st.breaches > 0 ? (
                        <span className="text-rose-700 font-bold">{st.breaches} Breach</span>
                      ) : (
                        <span className="text-emerald-700">0 Breaches</span>
                      )}
                    </td>
                    <td className="p-3">
                      {st.status === 'good' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          Optimal
                        </span>
                      ) : st.status === 'warning' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                          At Risk
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                          Breached
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Escalation Tickets */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-[#102027] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>Active SLA Breach Escalation Tickets</span>
          </h2>

          <div className="space-y-4">
            {activeBreaches.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                        {b.id}
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300">
                        ELAPSED: {b.elapsedHours}h (LIMIT: {b.slaLimit})
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#102027]">
                      {b.title}
                    </h3>
                    <div className="text-xs text-gray-500">
                      Nodal Responsibility: <strong>{b.department}</strong> ({b.district})
                    </div>
                  </div>

                  <Link
                    href={`/admin/challenges/${b.challengeRef}`}
                    className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition shadow-sm shrink-0 flex items-center gap-1.5"
                  >
                    <span>Execute State Override</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="p-3.5 bg-rose-50/60 rounded-xl text-xs text-rose-900 font-medium">
                  <strong>Recommended State Action:</strong> {b.actionNeeded}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </RoleGuard>
  );
}
