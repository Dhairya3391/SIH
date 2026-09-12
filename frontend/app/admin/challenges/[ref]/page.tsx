'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  Shield, 
  ArrowLeft, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle, 
  Building, 
  UserCheck, 
  History,
  Save,
  Lock,
  Layers
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { SEED_CHALLENGES } from '@/data/seedData';

export default function AdminChallengeAuditPage() {
  const params = useParams();
  const router = useRouter();
  const ref = params?.ref as string;

  const challenge = SEED_CHALLENGES.find(c => c.ref === ref || c.id === ref) || SEED_CHALLENGES[0];

  const [overridePriority, setOverridePriority] = useState(challenge.priority);
  const [nodalDept, setNodalDept] = useState('Public Health & Engineering Department (PHED)');
  const [nodalOfficer, setNodalOfficer] = useState('Er. R. K. Mahato, Executive Engineer');
  const [escalationStatus, setEscalationStatus] = useState('normal');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  return (
    <RoleGuard 
      allowedRoles={['admin']} 
      title="Administrative Challenge Audit & Override"
      description="State executive authority to inspect raw multi-source reports, manually adjust priority ranking weights, and assign departmental accountability."
    >
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-rose-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Admin Command</span>
          </Link>
          <span className="text-xs font-mono text-gray-400">
            AUDIT KEY: #AUDIT-SEC-2026-9912
          </span>
        </div>

        {/* Challenge Summary Header */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#CCD1C7] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                {challenge.ref || challenge.id}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                {challenge.district} · {challenge.category.toUpperCase()}
              </span>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
              CURRENT PRIORITY: {challenge.priority}/100
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#102027]">
            {challenge.title}
          </h1>

          <p className="text-xs text-gray-600 leading-relaxed bg-[#F4F6F5] p-4 rounded-xl">
            {challenge.problem}
          </p>
        </div>

        {/* Override Form */}
        <form onSubmit={handleSave} className="bg-white p-6 sm:p-8 rounded-2xl border border-[#CCD1C7] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-rose-700" />
              <h2 className="text-lg font-bold text-[#102027]">
                Executive Override Parameters
              </h2>
            </div>
            {saved && (
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 animate-in fade-in">
                ✓ Overrides Saved to State Ledger
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Priority Slider */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                <span>Priority Score Override</span>
                <span className="font-mono text-rose-700 font-bold text-sm">{overridePriority} / 100</span>
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={overridePriority}
                onChange={(e) => setOverridePriority(Number(e.target.value))}
                className="w-full accent-rose-700"
              />
              <p className="text-[11px] text-gray-500">
                Manually promotes challenge into the immediate action queue across all district dashboards.
              </p>
            </div>

            {/* Escalation Level */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">
                Emergency Escalation Status
              </label>
              <select
                value={escalationStatus}
                onChange={(e) => setEscalationStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none font-semibold text-gray-700"
              >
                <option value="normal">Normal District Triage Protocol</option>
                <option value="expedited">Expedited (12h SLA Trigger)</option>
                <option value="red_alert">Red Alert · State Disaster Fund Release</option>
              </select>
            </div>

            {/* Nodal Department */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">
                Assigned Nodal Department
              </label>
              <input
                type="text"
                value={nodalDept}
                onChange={(e) => setNodalDept(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none"
              />
            </div>

            {/* Nodal Officer */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">
                Designated District Nodal Officer
              </label>
              <input
                type="text"
                value={nodalOfficer}
                onChange={(e) => setNodalOfficer(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Ledger Trail */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <div className="text-xs font-bold font-mono uppercase text-gray-700 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Immutable Ledger Hash Audit</span>
            </div>
            <div className="font-mono text-[11px] text-gray-500 break-all">
              Latest Hash: 7c89f14b2d5a361e0b0439f0d14b4866b1a37651a0293774de451e06c7482bc2
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Link
              href={`/challenge/${challenge.ref || challenge.id}`}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-100 transition"
            >
              View Public Challenge Brief
            </Link>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Administrative Override</span>
            </button>
          </div>
        </form>

      </div>
    </RoleGuard>
  );
}
