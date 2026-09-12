'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  Filter,
  Layers,
  Sparkles
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { TimelineGaps } from '@/components/shared/TimelineGaps';

interface SlaStageGauge {
  stageName: string;
  targetDays: number;
  actualDays: number;
  districtAverages: Record<string, number>;
  status: 'on_track' | 'delayed' | 'critical_lag';
}

export default function AdminSlaPage() {
  const [selectedDistrict, setSelectedDistrict] = useState('all');

  const slaStages: SlaStageGauge[] = [
    {
      stageName: '1. Ground Intake to Field Verification',
      targetDays: 1.0,
      actualDays: 1.8,
      districtAverages: { Gumla: 1.2, Sahebganj: 3.4, Dhanbad: 1.5, Ranchi: 0.9, Palamu: 2.1 },
      status: 'delayed',
    },
    {
      stageName: '2. Verification to Competition Window Open',
      targetDays: 2.0,
      actualDays: 1.4,
      districtAverages: { Gumla: 1.0, Sahebganj: 1.8, Dhanbad: 1.2, Ranchi: 1.1, Palamu: 1.9 },
      status: 'on_track',
    },
    {
      stageName: '3. Competition Window to Proposal Award',
      targetDays: 14.0,
      actualDays: 14.2,
      districtAverages: { Gumla: 14.0, Sahebganj: 16.5, Dhanbad: 13.5, Ranchi: 12.0, Palamu: 15.0 },
      status: 'on_track',
    },
    {
      stageName: '4. Award to 100% Resource Swarm Pledging',
      targetDays: 7.0,
      actualDays: 4.5,
      districtAverages: { Gumla: 3.0, Sahebganj: 6.2, Dhanbad: 4.1, Ranchi: 2.8, Palamu: 6.5 },
      status: 'on_track',
    },
    {
      stageName: '5. Material Dispatch to College Receipt',
      targetDays: 3.0,
      actualDays: 5.8,
      districtAverages: { Gumla: 4.2, Sahebganj: 9.1, Dhanbad: 4.8, Ranchi: 2.5, Palamu: 7.6 },
      status: 'critical_lag',
    },
  ];

  return (
    <RouteGuard allowedRoles={['admin']} consoleTitle="SLA Metrics & Bottleneck Analysis">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Back Nav */}
          <div className="flex items-center justify-between">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-gray-600 hover:text-[#102027] transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Command Center
            </Link>

            <span className="text-xs font-mono text-gray-500 bg-white px-2.5 py-1 rounded border border-[#CCD1C7]">
              SLA Policy Target: <strong>Sendai Priority 4 Compliant</strong>
            </span>
          </div>

          {/* Top Banner */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
            <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
              Service Level Agreement (SLA) & Velocity Gauges
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027]">
              Lifecycle Stage Velocity: Actual vs Target
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-sans max-w-3xl">
              Compare actual operational throughput against statutory targets per lifecycle stage. Filter by district to uncover geographical bottlenecks where logistics or verifiers lag behind the rest of Jharkhand.
            </p>
          </div>

          {/* District Bottleneck Highlight Banner */}
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-amber-950 font-mono uppercase text-[11px]">
                  Statewide Bottleneck Finding: Sahebganj & Palamu Rural Lag
                </h4>
                <p className="text-amber-850 leading-relaxed font-sans">
                  Sahebganj district averages <strong>9.1 days</strong> for material delivery (target: 3.0 days) due to monsoon ferry logistics. In contrast, Ranchi averages <strong>2.5 days</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 font-mono">
              <span className="text-gray-600">Filter View:</span>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-bold"
              >
                <option value="all">Statewide Average</option>
                <option value="Gumla">Gumla</option>
                <option value="Sahebganj">Sahebganj (Lagging)</option>
                <option value="Dhanbad">Dhanbad</option>
                <option value="Ranchi">Ranchi (Fastest)</option>
                <option value="Palamu">Palamu</option>
              </select>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* STAGE SLA GAUGES (Actual vs Target) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {slaStages.map((stage, idx) => {
              const displayActual =
                selectedDistrict !== 'all' && stage.districtAverages[selectedDistrict]
                  ? stage.districtAverages[selectedDistrict]
                  : stage.actualDays;

              const isLagging = displayActual > stage.targetDays;
              const ratio = Math.min(100, Math.round((stage.targetDays / displayActual) * 100));

              return (
                <div
                  key={idx}
                  className="bg-white border border-[#CCD1C7] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-gray-400 font-bold uppercase">
                        Stage #{idx + 1}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          !isLagging
                            ? 'bg-emerald-100 text-emerald-800'
                            : stage.status === 'critical_lag'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {!isLagging ? 'ON TARGET' : 'SLA BREACH'}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#102027]">{stage.stageName}</h4>

                    {/* Gauges representation */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-baseline justify-between font-mono">
                        <div>
                          <span className="text-[10px] text-gray-500 uppercase block">Actual:</span>
                          <span className={`text-2xl font-extrabold ${isLagging ? 'text-[#D94F45]' : 'text-emerald-700'}`}>
                            {displayActual}d
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-gray-500 uppercase block">Target:</span>
                          <span className="text-base font-bold text-gray-700">
                            {stage.targetDays}d
                          </span>
                        </div>
                      </div>

                      {/* Bar Gauge */}
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            !isLagging ? 'bg-emerald-600' : 'bg-[#D94F45]'
                          }`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* District comparison chips */}
                  <div className="pt-2 border-t border-gray-100 text-[10px] font-mono text-gray-500">
                    <div className="flex justify-between items-center">
                      <span>Ranchi: <strong>{stage.districtAverages['Ranchi']}d</strong></span>
                      <span>Gumla: <strong>{stage.districtAverages['Gumla']}d</strong></span>
                      <span className="text-amber-850">Sahebganj: <strong>{stage.districtAverages['Sahebganj']}d</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* HORIZONTAL TIMELINE TRACKING STRIP (With gaps in days) */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-[#102027]">
              Horizontal Project Lifecycle Intervals (Surfacing Slow Milestones)
            </h3>

            {/* Project 1: Gumla */}
            <TimelineGaps
              projectTitle="Gumla Rural Lightning Siren Relay Network (CH-GUM-001)"
              slaThresholdDays={5}
              events={[
                { id: '1', label: 'Ground Intake', date: '01-Sep', daysSincePrevious: 0, status: 'completed' },
                { id: '2', label: 'Field Verified', date: '02-Sep', daysSincePrevious: 1, status: 'completed' },
                { id: '3', label: 'Window Opened', date: '03-Sep', daysSincePrevious: 1, status: 'completed' },
                { id: '4', label: 'Awarded to BIT', date: '08-Sep', daysSincePrevious: 5, status: 'completed' },
                { id: '5', label: 'Swarm Pledged', date: '09-Sep', daysSincePrevious: 1, status: 'completed' },
                { id: '6', label: 'Receipt Confirmed', date: '12-Sep', daysSincePrevious: 3, status: 'current' },
              ]}
            />

            {/* Project 2: Sahebganj (Surfacing Bottlenecks) */}
            <TimelineGaps
              projectTitle="Sahebganj Flood Water Purification Units (CH-SAH-002)"
              slaThresholdDays={5}
              events={[
                { id: '1', label: 'Intake Filed', date: '28-Aug', daysSincePrevious: 0, status: 'completed' },
                { id: '2', label: 'Field Verified', date: '04-Sep', daysSincePrevious: 7, isBottleneck: true, status: 'completed' },
                { id: '3', label: 'Window Opened', date: '06-Sep', daysSincePrevious: 2, status: 'completed' },
                { id: '4', label: 'Proposals Evaluated', date: '11-Sep', daysSincePrevious: 5, status: 'current' },
              ]}
            />
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
