'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  PackageCheck, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Camera, 
  Edit2, 
  Lock, 
  Unlock, 
  ArrowRight, 
  Plus, 
  Truck,
  MessageSquare
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { StageTracker, StageItem } from '@/components/shared/StageTracker';
import { MessageThread } from '@/components/shared/MessageThread';
import { FileUploader } from '@/components/shared/FileUploader';
import { formatIndianCurrency, formatIndianNumber } from '@/components/shared/ContributionSplitter';

interface DispatchedItem {
  id: string;
  itemName: string;
  qty: string;
  contributor: string;
  dispatchDate: string;
  trackingNumber: string;
  confirmed: boolean;
}

export default function CollegeProjectsPage() {
  // Dispatched items awaiting receipt confirmation (One-tap per item with date picker)
  const [dispatchedItems, setDispatchedItems] = useState<DispatchedItem[]>([
    {
      id: 'disp-1',
      itemName: 'Structural Steel Prefabricated Mounting Mast',
      qty: '800 kg',
      contributor: 'Tata Steel CSR Foundation',
      dispatchDate: '2026-09-11',
      trackingNumber: 'TS-RNC-4401',
      confirmed: false,
    },
    {
      id: 'disp-2',
      itemName: 'Faraday Cage Lightning Arrestor Enclosures',
      qty: '12 sets',
      contributor: 'Central Coalfields Limited (CCL) CSR',
      dispatchDate: '2026-09-10',
      trackingNumber: 'CCL-JHR-882',
      confirmed: true,
    },
  ]);

  const [receiptDates, setReceiptDates] = useState<Record<string, string>>({
    'disp-1': new Date().toISOString().split('T')[0],
    'disp-2': '2026-09-11',
  });

  // Stages State with Stage Plan Editor
  const [isStagePlanLocked, setIsStagePlanLocked] = useState<boolean>(true);
  const [stages, setStages] = useState<StageItem[]>([
    {
      id: 'st-1',
      order: 1,
      title: 'Lab Prototype & CAP Telemetry Integration',
      description: 'Program ESP32 GSM relay boards and verify Damini webhook triggers in Ranchi lab.',
      expectedDate: '2026-09-08',
      actualDate: '2026-09-08',
      status: 'completed',
    },
    {
      id: 'st-2',
      order: 2,
      title: 'Hardware Assembly & Mast Fabrication',
      description: 'Mount 120dB horns onto 800kg structural steel masts from Tata Steel depot.',
      expectedDate: '2026-09-14',
      status: 'in_progress',
      slippageDays: 2,
      blockedReason: 'Awaiting 800kg steel delivery from Tata Steel CSR (Dispatch #TS-RNC-4401 in transit)',
    },
    {
      id: 'st-3',
      order: 3,
      title: 'Field Installation across 12 Gumla Villages',
      description: 'Mount siren masts atop Sisai and Bharno Panchayat roofs with Aapda Mitra volunteers.',
      expectedDate: '2026-09-22',
      status: 'pending',
    },
    {
      id: 'st-4',
      order: 4,
      title: 'Acoustic Sound Testing & Community Sign-off',
      description: 'Verify 2.5km audible siren reach in paddy fields and capture community ledger signatures.',
      expectedDate: '2026-09-28',
      status: 'pending',
    },
  ]);

  const [selectedPhotoStage, setSelectedPhotoStage] = useState<string | null>(null);

  // One-tap Receipt Confirmation
  const handleConfirmReceipt = (id: string) => {
    setDispatchedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, confirmed: true } : item))
    );
  };

  const handleMarkStageDone = (stageId: string) => {
    setStages((prev) =>
      prev.map((s) =>
        s.id === stageId
          ? { ...s, status: 'completed', actualDate: new Date().toISOString().split('T')[0], blockedReason: undefined }
          : s
      )
    );
  };

  return (
    <RouteGuard allowedRoles={['university', 'coordinator', 'admin']} consoleTitle="My Won R&D Projects">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Headline */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                Stage 5 · Execution & Milestone Progress
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027] mt-1">
                My Awarded R&D Projects & Delivery Tracker
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                Project CH-GUM-001 · Lead: BIT Mesra ECE Lab · Track CSR funding lines, confirm material deliveries, and update milestone evidence.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Awarded Proposal · Pilot Phase
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 1: RECEIPT CONFIRMATION (Dispatched Items Awaiting College Confirmation) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                  Material Receipt Verification
                </span>
                <h3 className="text-base font-extrabold text-[#102027] mt-0.5">
                  Dispatched Material Lines Awaiting College Confirmation
                </h3>
              </div>
              <span className="text-xs font-mono text-gray-500 bg-[#F4F6F5] px-2.5 py-1 rounded border border-[#CCD1C7]">
                One-Tap Receipt
              </span>
            </div>

            <p className="text-xs text-gray-600">
              When corporate CSR partners dispatch materials, confirm arrival here to unblock stages on the statewide ledger.
            </p>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden text-xs">
              {dispatchedItems.map((disp) => (
                <div
                  key={disp.id}
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                    disp.confirmed ? 'bg-emerald-50/40' : 'bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#2E7180]" />
                      <span className="font-bold text-sm text-[#102027]">{disp.itemName}</span>
                      <span className="font-mono text-xs font-bold text-[#2E7180] bg-teal-50 px-2 py-0.5 rounded border border-[#2E7180]/20">
                        {disp.qty}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-500 font-mono text-[11px]">
                      <span>Dispatched by: <strong className="text-gray-800">{disp.contributor}</strong></span>
                      <span>·</span>
                      <span>Dispatch Date: {disp.dispatchDate}</span>
                      <span>·</span>
                      <span>Docket #{disp.trackingNumber}</span>
                    </div>
                  </div>

                  {/* Confirmation Action with Date Picker */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 font-mono text-[11px] text-gray-600">
                      <span>Receipt Date:</span>
                      <input
                        type="date"
                        value={receiptDates[disp.id] || ''}
                        disabled={disp.confirmed}
                        onChange={(e) => setReceiptDates({ ...receiptDates, [disp.id]: e.target.value })}
                        className="px-2 py-1 rounded border border-[#CCD1C7] text-xs font-mono"
                      />
                    </div>

                    {disp.confirmed ? (
                      <span className="px-3 py-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Confirmed Received
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleConfirmReceipt(disp.id)}
                        className="touch-target px-4 py-1.5 bg-[#2E7180] hover:bg-[#245A66] text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer shadow-2xs"
                      >
                        Confirm Receipt (1-Tap)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: FUNDING PROGRESS PER LINE */}
          {/* ========================================================================= */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                  CSR Funding & Resource Lines
                </span>
                <h3 className="text-base font-extrabold text-[#102027] mt-0.5">
                  Funding Progress Per Line & Contributor Breakdown
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                100% Pledged
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Line 1 */}
              <div className="p-4 bg-gray-50 border border-[#CCD1C7] rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-800">120dB Solar Acoustic Sirens (12 units)</span>
                  <span className="font-mono font-bold text-emerald-700">12 / 12 units</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-emerald-600 h-2 rounded-full w-full" />
                </div>
                <div className="text-[11px] font-mono text-gray-500 pt-1 flex justify-between">
                  <span>Pledged by: Tata Steel CSR (8) & CCL CSR (4)</span>
                  <strong className="text-gray-900">0 remaining</strong>
                </div>
              </div>

              {/* Line 2 */}
              <div className="p-4 bg-gray-50 border border-[#CCD1C7] rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-800">Structural Steel Mounting Enclosures</span>
                  <span className="font-mono font-bold text-emerald-700">800 kg / 800 kg</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-emerald-600 h-2 rounded-full w-full" />
                </div>
                <div className="text-[11px] font-mono text-gray-500 pt-1 flex justify-between">
                  <span>Pledged by: Tata Steel CSR Foundation</span>
                  <strong className="text-gray-900">0 remaining</strong>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: STAGE PLAN EDITOR & MILESTONE PROGRESS WITH SLIPPAGE */}
          {/* ========================================================================= */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                  Execution Tracking
                </span>
                <h3 className="text-base font-extrabold text-[#102027] mt-0.5">
                  Stage Plan & Milestone Progress with Slippage Tracking
                </h3>
              </div>

              {/* Stage Plan Editor Lock Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsStagePlanLocked(!isStagePlanLocked)}
                  className={`touch-target px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition ${
                    isStagePlanLocked
                      ? 'bg-gray-100 text-gray-700 border-gray-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                  }`}
                >
                  {isStagePlanLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-gray-600" />
                      Plan Locked
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-amber-700" />
                      Editing AI Draft Stages
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Stage Plan Editor Mode */}
            {!isStagePlanLocked && (
              <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-900 uppercase">
                    Stage Plan Editor (Review AI Draft Titles and Expected Durations):
                  </span>
                  <span className="text-[11px] text-amber-700 font-mono">Changes log to audit trail</span>
                </div>

                <div className="space-y-2">
                  {stages.map((st, i) => (
                    <div key={st.id} className="p-3 bg-white rounded-lg border border-amber-200 flex flex-col sm:flex-row gap-2 items-center text-xs">
                      <span className="font-mono font-bold text-gray-500 shrink-0">Stage {st.order}:</span>
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) => {
                          const updated = [...stages];
                          updated[i].title = e.target.value;
                          setStages(updated);
                        }}
                        className="flex-1 px-2.5 py-1 rounded border border-gray-300 font-semibold"
                      />
                      <input
                        type="date"
                        value={st.expectedDate}
                        onChange={(e) => {
                          const updated = [...stages];
                          updated[i].expectedDate = e.target.value;
                          setStages(updated);
                        }}
                        className="px-2 py-1 rounded border border-gray-300 font-mono"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsStagePlanLocked(true)}
                  className="touch-target px-4 py-2 bg-amber-800 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Save & Lock Final Plan
                </button>
              </div>
            )}

            {/* Reusable StageTracker component with slippage and photo upload */}
            <StageTracker
              stages={stages}
              editable={true}
              onMarkComplete={handleMarkStageDone}
              onUploadPhoto={(stageId) => setSelectedPhotoStage(stageId)}
            />

            {/* Photo Upload Modal for Stage */}
            {selectedPhotoStage && (
              <div className="p-4 bg-gray-50 border border-[#CCD1C7] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-gray-800">
                    Upload Milestone Verification Photo for Stage #{selectedPhotoStage}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoStage(null)}
                    className="text-xs text-gray-500 font-mono hover:underline"
                  >
                    Close
                  </button>
                </div>
                <FileUploader
                  accept="image/*,.jpg,.jpeg,.png"
                  allowedExtensions={['.jpg', '.jpeg', '.png']}
                  title="Select Field Progress Photo"
                  description="Upload rooftop mast installation or acoustic siren test photo"
                  onFileSelected={() => {
                    alert('Progress photo uploaded and pinned to stage record!');
                    setSelectedPhotoStage(null);
                  }}
                />
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: DIRECT COMMUNICATIONS THREAD */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-gray-700 uppercase tracking-wider block">
              Direct Coordination Channel with CSR Sponsors & Field Teams
            </span>
            <MessageThread
              challengeRef="CH-GUM-001"
              projectTitle="Gumla Rural Lightning Siren Relay Network (12 Towers)"
              messages={[
                {
                  id: 'm-1',
                  senderName: 'Dr. A. Verma',
                  senderRole: 'university',
                  senderOrg: 'BIT Mesra ECE',
                  content: 'Stage 1 lab testing complete. We have confirmed siren trigger via Damini CAP simulation.',
                  timestamp: '2 days ago',
                  isSelf: true,
                },
                {
                  id: 'm-2',
                  senderName: 'R. S. Murthy',
                  senderRole: 'industry',
                  senderOrg: 'Tata Steel CSR',
                  content: '800kg structural steel mast batch dispatched from Ranchi stockyard under Docket #TS-RNC-4401.',
                  timestamp: 'Yesterday at 3:00 PM',
                },
              ]}
              currentUserRole="university"
              onSendMessage={async () => {}}
            />
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
