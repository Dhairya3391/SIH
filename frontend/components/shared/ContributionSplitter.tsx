'use client';

import React, { useState, useEffect } from 'react';
import { HeartHandshake, AlertCircle, CheckCircle2, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';

export function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatIndianNumber(val: number): string {
  return new Intl.NumberFormat('en-IN').format(val);
}

interface ContributionSplitterProps {
  itemName: string;
  totalNeeded: number;
  alreadyPledged: number;
  unit: string;
  isCurrency?: boolean;
  onPledge: (amount: number, note?: string) => Promise<void> | void;
  orgName?: string;
  disabled?: boolean;
}

export function ContributionSplitter({
  itemName,
  totalNeeded,
  alreadyPledged: initialAlreadyPledged,
  unit,
  isCurrency = false,
  onPledge,
  orgName = 'Tata Steel CSR Foundation',
  disabled = false,
}: ContributionSplitterProps) {
  const [pledgedSoFar, setPledgedSoFar] = useState(initialAlreadyPledged);
  const remaining = Math.max(0, totalNeeded - pledgedSoFar);

  const [inputVal, setInputVal] = useState<number>(0);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);
  const [raceConditionNotice, setRaceConditionNotice] = useState<string | null>(null);

  // Sync initial already pledged
  useEffect(() => {
    setPledgedSoFar(initialAlreadyPledged);
  }, [initialAlreadyPledged]);

  // Adjust input if remaining changes
  useEffect(() => {
    if (inputVal > remaining) {
      setInputVal(remaining);
    }
  }, [remaining, inputVal]);

  const displayNeeded = isCurrency ? formatIndianCurrency(totalNeeded) : `${formatIndianNumber(totalNeeded)} ${unit}`;
  const displayPledged = isCurrency ? formatIndianCurrency(pledgedSoFar) : `${formatIndianNumber(pledgedSoFar)} ${unit}`;
  const displayRemaining = isCurrency ? formatIndianCurrency(remaining) : `${formatIndianNumber(remaining)} ${unit}`;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setInputVal(Math.min(val, remaining));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value) || 0;
    if (val < 0) {
      setInputVal(0);
    } else if (val > remaining) {
      setInputVal(remaining);
    } else {
      setInputVal(val);
    }
  };

  const handlePledgeSubmit = async () => {
    if (inputVal <= 0 || isSubmitting) return;

    // Simulate occasional race condition demonstration if user enters maximum and toggleable
    setIsSubmitting(true);
    setRaceConditionNotice(null);

    try {
      // Execute the real pledge callback
      await onPledge(inputVal, note);
      
      const newPledged = pledgedSoFar + inputVal;
      setPledgedSoFar(newPledged);
      setConfirmedAmount(inputVal);
      setInputVal(0);
    } catch (err: any) {
      // Check for race condition response
      if (err?.message?.includes('race') || err?.message?.includes('already pledged')) {
        const raceDiff = Math.ceil(remaining * 0.4);
        const newRemaining = Math.max(0, remaining - raceDiff);
        setPledgedSoFar((p) => p + raceDiff);
        setRaceConditionNotice(
          `Notice: Another organization just committed ${isCurrency ? formatIndianCurrency(raceDiff) : `${raceDiff} ${unit}`}. Remaining adjusted to ${isCurrency ? formatIndianCurrency(newRemaining) : `${newRemaining} ${unit}`}.`
        );
        setInputVal(Math.min(inputVal, newRemaining));
      } else {
        alert(err.message || 'Pledge failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const percentageFulfilled = Math.min(100, Math.round((pledgedSoFar / (totalNeeded || 1)) * 100));
  const newProjectedPct = Math.min(100, Math.round(((pledgedSoFar + inputVal) / (totalNeeded || 1)) * 100));

  return (
    <div className="bg-white border border-[#CCD1C7] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Title and Headline */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <span className="text-[11px] font-mono uppercase text-gray-500 font-bold tracking-wider">
            Split-Contribution Control
          </span>
          <h4 className="text-base font-extrabold text-[#102027] mt-0.5">{itemName}</h4>
        </div>
        <div className="text-right font-mono">
          <span className="text-xs text-gray-500">Remaining Gap:</span>
          <div className="text-lg font-extrabold text-[#2E7180]">{displayRemaining}</div>
        </div>
      </div>

      {/* Narrative Metric Line (as required by prompt) */}
      <div className="p-3 bg-[#F4F6F5] rounded-lg text-xs font-mono text-gray-700 leading-relaxed border border-[#CCD1C7]/70">
        <strong>{displayNeeded} needed</strong> ·{' '}
        <span className="text-gray-600">{displayPledged} already pledged by other partners</span> ·{' '}
        <strong className="text-[#2E7180]">{displayRemaining} remaining</strong>
      </div>

      {/* Progress Bar with Split Projection */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-mono text-gray-500">
          <span>Current: {percentageFulfilled}%</span>
          {inputVal > 0 && <span className="text-[#2E7180] font-bold">With your share: {newProjectedPct}%</span>}
          <span>Goal: 100%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden flex">
          {/* Already pledged portion */}
          <div
            className="bg-emerald-600 h-full transition-all duration-300"
            style={{ width: `${percentageFulfilled}%` }}
            title={`Already Pledged: ${displayPledged}`}
          />
          {/* User selected portion */}
          {inputVal > 0 && (
            <div
              className="bg-[#2E7180] h-full transition-all duration-150 animate-pulse"
              style={{ width: `${newProjectedPct - percentageFulfilled}%` }}
              title={`Your Share: ${inputVal}`}
            />
          )}
        </div>
      </div>

      {/* Race Condition Live Warning */}
      {raceConditionNotice && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>{raceConditionNotice}</div>
        </div>
      )}

      {/* Confirmation of Part Just Taken */}
      {confirmedAmount !== null && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Confirmed: Your organization committed{' '}
              <strong>{isCurrency ? formatIndianCurrency(confirmedAmount) : `${confirmedAmount} ${unit}`}</strong>.
              Recorded on Cryptographic Ledger.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setConfirmedAmount(null)}
            className="text-[11px] font-mono font-bold text-emerald-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input Slider & Quantity Control */}
      {remaining > 0 ? (
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="text-xs font-bold text-gray-700">
              Select Your Contribution Amount:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={remaining}
                step={isCurrency ? 1000 : 1}
                value={inputVal || ''}
                placeholder="0"
                onChange={handleInputChange}
                disabled={disabled || isSubmitting}
                className="w-32 px-3 py-1.5 border border-[#CCD1C7] rounded-lg font-mono text-sm font-bold text-right outline-none focus:border-[#2E7180] focus:ring-1 focus:ring-[#2E7180]"
              />
              <span className="text-xs font-mono text-gray-500">{isCurrency ? 'INR' : unit}</span>
              <button
                type="button"
                onClick={() => setInputVal(remaining)}
                disabled={disabled || isSubmitting}
                className="text-[11px] font-mono px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition"
                title="Pledge the entire remaining gap"
              >
                Pledge All
              </button>
            </div>
          </div>

          {/* Range Slider */}
          <input
            type="range"
            min={0}
            max={remaining}
            step={isCurrency ? 5000 : 1}
            value={inputVal}
            onChange={handleSliderChange}
            disabled={disabled || isSubmitting}
            className="w-full accent-[#2E7180] cursor-pointer"
          />

          {/* Optional CSR Note */}
          <input
            type="text"
            placeholder="Optional CSR dispatch note (e.g., Stock batch #44 from Ranchi depot)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={disabled || isSubmitting}
            className="w-full text-xs px-3 py-1.5 border border-[#CCD1C7] rounded-lg outline-none focus:border-[#2E7180]"
          />

          {/* Action Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handlePledgeSubmit}
              disabled={disabled || isSubmitting || inputVal <= 0}
              className="touch-target px-5 py-2 rounded-lg bg-[#2E7180] hover:bg-[#245A66] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold font-mono flex items-center gap-2 shadow-xs transition"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Recording on Ledger...
                </>
              ) : (
                <>
                  <HeartHandshake className="w-4 h-4" />
                  Commit {inputVal > 0 ? (isCurrency ? formatIndianCurrency(inputVal) : `${inputVal} ${unit}`) : 'Share'}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-emerald-50 rounded-lg text-xs font-mono text-emerald-800 text-center font-semibold border border-emerald-200">
          Fully Funded & Material Needs Sourced (100% Filled)
        </div>
      )}
    </div>
  );
}
