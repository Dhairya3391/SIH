'use client';

import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Package, 
  ArrowRight,
  ShieldCheck,
  Camera
} from 'lucide-react';

export interface StageItem {
  id: string;
  order: number;
  title: string;
  description?: string;
  expectedDate: string;
  actualDate?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'blocked';
  slippageDays?: number; // >0 means delayed
  blockedReason?: string;
  photoUrl?: string;
}

interface StageTrackerProps {
  stages: StageItem[];
  editable?: boolean;
  onMarkComplete?: (stageId: string) => void;
  onUploadPhoto?: (stageId: string) => void;
}

export function StageTracker({
  stages,
  editable = false,
  onMarkComplete,
  onUploadPhoto,
}: StageTrackerProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-dashed border-[#CCD1C7] rounded-lg text-xs font-mono text-gray-500 text-center">
        No delivery stage plan defined yet.
      </div>
    );
  }

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-mono font-bold tracking-wider text-gray-700 uppercase flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#2E7180]" />
          Project Delivery Stages & Milestone Slippage
        </h4>
        <span className="text-[11px] font-mono text-gray-500">Locked Plan vs Actual</span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#CCD1C7]">
        {sortedStages.map((stage) => {
          const isCompleted = stage.status === 'completed';
          const isInProgress = stage.status === 'in_progress';
          const isBlocked = stage.status === 'blocked';
          const hasSlippage = stage.slippageDays && stage.slippageDays > 0;

          return (
            <div key={stage.id} className="relative group">
              {/* Timeline marker bullet */}
              <div
                className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-white transition-colors ${
                  isCompleted
                    ? 'border-emerald-600 text-emerald-600 bg-emerald-50'
                    : isInProgress
                    ? 'border-[#2E7180] text-[#2E7180] bg-teal-50 ring-2 ring-[#2E7180]/20'
                    : isBlocked
                    ? 'border-[#D94F45] text-[#D94F45] bg-red-50'
                    : 'border-gray-400 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : isBlocked ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : isInProgress ? (
                  <span className="w-2 h-2 rounded-full bg-[#2E7180] animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                )}
              </div>

              {/* Card content */}
              <div
                className={`p-3.5 rounded-lg border transition-all ${
                  isInProgress
                    ? 'bg-white border-[#2E7180] shadow-xs'
                    : isBlocked
                    ? 'bg-red-50/50 border-red-300'
                    : isCompleted
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : 'bg-white/80 border-[#CCD1C7]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-gray-500">
                        STAGE {stage.order}
                      </span>
                      <h5 className="font-bold text-sm text-[#102027]">{stage.title}</h5>

                      {/* Status chip */}
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isInProgress
                            ? 'bg-[#2E7180]/15 text-[#245A66]'
                            : isBlocked
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {stage.status.replace('_', ' ')}
                      </span>
                    </div>

                    {stage.description && (
                      <p className="text-xs text-gray-600 mt-1">{stage.description}</p>
                    )}
                  </div>

                  {/* Actions for College in editable mode */}
                  {editable && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onUploadPhoto && (
                        <button
                          type="button"
                          onClick={() => onUploadPhoto(stage.id)}
                          className="px-2 py-1 text-xs font-mono font-medium rounded border border-[#CCD1C7] bg-white hover:bg-gray-50 flex items-center gap-1 text-gray-700"
                        >
                          <Camera className="w-3.5 h-3.5 text-gray-500" />
                          Photo
                        </button>
                      )}
                      {isInProgress && onMarkComplete && (
                        <button
                          type="button"
                          onClick={() => onMarkComplete(stage.id)}
                          className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-[#2E7180] text-white hover:bg-[#245A66] transition"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Dates and Slippage Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 pt-2 border-t border-gray-100 text-xs font-mono">
                  <div className="flex items-center gap-1 text-gray-600">
                    <span className="text-gray-400">Target:</span>
                    <span>{stage.expectedDate}</span>
                  </div>

                  {stage.actualDate && (
                    <div className="flex items-center gap-1 text-[#102027] font-semibold">
                      <span className="text-gray-400">Actual:</span>
                      <span>{stage.actualDate}</span>
                    </div>
                  )}

                  {hasSlippage ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#A8332A] bg-red-100 px-1.5 py-0.5 rounded">
                      <AlertTriangle className="w-3 h-3" />
                      +{stage.slippageDays} days slippage
                    </span>
                  ) : isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      On schedule
                    </span>
                  ) : null}
                </div>

                {/* Blocked reason banner */}
                {stage.blockedReason && (
                  <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Blocked on material:</strong> {stage.blockedReason}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
