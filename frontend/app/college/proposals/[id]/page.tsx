'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Trophy, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  FileText, 
  RefreshCw, 
  Clock, 
  Eye, 
  ShieldCheck, 
  Sparkles,
  Layers,
  ChevronRight,
  Send,
  Building2,
  Package
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { RubricBreakdown } from '@/components/shared/RubricBreakdown';
import { DocumentViewer } from '@/components/shared/DocumentViewer';
import { CountdownToClose } from '@/components/shared/CountdownToClose';
import { LeaderBadge } from '@/components/shared/LeaderBadge';

interface MaterialItem {
  name: string;
  qty: string;
  sourcePage: number;
}

export default function ProposalVerdictPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  // Active page synced between rubric/extracts and document viewer
  const [activeViewerPage, setActiveViewerPage] = useState<number>(1);

  // Proposal viability state toggle for demonstration (Viable 84 vs Not Viable 48)
  const [isDemoViable, setIsDemoViable] = useState<boolean>(true);

  // Editable extracted fields with source page tags
  const [extractedCost, setExtractedCost] = useState('₹1,40,000');
  const [extractedDuration, setExtractedDuration] = useState('28 Deployment Days');
  const [materials, setMaterials] = useState<MaterialItem[]>([
    { name: '120dB Solar Acoustic Sirens', qty: '12 units', sourcePage: 3 },
    { name: 'Structural Steel Prefabricated Mounting Mast', qty: '800 kg', sourcePage: 3 },
    { name: 'Faraday Cage Lightning Arrestor Enclosures', qty: '12 sets', sourcePage: 5 },
    { name: 'Backup SIM800L Cellular Relays', qty: '12 units', sourcePage: 2 },
  ]);

  const [isResubmitting, setIsResubmitting] = useState(false);
  const [saveExtractsNotice, setSaveExtractsNotice] = useState(false);

  const currentScore = isDemoViable ? 84 : 48;
  const leadingScore = 84;
  const isLeading = isDemoViable && currentScore >= leadingScore;

  const handleJumpToPage = (page: number) => {
    setActiveViewerPage(page);
  };

  const handleSaveExtracts = () => {
    setSaveExtractsNotice(true);
    setTimeout(() => setSaveExtractsNotice(false), 2500);
  };

  const handleResubmit = () => {
    setIsResubmitting(true);
    setTimeout(() => {
      setIsResubmitting(false);
      setIsDemoViable(true); // upgrades score after addressing feedback
    }, 1200);
  };

  return (
    <RouteGuard allowedRoles={['university', 'coordinator', 'admin']} consoleTitle="Proposal Evaluation Verdict">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Back Nav and Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/college/problems"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-gray-600 hover:text-[#102027] transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Problems
            </Link>

            {/* Test Toggle to see Viable vs Feedback-Revision State */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[#CCD1C7] text-xs font-mono">
              <span className="text-gray-500 text-[11px]">Evaluation Mode:</span>
              <button
                type="button"
                onClick={() => setIsDemoViable(true)}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  isDemoViable ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-black'
                }`}
              >
                Viable (84)
              </button>
              <button
                type="button"
                onClick={() => setIsDemoViable(false)}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  !isDemoViable ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-black'
                }`}
              >
                Revision Needed (48)
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* THE VERDICT HEADER BANNER (Score Large + Verdict Word + Leaderboard) */}
          {/* ========================================================================= */}
          <div className="bg-white border-2 border-[#CCD1C7] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-gray-500 font-bold bg-gray-100 px-2.5 py-0.5 rounded border border-gray-300">
                    CH-GUM-001 · PROPOSAL EVALUATION
                  </span>
                  <span className="ai-provenance-tag">AI DETERMINISTIC VERDICT</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027] mt-1">
                  Siren Relay for Official IMD/Damini Alerts + Low-Cost Field Shelters
                </h1>
                <p className="text-xs text-gray-600 font-mono mt-0.5">
                  Submitted by BIT Mesra ECE - Team MeghDoot (Lead: Dr. A. Verma)
                </p>
              </div>

              {/* Large Score + Verdict Word */}
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-[#CCD1C7] shrink-0">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-bold block">
                    Readiness Score
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-4xl sm:text-5xl font-extrabold font-mono text-[#102027]">
                      {currentScore}
                    </span>
                    <span className="text-sm font-mono text-gray-500">/ 100</span>
                  </div>
                </div>

                <div className="border-l border-gray-300 pl-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-bold block">
                    Competition Verdict
                  </span>
                  <span
                    className={`inline-block mt-1 px-3 py-1 rounded-md text-xs font-mono font-bold ${
                      isLeading
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : isDemoViable
                        ? 'bg-sky-100 text-sky-900 border border-sky-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {isLeading ? 'VIABLE · LEADING' : isDemoViable ? 'VIABLE · COMPETITIVE' : 'NOT VIABLE · REVISION NEEDED'}
                  </span>
                </div>
              </div>
            </div>

            {/* ANONYMIZED LEADERBOARD VIEW (Score and deadline, protecting competitor names) */}
            <div className="p-3.5 bg-[#F4F6F5] rounded-xl border border-[#CCD1C7] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-3">
                <Trophy className="w-4 h-4 text-[#2E7180]" />
                <span>
                  Competition Window: Leading Score is <strong className="text-gray-900 text-sm">84</strong>{' '}
                  <span className="text-gray-500 font-sans text-[11px]">(Competitor identity anonymized until window closes)</span>
                </span>
              </div>

              <CountdownToClose leadingScore={84} />
            </div>

            {/* If NOT VIABLE: Constructive Feedback Banner (Never a bare red number) */}
            {!isDemoViable && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold font-mono text-xs uppercase">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Evaluation Feedback for Student Engineering Team:</span>
                </div>
                <p className="text-xs text-amber-850 leading-relaxed font-sans">
                  Your proposal scored 48/100 because cost efficiency and deployment timeline were penalized for relying on imported hardware components (Page 4). To become viable:
                </p>
                <ul className="list-disc pl-5 text-xs text-amber-850 space-y-1 font-sans">
                  <li>Replace imported components with locally stocked Ranchi Tata Steel depot sirens (Page 3).</li>
                  <li>Incorporate Aapda Mitra community orientation into Week 2 to increase community acceptance score (Page 5).</li>
                </ul>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleResubmit}
                    disabled={isResubmitting}
                    className="touch-target px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResubmitting ? 'animate-spin' : ''}`} />
                    Resubmit Revised Proposal with Local Sourcing
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SIDE-BY-SIDE SPLIT: Rubric & Editable Extracts (Left) vs Document Viewer (Right) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (6 cols): 7 Rubric Criteria & Editable Extracts */}
            <div className="lg:col-span-6 space-y-6">
              {/* 1. All 7 Criteria Breakdown */}
              <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-bold text-[#102027]">
                    7-Factor Objective Evaluation Rubric
                  </h3>
                  <span className="text-[11px] font-mono text-gray-500">Click "Page X" to jump view</span>
                </div>

                <RubricBreakdown
                  ratings={
                    isDemoViable
                      ? { technical: 20, cost: 12, time: 14, local_res: 13, safety: 13, community: 8, scalability: 4 }
                      : { technical: 12, cost: 6, time: 7, local_res: 5, safety: 8, community: 6, scalability: 4 }
                  }
                  activePage={activeViewerPage}
                  onJumpToPage={handleJumpToPage}
                />
              </div>

              {/* 2. Editable Extracted Funding, Duration & Materials */}
              <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#102027]">
                      Extracted Project Specifications (Editable)
                    </h3>
                    <p className="text-xs text-gray-500 font-mono">
                      Extracted by LLM from proposal pages. You can edit before locking.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveExtracts}
                    className="text-xs font-mono font-bold text-[#2E7180] hover:underline"
                  >
                    Save Edits
                  </button>
                </div>

                {saveExtractsNotice && (
                  <div className="p-2 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-800 font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Updated specifications saved to project draft.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono font-bold text-gray-700">Required Budget:</label>
                      <button
                        type="button"
                        onClick={() => handleJumpToPage(4)}
                        className="text-[10px] font-mono text-[#2E7180] hover:underline"
                      >
                        From Page 4
                      </button>
                    </div>
                    <input
                      type="text"
                      value={extractedCost}
                      onChange={(e) => setExtractedCost(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#CCD1C7] font-mono font-bold"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono font-bold text-gray-700">Deployment Duration:</label>
                      <button
                        type="button"
                        onClick={() => handleJumpToPage(3)}
                        className="text-[10px] font-mono text-[#2E7180] hover:underline"
                      >
                        From Page 3
                      </button>
                    </div>
                    <input
                      type="text"
                      value={extractedDuration}
                      onChange={(e) => setExtractedDuration(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#CCD1C7] font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Materials List */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-gray-700">
                      Extracted Bill of Materials (BOM):
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">Lines passed to CSR Marketplace</span>
                  </div>

                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden text-xs">
                    {materials.map((m, idx) => (
                      <div key={idx} className="p-2.5 bg-gray-50/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-gray-500" />
                          <span className="font-semibold text-gray-800">{m.name}</span>
                          <span className="font-mono text-gray-500">({m.qty})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleJumpToPage(m.sourcePage)}
                          className="text-[11px] font-mono text-[#2E7180] hover:underline shrink-0"
                        >
                          Page {m.sourcePage} →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (6 cols): SIDE-BY-SIDE DOCUMENT VIEWER WITH PAGE JUMPS */}
            <div className="lg:col-span-6 sticky top-20">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#2E7180]" />
                    Side-by-Side Proposal PDF Document
                  </span>
                  <span className="text-[11px] font-mono text-gray-500">
                    Auditing against source page
                  </span>
                </div>

                {/* Reusable DocumentViewer Component */}
                <DocumentViewer
                  activePage={activeViewerPage}
                  onPageChange={handleJumpToPage}
                  documentTitle="BIT_Mesra_MeghDoot_Proposal.pdf"
                  totalPages={5}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
