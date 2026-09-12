'use client';

import React from 'react';
import { Trophy, ArrowDownRight, Clock, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

export type CompetitionState = 'leading' | 'outscored' | 'open' | 'no_proposals' | 'closed';

interface LeaderBadgeProps {
  state: CompetitionState;
  leadingScore?: number;
  userScore?: number;
  compact?: boolean;
}

export function LeaderBadge({
  state,
  leadingScore = 84,
  userScore = 78,
  compact = false,
}: LeaderBadgeProps) {
  const padClass = compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  if (state === 'leading') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs ${padClass}`}
      >
        <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Your proposal is leading · {userScore ?? leadingScore}</span>
      </span>
    );
  }

  if (state === 'outscored') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs ${padClass}`}
      >
        <ArrowDownRight className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>
          Outscored · Leading <strong className="underline">{leadingScore}</strong>, yours {userScore}
        </span>
      </span>
    );
  }

  if (state === 'closed') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-full bg-gray-200 text-gray-800 border border-gray-300 ${padClass}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-gray-600 shrink-0" />
        <span>Awarded & Closed · Score {leadingScore}</span>
      </span>
    );
  }

  if (state === 'no_proposals') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-full bg-[#2E7180]/10 text-[#245A66] border border-[#2E7180]/25 ${padClass}`}
      >
        <Sparkles className="w-3.5 h-3.5 text-[#2E7180] shrink-0" />
        <span>No proposals yet · First submission opens window</span>
      </span>
    );
  }

  // default 'open'
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-full bg-sky-100 text-sky-900 border border-sky-300 ${padClass}`}
    >
      <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
      <span>Window Open · Leading {leadingScore}</span>
    </span>
  );
}
