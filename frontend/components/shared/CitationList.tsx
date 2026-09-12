'use client';

import React from 'react';
import { ExternalLink, BookOpen, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface Citation {
  id?: string;
  title: string;
  publisher: string;
  date: string;
  supports: string;
  url: string;
  type?: 'weather' | 'news' | 'web' | 'government' | 'academic';
  confidence?: 'high' | 'medium' | 'flagged';
}

interface CitationListProps {
  citations: Citation[];
  title?: string;
  compact?: boolean;
}

export function CitationList({
  citations,
  title = 'Corroborating Sources & Citations',
  compact = false,
}: CitationListProps) {
  if (!citations || citations.length === 0) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-[#CCD1C7] text-xs text-gray-500 font-mono flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        No external citations recorded for this item.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold tracking-wider text-gray-700 uppercase flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#2E7180]" />
            {title} ({citations.length})
          </h4>
          <span className="text-[10px] text-gray-500 font-mono">Independent Corroboration</span>
        </div>
      )}

      <div className="divide-y divide-[#CCD1C7]/50 rounded-lg border border-[#CCD1C7] bg-white overflow-hidden shadow-2xs">
        {citations.map((c, i) => (
          <div
            key={c.id || `${c.title}-${i}`}
            className={`p-3 transition-colors hover:bg-gray-50/80 ${compact ? 'text-xs' : 'text-sm'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-[#102027] truncate hover:text-[#2E7180]">
                    {c.title}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#2E7180]/10 text-[#245A66] border border-[#2E7180]/20">
                    {c.publisher}
                  </span>
                  {c.date && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 font-mono">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      {c.date}
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-600 flex items-start gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="italic">
                    Supports: <strong className="not-italic text-gray-800">{c.supports}</strong>
                  </span>
                </div>
              </div>

              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="touch-target p-1.5 text-[#2E7180] hover:text-[#245A66] hover:bg-[#2E7180]/10 rounded-md transition-colors shrink-0"
                  title="Open source link in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
