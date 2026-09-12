'use client';

import React from 'react';
import { FileText, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

export interface RubricCriterion {
  id: string;
  name: string;
  score: number;
  max: number;
  reason: string;
  page?: number;
}

interface RubricBreakdownProps {
  criteria?: RubricCriterion[];
  ratings?: {
    technical?: number;
    cost?: number;
    time?: number;
    local_res?: number;
    safety?: number;
    community?: number;
    scalability?: number;
  };
  reasons?: Record<string, string>;
  pages?: Record<string, number>;
  onJumpToPage?: (page: number) => void;
  activePage?: number;
}

const DEFAULT_RUBRIC_DEF: Array<{ id: string; name: string; max: number; defaultReason: string; defaultPage: number }> = [
  { id: 'technical', name: 'Technical Feasibility', max: 20, defaultReason: 'Clear system architecture with low-power ESP32 microcontroller and GSM backup.', defaultPage: 2 },
  { id: 'cost', name: 'Cost Realism & Efficiency', max: 15, defaultReason: 'Line-item BOM well within regional disaster mitigation budget with realistic quotes.', defaultPage: 4 },
  { id: 'time', name: 'Time to Deployment', max: 15, defaultReason: '28-day deployment plan with parallel assembly and village community orientation.', defaultPage: 3 },
  { id: 'local_res', name: 'Local Resource Utilization', max: 15, defaultReason: 'Leverages existing Ranchi Tata Steel siren stockpiles and Sisai community halls.', defaultPage: 3 },
  { id: 'safety', name: 'Safety & Risk Mitigation', max: 15, defaultReason: 'Robust fail-safe sirens, lightning arrestors, and automated power surges isolation.', defaultPage: 5 },
  { id: 'community', name: 'Community Acceptance & Fit', max: 10, defaultReason: 'Audio warnings recorded in Nagpuri and Hindi; coordination with Aapda Mitra volunteers.', defaultPage: 2 },
  { id: 'scalability', name: 'Scalability & Maintainability', max: 10, defaultReason: 'Standardized mounting schematics reproducible across other Jharkhand districts.', defaultPage: 5 },
];

export function RubricBreakdown({
  criteria,
  ratings,
  reasons = {},
  pages = {},
  onJumpToPage,
  activePage,
}: RubricBreakdownProps) {
  // Construct list from either full criteria array or rating map
  const items: RubricCriterion[] = criteria ?? DEFAULT_RUBRIC_DEF.map((def) => {
    const scoreVal = ratings ? (ratings as any)[def.id] ?? Math.round(def.max * 0.8) : Math.round(def.max * 0.8);
    return {
      id: def.id,
      name: def.name,
      score: scoreVal,
      max: def.max,
      reason: reasons[def.id] || def.defaultReason,
      page: pages[def.id] || def.defaultPage,
    };
  });

  const totalScore = items.reduce((sum, item) => sum + item.score, 0);
  const totalMax = items.reduce((sum, item) => sum + item.max, 0);

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-lg border border-[#CCD1C7]">
        <div>
          <span className="text-xs font-mono uppercase text-gray-500 font-semibold tracking-wider">
            Evaluation Score
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl font-extrabold font-mono text-[#102027]">{totalScore}</span>
            <span className="text-sm font-mono text-gray-500">/ {totalMax}</span>
            <span
              className={`ml-2 px-2 py-0.5 rounded text-xs font-mono font-bold ${
                totalScore >= 75
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : totalScore >= 50
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}
            >
              {totalScore >= 75 ? 'VIABLE · LEADING' : totalScore >= 50 ? 'VIABLE · COMPETITIVE' : 'REVISION NEEDED'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-600 font-mono">
          <span className="ai-provenance-tag">AI-AUTHORED</span>
          <span>7-factor deterministic rubric</span>
        </div>
      </div>

      {/* Criteria Breakdown list */}
      <div className="space-y-3">
        {items.map((c) => {
          const percentage = Math.min(100, Math.round((c.score / c.max) * 100));
          const isSelected = activePage !== undefined && c.page === activePage;

          return (
            <div
              key={c.id}
              className={`p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-[#2E7180] bg-[#2E7180]/5 ring-1 ring-[#2E7180]'
                  : 'border-[#CCD1C7] bg-white hover:border-gray-400'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-[#102027]">{c.name}</span>
                  {c.page && onJumpToPage && (
                    <button
                      type="button"
                      onClick={() => onJumpToPage(c.page!)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[#2E7180] hover:text-[#245A66] bg-[#2E7180]/10 hover:bg-[#2E7180]/20 px-2 py-0.5 rounded transition cursor-pointer"
                      title={`Jump to Page ${c.page} in document`}
                    >
                      <FileText className="w-3 h-3" />
                      Page {c.page}
                      <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="font-mono text-xs font-bold text-[#102027]">
                  <span>{c.score}</span>
                  <span className="text-gray-400"> / {c.max}</span>
                  <span className="text-gray-500 ml-1 text-[11px]">({percentage}%)</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    percentage >= 80
                      ? 'bg-[#3E8064]'
                      : percentage >= 50
                      ? 'bg-[#2E7180]'
                      : 'bg-[#D94F45]'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Rationale feedback */}
              <p className="text-xs text-gray-600 leading-relaxed italic">
                "{c.reason}"
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
