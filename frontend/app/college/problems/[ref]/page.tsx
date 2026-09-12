'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  MapPin, 
  Users, 
  Flame, 
  CheckCircle2, 
  Sparkles, 
  Upload, 
  FileText, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Layers,
  Wrench,
  Loader2
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { SEED_CHALLENGES } from '@/data/seedData';
import { CountdownToClose } from '@/components/shared/CountdownToClose';
import { LeaderBadge } from '@/components/shared/LeaderBadge';
import { FileUploader } from '@/components/shared/FileUploader';

export default function CollegeProblemDetailPage({ params }: { params: Promise<{ ref: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const challenge = SEED_CHALLENGES.find(
    (c) => c.ref === resolvedParams.ref || c.id === resolvedParams.ref
  ) || SEED_CHALLENGES[0];

  // Proposal Upload & Waiting State Workflow
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [teamName, setTeamName] = useState('BIT Mesra ECE - Team MeghDoot');
  const [piName, setPiName] = useState('Dr. A. Verma');
  const [estimatedCost, setEstimatedCost] = useState('₹1,40,000');
  const [deployDays, setDeployDays] = useState('28');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState<number>(0);
  const [stageDescription, setStageDescription] = useState<string>('');

  const handleFileChosen = (file: File) => {
    setSelectedFile(file);
  };

  const handleStartUploadAndEvaluation = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgressStage(1);
    setStageDescription('Uploading proposal PDF to encrypted document storage...');

    // Multi-step transparent waiting state as required by prompt
    setTimeout(() => {
      setProgressStage(2);
      setStageDescription('Extracting technical methodology, BOM materials, costs, and timeline from PDF...');
    }, 1800);

    setTimeout(() => {
      setProgressStage(3);
      setStageDescription('Evaluating proposal across all 7 deterministic rubric criteria via LLM compiler...');
    }, 3800);

    setTimeout(() => {
      setProgressStage(4);
      setStageDescription('Generating verdict report and page cross-references...');
    }, 5500);

    setTimeout(() => {
      // Redirect to the Verdict screen
      router.push('/college/proposals/prop-1');
    }, 6800);
  };

  return (
    <RouteGuard allowedRoles={['university', 'coordinator', 'admin']} consoleTitle="College Proposal Submission">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Back Nav */}
          <div className="flex items-center justify-between">
            <Link
              href="/college/problems"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-gray-600 hover:text-[#102027] transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Problem Browser
            </Link>
            <div className="flex items-center gap-2">
              <CountdownToClose leadingScore={84} compact />
            </div>
          </div>

          {/* Top Banner */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-300">
                  {challenge.ref || challenge.id}
                </span>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30">
                  PRIORITY {challenge.priority} · {challenge.priority_band.toUpperCase()}
                </span>
              </div>

              <LeaderBadge state="leading" leadingScore={84} userScore={84} />
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027]">
              {challenge.title}
            </h1>

            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-sans">
              {challenge.problem}
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-gray-100 text-xs font-mono text-gray-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#2E7180]" />
                {challenge.district}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#2E7180]" />
                {challenge.people_est.toLocaleString()} people affected
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 text-emerald-800 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Ground Problem
              </span>
            </div>
          </div>

          {/* TWO COLUMNS: Problem Details / Rubric Criteria vs Proposal Submission Portal */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Col (5 cols): What is already nearby & Capabilities needed */}
            <div className="lg:col-span-5 space-y-4">
              {/* Capabilities needed */}
              <div className="bg-white border border-[#CCD1C7] rounded-xl p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-mono font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-[#2E7180]" />
                  Capabilities & Engineering Disciplines
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {challenge.capabilities_needed.map((cap, i) => (
                    <span
                      key={i}
                      className="text-xs font-mono bg-teal-50 text-[#245A66] px-2.5 py-1 rounded-md border border-[#2E7180]/20 font-semibold"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* What is already nearby */}
              {challenge.available_nearby && challenge.available_nearby.length > 0 && (
                <div className="bg-white border border-[#CCD1C7] rounded-xl p-4 shadow-xs space-y-3">
                  <h4 className="text-xs font-mono font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#2E7180]" />
                    Resources Already Nearby (In Radius)
                  </h4>
                  <ul className="space-y-2 text-xs text-gray-700">
                    {challenge.available_nearby.map((res, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{res}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 7 Rubric Criteria Reminder */}
              <div className="bg-white border border-[#CCD1C7] rounded-xl p-4 shadow-xs space-y-2 text-xs font-mono">
                <span className="font-bold text-gray-800 uppercase tracking-wider block">
                  Evaluation Rubric (100 Marks)
                </span>
                <p className="text-gray-500 font-sans text-[11px]">
                  Every submission is objectively evaluated across 7 weighted criteria:
                </p>
                <div className="space-y-1 text-gray-700 pt-1">
                  <div className="flex justify-between"><span>1. Technical Feasibility</span><strong>20 pts</strong></div>
                  <div className="flex justify-between"><span>2. Cost Realism & Efficiency</span><strong>15 pts</strong></div>
                  <div className="flex justify-between"><span>3. Time to Deployment</span><strong>15 pts</strong></div>
                  <div className="flex justify-between"><span>4. Local Resource Utilization</span><strong>15 pts</strong></div>
                  <div className="flex justify-between"><span>5. Safety & Risk Mitigation</span><strong>15 pts</strong></div>
                  <div className="flex justify-between"><span>6. Community Acceptance & Fit</span><strong>10 pts</strong></div>
                  <div className="flex justify-between"><span>7. Scalability & Maintainability</span><strong>10 pts</strong></div>
                </div>
              </div>
            </div>

            {/* Right Col (7 cols): Proposal Upload Portal */}
            <div className="lg:col-span-7">
              <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
                <div className="border-b border-gray-100 pb-3">
                  <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                    Submit Proposal PDF
                  </span>
                  <h3 className="text-base font-extrabold text-[#102027] mt-0.5">
                    Upload R&D Engineering Proposal Document
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Upload a complete PDF with executive summary, BOM materials, and deployment timeline.
                  </p>
                </div>

                {/* PROCESSING / WAITING STATE (Required by prompt) */}
                {isProcessing ? (
                  <div className="p-6 bg-teal-50/70 border-2 border-[#2E7180] rounded-xl text-center space-y-4 animate-fadeIn">
                    <div className="w-12 h-12 rounded-full bg-[#2E7180]/10 text-[#2E7180] flex items-center justify-center mx-auto">
                      <Loader2 className="w-6 h-6 animate-spin text-[#2E7180]" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-[#102027] font-mono">
                        Step {progressStage} of 4: In Progress
                      </h4>
                      <p className="text-xs text-[#245A66] font-medium leading-relaxed max-w-md mx-auto">
                        {stageDescription}
                      </p>
                    </div>

                    {/* Progress steps indicator */}
                    <div className="grid grid-cols-4 gap-2 pt-2 max-w-md mx-auto text-[10px] font-mono">
                      <div className={`p-1.5 rounded border ${progressStage >= 1 ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold' : 'bg-gray-100 text-gray-400'}`}>
                        1. Storage
                      </div>
                      <div className={`p-1.5 rounded border ${progressStage >= 2 ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold' : 'bg-gray-100 text-gray-400'}`}>
                        2. Extraction
                      </div>
                      <div className={`p-1.5 rounded border ${progressStage >= 3 ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold' : 'bg-gray-100 text-gray-400'}`}>
                        3. 7-Criteria
                      </div>
                      <div className={`p-1.5 rounded border ${progressStage >= 4 ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold' : 'bg-gray-100 text-gray-400'}`}>
                        4. Verdict
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-500 italic font-mono pt-1">
                      "Extraction and rubric scoring take ~8-15 seconds. Please do not close this window."
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Basic Meta fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-mono font-bold text-gray-700 block mb-1">
                          Team / Lab Name:
                        </label>
                        <input
                          type="text"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#CCD1C7] font-semibold"
                        />
                      </div>
                      <div>
                        <label className="font-mono font-bold text-gray-700 block mb-1">
                          Principal Investigator:
                        </label>
                        <input
                          type="text"
                          value={piName}
                          onChange={(e) => setPiName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#CCD1C7] font-semibold"
                        />
                      </div>
                      <div>
                        <label className="font-mono font-bold text-gray-700 block mb-1">
                          Estimated Cost (INR):
                        </label>
                        <input
                          type="text"
                          value={estimatedCost}
                          onChange={(e) => setEstimatedCost(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#CCD1C7] font-semibold font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-mono font-bold text-gray-700 block mb-1">
                          Estimated Deploy Days:
                        </label>
                        <input
                          type="number"
                          value={deployDays}
                          onChange={(e) => setDeployDays(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#CCD1C7] font-semibold font-mono"
                        />
                      </div>
                    </div>

                    {/* Drag-and-drop PDF Uploader */}
                    <FileUploader
                      accept=".pdf,application/pdf"
                      allowedExtensions={['.pdf']}
                      title="Select or Drop Proposal PDF"
                      description="Upload your engineering brief, BOM, and deployment diagrams"
                      onFileSelected={handleFileChosen}
                    />

                    {/* Submit and Evaluate Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleStartUploadAndEvaluation}
                        disabled={!selectedFile}
                        className="touch-target px-6 py-2.5 bg-[#2E7180] hover:bg-[#245A66] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono font-bold rounded-lg flex items-center gap-2 shadow-xs transition cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        Upload & Run 7-Criteria AI Evaluation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
