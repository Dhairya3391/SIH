'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RefreshCw, 
  MapPin, 
  Users, 
  Flame, 
  CheckCircle2, 
  ExternalLink,
  PlusCircle
} from 'lucide-react';
import { fetchChallenges } from '@/lib/api';
import { Challenge } from '@/types/database';

export default function QueuePage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const res = await fetchChallenges();
      if (res.data) {
        setChallenges(res.data);
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Top 3 urgent challenges for "Needs Immediate Action" strip
  const immediateActionChallenges = challenges.slice(0, 3);
  const remainingChallenges = challenges.slice(3);

  const getPriorityChip = (score: number) => {
    if (score >= 75) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D94F45] animate-pulse" />
          {score} · CRITICAL
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-[#E07B2E]/15 text-[#9A4A12] border border-[#E07B2E]/30">
          {score} · HIGH
        </span>
      );
    }
    if (score >= 25) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-[#E5A83B]/15 text-[#8A5A00] border border-[#E5A83B]/30">
          {score} · MODERATE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-[#3867A6]/15 text-[#3867A6] border border-[#3867A6]/30">
        {score} · LONG-TERM
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
      {/* Ops Console Header */}
      <header className="bg-white border-b border-[#CCD1C7] px-4 py-3 sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-[#102027]">
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Coordinator Operations Console</span>
              <span className="text-[11px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                Live Queue
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-[#CCD1C7] hover:bg-gray-100 transition text-gray-600 flex items-center gap-1 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/report"
              className="bg-[#2E7180] hover:bg-[#245A66] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Submit New
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6">
        {/* 1. "NEEDS IMMEDIATE ACTION" STRIP */}
        <section className="bg-white rounded-2xl border-2 border-[#D94F45]/30 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-red-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-[#D94F45]/10 rounded-lg text-[#D94F45]">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#A8332A] uppercase tracking-wider font-mono">
                  Needs Immediate Action (Top Priority Hotspots)
                </h2>
                <p className="text-[11px] text-gray-500">
                  Ranked by multi-factor vulnerability and severity formula
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-[#D94F45] bg-red-50 px-2 py-0.5 rounded">
              3 Critical Items
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {immediateActionChallenges.map((item) => (
              <div 
                key={item.id} 
                className="bg-[#F4F6F5] p-3.5 rounded-xl border border-[#CCD1C7] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    {getPriorityChip(item.priority)}
                    <span className="text-[10px] font-mono text-gray-500 uppercase">{item.district}</span>
                  </div>
                  <h3 className="text-xs font-bold text-[#102027] line-clamp-2 mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-gray-600 line-clamp-2 mb-2">
                    {item.problem}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[11px]">
                  <span className="font-mono text-gray-500">{item.people_est} affected</span>
                  <span className="font-bold text-[#2E7180] hover:underline cursor-pointer">
                    Review Brief →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2. THE COMPLETE RANKED QUEUE */}
        <section className="bg-white rounded-2xl border border-[#CCD1C7] overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#CCD1C7] flex items-center justify-between">
            <h2 className="font-bold text-sm text-[#102027]">
              All Active Challenges ({challenges.length})
            </h2>
            <span className="text-xs text-gray-500 font-mono">
              Auto-refreshes on ground intake
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs text-gray-500">
              Loading queue...
            </div>
          ) : (
            <div className="divide-y divide-[#CCD1C7]">
              {challenges.map((challenge, idx) => (
                <div 
                  key={challenge.id}
                  className="p-4 hover:bg-[#F4F6F5]/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-mono text-xs font-bold text-gray-500 shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {getPriorityChip(challenge.priority)}
                        <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded capitalize">
                          {challenge.category}
                        </span>
                        <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {challenge.district}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#102027]">
                        {challenge.title}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {challenge.people_est} people
                        </span>
                        <span>·</span>
                        <span className="font-mono">{challenge.report_count} reports</span>
                        <span>·</span>
                        <span className="text-xs font-mono font-semibold text-[#2E7180]">
                          {challenge.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button 
                      onClick={() => alert(`Reviewing Brief ${challenge.id}\n\nProblem: ${challenge.problem}\n\nUnsure about: ${challenge.ai_unsure_about || 'None'}`)}
                      className="px-3 py-1.5 rounded-lg border border-[#2E7180] text-[#2E7180] hover:bg-teal-50 text-xs font-bold transition flex items-center gap-1"
                    >
                      Inspect Brief <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
