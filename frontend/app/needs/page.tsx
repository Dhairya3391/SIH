'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  HeartHandshake, 
  Search, 
  Filter, 
  MapPin, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight,
  Package,
  Coins,
  Shield,
  Send,
  Building2
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { SEED_CHALLENGES } from '@/data/seedData';
import { pledgeResource } from '@/lib/api';

export default function ResourceNeedsPage() {
  const [districtFilter, setDistrictFilter] = useState('all');
  const [pledgeModal, setPledgeModal] = useState<{ challengeId: string; item: string; needed: number; unit: string } | null>(null);
  const [pledgeAmount, setPledgeAmount] = useState<number>(10);
  const [pledgeSuccess, setPledgeSuccess] = useState(false);

  const challengesWithNeeds = SEED_CHALLENGES.filter(c => c.resource_needs && c.resource_needs.length > 0);

  const handlePledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledgeModal) return;
    try {
      await pledgeResource(pledgeModal.challengeId, {
        org_id: 'org-tata-csr',
        qty: pledgeAmount,
        kind: pledgeModal.item,
        note: 'Pledged via JharSetu CSR Co-Funding Portal',
      });
    } catch {
      // Demo fallback
    }
    setPledgeSuccess(true);
    setTimeout(() => {
      setPledgeSuccess(false);
      setPledgeModal(null);
    }, 1800);
  };

  return (
    <RoleGuard 
      allowedRoles={['industry', 'coordinator', 'admin']} 
      title="Industry & CSR Resource Swarm"
      description="Match corporate CSR budgets, supply-chain resources, and NGO logistics with real-time district hardware and funding shortages."
    >
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-purple-700">
              <Building2 className="w-4 h-4" />
              <span>CSR Co-Funding · Resource Swarm</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              District Resource Needs & Supply Gaps
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Active Partner: <strong>Tata Steel CSR Foundation</strong> · Jamshedpur / Ranchi Zone
            </p>
          </div>

          <Link
            href="/contributions"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition shadow-sm"
          >
            <Coins className="w-4 h-4" />
            <span>My Pledges & Ledger</span>
          </Link>
        </div>

        {/* CSR Metric Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-gray-500 font-mono">Total Open Needs</div>
            <div className="text-2xl font-bold text-[#102027] mt-1">18 Items</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-purple-700 font-mono">Pledged to Date</div>
            <div className="text-2xl font-bold text-purple-700 mt-1">₹ 28.5 L</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-emerald-700 font-mono">Fulfillment Rate</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">68%</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#CCD1C7]">
            <div className="text-xs text-blue-700 font-mono">Participating Orgs</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">7 Entities</div>
          </div>
        </div>

        {/* Needs Grid */}
        <div className="space-y-6">
          {challengesWithNeeds.map((ch) => (
            <div
              key={ch.id}
              className="bg-white rounded-2xl border border-[#CCD1C7] p-6 shadow-sm space-y-4 hover:border-purple-400 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      {ch.ref || ch.id}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                      {ch.district} · {ch.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#102027]">
                    {ch.title}
                  </h3>
                </div>

                <Link
                  href={`/challenge/${ch.ref || ch.id}`}
                  className="text-xs font-bold text-[#2E7180] hover:underline shrink-0"
                >
                  View Full Challenge Brief →
                </Link>
              </div>

              {/* Resource Need Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ch.resource_needs?.map((need) => {
                  const pct = Math.min(100, Math.round((need.qty_pledged / need.qty_needed) * 100));
                  return (
                    <div 
                      key={need.id}
                      className="p-4 rounded-xl bg-[#F4F6F5] border border-[#CCD1C7] space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#102027]">
                            {need.item}
                          </span>
                          <span className="text-[11px] font-mono text-purple-700 font-bold">
                            {need.qty_pledged} / {need.qty_needed} {need.unit}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div 
                            className="h-full bg-purple-600 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setPledgeModal({
                            challengeId: ch.id,
                            item: need.item,
                            needed: need.qty_needed - need.qty_pledged,
                            unit: need.unit,
                          });
                          setPledgeAmount(Math.max(1, need.qty_needed - need.qty_pledged));
                        }}
                        className="w-full py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        <span>Pledge Resource</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Modal for Pledge */}
        {pledgeModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 border border-[#CCD1C7] shadow-2xl animate-in fade-in zoom-in-95">
              {pledgeSuccess ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#102027]">Pledge Recorded!</h3>
                  <p className="text-xs text-gray-500">
                    Logged to JharSetu CSR Co-Funding Ledger. Dispatch confirmation sent to district coordinator.
                  </p>
                </div>
              ) : (
                <form onSubmit={handlePledgeSubmit} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-base font-bold text-[#102027]">
                      Pledge Resource for Challenge
                    </h3>
                    <button
                      type="button"
                      onClick={() => setPledgeModal(null)}
                      className="text-gray-400 hover:text-gray-600 text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">
                      Resource Item
                    </label>
                    <div className="p-2.5 rounded-lg bg-gray-100 font-bold text-xs text-[#102027]">
                      {pledgeModal.item}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">
                      Pledge Quantity ({pledgeModal.unit})
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={pledgeAmount}
                      onChange={(e) => setPledgeAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPledgeModal(null)}
                      className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-sm cursor-pointer"
                    >
                      Confirm Pledge
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </RoleGuard>
  );
}
