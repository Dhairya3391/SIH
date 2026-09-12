'use client';

import React from 'react';
import Link from 'next/link';
import { 
  FileText, 
  ArrowLeft, 
  Coins, 
  CheckCircle2, 
  Download, 
  ShieldCheck, 
  Building2, 
  HeartHandshake,
  ExternalLink
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';

export default function ContributionsPage() {
  const pledges = [
    {
      id: 'PLG-2026-001',
      challengeRef: 'CHAL-WATER-001',
      challengeTitle: 'Arsenic Contamination in Sahebganj Aquifer',
      item: 'Solar Submersible Water Pumps (4 units)',
      valuation: '₹ 3,20,000',
      date: 'Sep 10, 2026',
      status: 'dispatched',
      ledgerHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      taxCert: '80G-JH-2026-8942'
    },
    {
      id: 'PLG-2026-002',
      challengeRef: 'CHAL-HEALTH-003',
      challengeTitle: 'Solar Cold-Chain Vaccine Carrier for PHCs',
      item: 'Lithium Battery Packs (10 units)',
      valuation: '₹ 1,50,000',
      date: 'Sep 08, 2026',
      status: 'deployed',
      ledgerHash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
      taxCert: '80G-JH-2026-7731'
    },
    {
      id: 'PLG-2026-003',
      challengeRef: 'CHAL-ROADS-004',
      challengeTitle: 'Monsoon Culvert Washout Bridge Failure',
      item: 'Reinforced Pre-cast Concrete Slabs (24 units)',
      valuation: '₹ 4,80,000',
      date: 'Sep 02, 2026',
      status: 'verified_impact',
      ledgerHash: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589',
      taxCert: '80G-JH-2026-6649'
    }
  ];

  return (
    <RoleGuard 
      allowedRoles={['industry', 'coordinator', 'admin']} 
      title="CSR Contributions & Impact Ledger"
      description="Cryptographically verifiable audit log of corporate CSR contributions, dispatch acknowledgments, and 80G tax exemption receipts."
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-purple-700">
              <Link href="/needs" className="hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Resource Swarm
              </Link>
              <span>/</span>
              <span>Contributions & Ledger</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              Corporate CSR Impact & Tax Audit Ledger
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Corporate Account: <strong>Tata Steel CSR Foundation</strong> · Registered Entity ID: <strong>CSR-IN-JH-0042</strong>
            </p>
          </div>

          <Link
            href="/needs"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition shadow-sm"
          >
            <HeartHandshake className="w-4 h-4" />
            <span>Pledge More Resources</span>
          </Link>
        </div>

        {/* Ledger Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">Total Capital Committed</div>
            <div className="text-2xl font-bold text-purple-700 mt-1">₹ 9,50,000</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-emerald-700 font-mono">Impact Verified</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">3 Projects</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-blue-700 font-mono">Tax Receipts Issued</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">3 Certificates</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">Ledger State</div>
            <div className="text-2xl font-bold text-[#102027] mt-1">Immutable</div>
          </div>
        </div>

        {/* Pledges List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#102027]">
            Verified Contributions & Tax Records
          </h2>

          <div className="space-y-4">
            {pledges.map((plg) => (
              <div
                key={plg.id}
                className="bg-white rounded-2xl border border-[#CCD1C7] p-6 shadow-sm space-y-4 hover:border-purple-400 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                        {plg.id}
                      </span>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        STATUS: {plg.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{plg.date}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#102027]">
                      {plg.item}
                    </h3>
                    <div className="text-xs text-gray-500">
                      Target Challenge: <strong>{plg.challengeTitle}</strong> ({plg.challengeRef})
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono text-gray-500">CSR Valuation</div>
                    <div className="text-lg font-bold text-purple-700 font-mono">{plg.valuation}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#F4F6F5] p-3 rounded-xl">
                  <div>
                    <span className="text-gray-500 font-mono block">80G Exemption Receipt:</span>
                    <span className="font-bold text-[#102027]">{plg.taxCert}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-mono block">Blockchain Ledger Hash:</span>
                    <span className="font-mono text-gray-700 truncate block text-[11px]">
                      {plg.ledgerHash}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 transition">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Tax Certificate</span>
                  </button>
                  <Link
                    href={`/challenge/${plg.challengeRef}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold transition"
                  >
                    <span>Inspect Target Challenge</span>
                    <ExternalLink className="w-3.5 h-3.5" />
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
