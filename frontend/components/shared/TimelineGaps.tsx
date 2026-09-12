'use client';

import React from 'react';
import { Clock, AlertTriangle, ArrowRight, CheckCircle2, Flag } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  label: string;
  date: string;
  actor?: string;
  daysSincePrevious?: number; // Days between this event and preceding one
  isBottleneck?: boolean;     // e.g. took > 7 days
  status?: 'completed' | 'current' | 'pending';
}

interface TimelineGapsProps {
  projectTitle?: string;
  events: TimelineEvent[];
  slaThresholdDays?: number; // threshold beyond which gap is flagged as bottleneck
}

export function TimelineGaps({
  projectTitle,
  events,
  slaThresholdDays = 7,
}: TimelineGapsProps) {
  if (!events || events.length === 0) {
    return (
      <div className="p-3 bg-gray-50 border border-dashed border-[#CCD1C7] rounded text-xs text-gray-500 font-mono">
        No timeline events recorded.
      </div>
    );
  }

  const totalDays = events.reduce((acc, ev) => acc + (ev.daysSincePrevious || 0), 0);

  return (
    <div className="bg-white border border-[#CCD1C7] rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider font-bold">
            Interval-Between-Events Strip
          </span>
          {projectTitle && (
            <h5 className="text-xs font-bold text-[#102027]">{projectTitle}</h5>
          )}
        </div>
        <div className="text-xs font-mono text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
          Total Duration: <strong className="text-[#102027]">{totalDays} days</strong>
        </div>
      </div>

      {/* Horizontal timeline with day gap pills */}
      <div className="overflow-x-auto py-2">
        <div className="flex items-center min-w-max">
          {events.map((ev, index) => {
            const hasPrecedingGap = index > 0 && ev.daysSincePrevious !== undefined;
            const isSlow = ev.daysSincePrevious !== undefined && ev.daysSincePrevious > slaThresholdDays;

            return (
              <React.Fragment key={ev.id}>
                {/* Gap connector pill */}
                {hasPrecedingGap && (
                  <div className="flex flex-col items-center px-1.5 shrink-0">
                    <div className="flex items-center">
                      <div className="h-0.5 w-4 bg-gray-300" />
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold shadow-2xs ${
                          isSlow
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                        title={isSlow ? `Bottleneck: ${ev.daysSincePrevious} days (exceeds ${slaThresholdDays}d SLA target)` : `${ev.daysSincePrevious} days elapsed`}
                      >
                        {isSlow && <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />}
                        +{ev.daysSincePrevious}d
                      </span>
                      <div className="h-0.5 w-4 bg-gray-300" />
                    </div>
                  </div>
                )}

                {/* Event node */}
                <div className="flex flex-col items-center text-center p-2 rounded-lg bg-gray-50 border border-[#CCD1C7] min-w-[130px] max-w-[160px] shrink-0">
                  <span
                    className={`w-3 h-3 rounded-full mb-1.5 ${
                      ev.status === 'completed'
                        ? 'bg-emerald-500'
                        : ev.status === 'current'
                        ? 'bg-[#2E7180] ring-2 ring-[#2E7180]/30 animate-pulse'
                        : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-xs font-bold text-[#102027] line-clamp-2 leading-tight">
                    {ev.label}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500 mt-1">{ev.date}</span>
                  {ev.actor && (
                    <span className="text-[9px] font-mono text-[#2E7180] truncate max-w-full">
                      {ev.actor}
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
