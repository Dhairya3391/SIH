'use client';

import React from 'react';
import { Loader2, ShieldCheck, Sparkles, Activity } from 'lucide-react';

interface LoadingSkeletonProps {
  message?: string;
  subMessage?: string;
  rows?: number;
}

export function LoadingSkeleton({
  message = 'Loading verified ground records...',
  subMessage = 'Fetching cryptographic ledger state and active resource swarms',
  rows = 4,
}: LoadingSkeletonProps) {
  return (
    <div className="w-full space-y-4 py-8 px-4 max-w-5xl mx-auto animate-pulse">
      {/* Informative loading banner */}
      <div className="p-4 bg-white border border-[#CCD1C7] rounded-xl flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#2E7180]/10 text-[#2E7180] rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-[#2E7180]" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-[#102027]">{message}</h4>
            <p className="text-[11px] text-gray-500 font-mono">{subMessage}</p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          PGVector Active
        </span>
      </div>

      {/* Header skeleton */}
      <div className="bg-white border border-[#CCD1C7] rounded-xl p-5 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>

      {/* Grid skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-[#CCD1C7] rounded-xl p-4 space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-100 rounded w-16" />
            </div>
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-4/5" />
            <div className="pt-2 border-t border-gray-100 flex justify-between">
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="h-3 bg-gray-100 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
