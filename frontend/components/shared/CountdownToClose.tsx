'use client';

import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CountdownToCloseProps {
  closeDate?: string | Date;
  status?: string;
  leadingScore?: number;
  hasProposals?: boolean;
  compact?: boolean;
}

export function CountdownToClose({
  closeDate,
  status,
  leadingScore,
  hasProposals = true,
  compact = false,
}: CountdownToCloseProps) {
  // Target date fallback: 3 days, 14 hours from now if not passed
  const [targetTime] = useState<number>(() => {
    if (closeDate) {
      return new Date(closeDate).getTime();
    }
    // Default 3 days, 14 hours from now
    return Date.now() + (3 * 24 + 14) * 60 * 60 * 1000 + 42 * 60 * 1000;
  });

  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isClosed: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isClosed: false });

  useEffect(() => {
    const calculate = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0 || status === 'closed' || status === 'awarded') {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isClosed: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isClosed: false });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetTime, status]);

  if (!hasProposals) {
    return (
      <div className={`inline-flex items-center gap-1.5 font-mono text-gray-700 bg-gray-100 border border-gray-300 rounded px-2.5 py-1 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        <Clock className="w-3.5 h-3.5 text-gray-500" />
        <span>No proposals yet — you would open the window</span>
      </div>
    );
  }

  if (timeLeft.isClosed) {
    return (
      <div className={`inline-flex items-center gap-1.5 font-mono text-gray-600 bg-gray-200/80 border border-gray-300 rounded px-2.5 py-1 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        <span className="w-2 h-2 rounded-full bg-gray-500" />
        <span className="font-bold">Window Closed</span>
        {leadingScore !== undefined && (
          <span className="text-gray-700">· Winning Score: {leadingScore}</span>
        )}
      </div>
    );
  }

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 12;

  return (
    <div
      className={`inline-flex items-center gap-2 font-mono rounded px-2.5 py-1 transition-colors ${
        isUrgent
          ? 'bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30 animate-pulse'
          : 'bg-[#2E7180]/10 text-[#245A66] border border-[#2E7180]/20'
      } ${compact ? 'text-[11px]' : 'text-xs'}`}
    >
      <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-[#D94F45]' : 'text-[#2E7180]'}`} />
      <span>
        Closes in{' '}
        <strong className="font-bold">
          {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
          {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
        </strong>
      </span>
      {leadingScore !== undefined && (
        <span className="border-l border-current/30 pl-2">
          Leading score: <strong className="font-bold">{leadingScore}</strong>
        </span>
      )}
    </div>
  );
}
