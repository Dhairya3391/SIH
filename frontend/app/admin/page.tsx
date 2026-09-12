'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Clock, 
  AlertTriangle, 
  Radio, 
  Flame, 
  Activity, 
  CheckCircle2, 
  TrendingUp, 
  Server, 
  Sliders,
  ChevronRight,
  RefreshCw,
  Building2,
  Users
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { SEED_CHALLENGES, SEED_REGIONS } from '@/data/seedData';

export default function AdminDashboardPage() {
  const [isCrisisGlobal, setIsCrisisGlobal] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<'healthy' | 'degraded'>('healthy');

  const challenges = SEED_CHALLENGES;
  const criticalCount = challenges.filter(c => c.priority >= 75).length;
  const highCount = challenges.filter(c => c.priority >= 55 && c.priority < 75).length;
  const moderateCount = challenges.filter(c => c.priority < 55).length;

  return (
    <RoleGuard 
      allowedRoles={['admin']} 
      title="State Administrative Command"
      description="Executive authority to oversee multi-district societal challenges, toggle emergency crisis response protocols, audit AI routing decisions, and enforce SLA thresholds."
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-rose-700">
              <Shield className="w-4 h-4" />
              <span>Government of Jharkhand · Planning & Disaster Secretariat</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              State Societal Operations Command
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Authorized Officer: <strong>Principal Secretary (Disaster & Rural Dev)</strong> · Clearance Level 4
            </p>
          </div>

          {/* Emergency Crisis Mode Switch */}
          <div className="flex items-center gap-4 bg-rose-50 border border-rose-200 p-3 rounded-2xl shrink-0">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                <Flame className="w-4 h-4 text-rose-600" />
                State Emergency Protocol
              </span>
              <span className="text-[11px] text-rose-700 font-mono">
                {isCrisisGlobal ? 'ACTIVE · Priority Overridden' : 'PEACETIME · Standard Flow'}
              </span>
            </div>
            <button
              onClick={() => setIsCrisisGlobal(!isCrisisGlobal)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition ${
                isCrisisGlobal ? 'bg-rose-600 justify-end' : 'bg-gray-300 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md" />
            </button>
          </div>
        </div>

        {/* Telemetry & SLA Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">Pipeline Ingest Health</div>
            <div className="text-lg font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span>OPERATIONAL (99.9%)</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">SMS, Web, Voice Whisper</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-rose-700 font-mono">Critical Bottlenecks (SLA &gt; 24h)</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">2 Breaches</div>
            <Link href="/admin/sla" className="text-[11px] text-rose-600 font-bold hover:underline mt-1 block">
              Inspect SLA Dashboard →
            </Link>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">Total Active Challenges</div>
            <div className="text-2xl font-bold text-[#102027] mt-1">{challenges.length} Across State</div>
            <div className="text-[11px] text-gray-400 mt-1">{criticalCount} Critical · {highCount} High</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-purple-700 font-mono">CSR Grant Co-Funding</div>
            <div className="text-2xl font-bold text-purple-700 mt-1">₹ 43.0 L</div>
            <div className="text-[11px] text-gray-400 mt-1">7 Partner Corporations</div>
          </div>
        </div>

        {/* Quick Nav Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/admin/sla"
            className="group bg-white p-6 rounded-2xl border border-[#CCD1C7] hover:border-rose-500 transition shadow-sm space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#102027] group-hover:text-rose-700 transition">
                SLA Compliance & Escalations
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Monitor triage response times per district, identify departmental bottlenecks, and auto-escalate stagnant challenges.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-rose-700 flex items-center gap-1">
              <span>Review 2 Active Escalations</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          <Link
            href="/admin/challenges/CHAL-WATER-001"
            className="group bg-white p-6 rounded-2xl border border-[#CCD1C7] hover:border-rose-500 transition shadow-sm space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#102027] group-hover:text-blue-700 transition">
                Administrative Override & Nodal Assignment
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Audit challenge scoring parameters, manually override AI priority weights, and assign district nodal officers.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-blue-700 flex items-center gap-1">
              <span>Open Audit Console</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          <Link
            href="/queue"
            className="group bg-white p-6 rounded-2xl border border-[#CCD1C7] hover:border-rose-500 transition shadow-sm space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#102027] group-hover:text-teal-700 transition">
                Live State Operations Queue
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Direct view into district coordinator triage pipelines, field verifications, and resource deployments.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-teal-700 flex items-center gap-1">
              <span>View All Challenges</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>
        </div>

        {/* District Breakdown Table */}
        <div className="bg-white rounded-2xl border border-[#CCD1C7] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#102027]">
                District Preparedness & Challenge Distribution
              </h2>
              <p className="text-xs text-gray-500">
                Aggregated cross-district metrics from the decentralized ingestion engine.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-mono uppercase bg-gray-50">
                  <th className="p-3">District</th>
                  <th className="p-3">Critical (&gt;75)</th>
                  <th className="p-3">Total Issues</th>
                  <th className="p-3">Impact Est.</th>
                  <th className="p-3">Nodal Agency</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-3 font-bold text-[#102027]">Sahebganj</td>
                  <td className="p-3 font-mono font-bold text-rose-700">1 Critical</td>
                  <td className="p-3 font-mono">2 Issues</td>
                  <td className="p-3 font-mono">~1,800</td>
                  <td className="p-3">Public Health & Engg (PHED)</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                      Active Triage
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[#102027]">Gumla</td>
                  <td className="p-3 font-mono font-bold text-rose-700">1 Critical</td>
                  <td className="p-3 font-mono">2 Issues</td>
                  <td className="p-3 font-mono">~950</td>
                  <td className="p-3">Rural Works Dept (RWD)</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      Deployed / Pilot
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[#102027]">Palamu</td>
                  <td className="p-3 font-mono text-gray-700">0 Critical</td>
                  <td className="p-3 font-mono">1 Issue</td>
                  <td className="p-3 font-mono">~450</td>
                  <td className="p-3">District Health Society</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                      R&D Solution
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[#102027]">Dhanbad</td>
                  <td className="p-3 font-mono text-gray-700">0 Critical</td>
                  <td className="p-3 font-mono">1 Issue</td>
                  <td className="p-3 font-mono">~600</td>
                  <td className="p-3">Mines Environment Board</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 font-bold">
                      Under Review
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </RoleGuard>
  );
}
