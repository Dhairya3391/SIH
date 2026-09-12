'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  CloudRain, 
  ExternalLink, 
  MapPin, 
  Layers, 
  ShieldCheck, 
  Camera, 
  Upload, 
  FileText, 
  Calendar, 
  RefreshCw,
  ThumbsDown,
  Sparkles,
  Info
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { SEED_UNVERIFIED_REPORTS, UnverifiedReport } from '../page';
import { CitationList } from '@/components/shared/CitationList';
import { FileUploader } from '@/components/shared/FileUploader';
import { ConfidenceLevel } from '@/types/database';

export default function CorroborationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const report = SEED_UNVERIFIED_REPORTS.find((r) => r.id === resolvedParams.id) || SEED_UNVERIFIED_REPORTS[0];

  // Verification Form State
  const [sourceLinks, setSourceLinks] = useState<string[]>(['https://mausam.imd.gov.in/telemetry/sisai']);
  const [newLink, setNewLink] = useState('');
  const [verifierNote, setVerifierNote] = useState('Ground checked at Sisai block; verified high vulnerability in open paddy fields with local Aapda Mitra lead.');
  const [confidenceRung, setConfidenceRung] = useState<ConfidenceLevel>('field_verified');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [disagreedWithAi, setDisagreedWithAi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reject Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const handleAddLink = () => {
    if (newLink.trim() && !sourceLinks.includes(newLink.trim())) {
      setSourceLinks([...sourceLinks, newLink.trim()]);
      setNewLink('');
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate submission to POST /api/challenges/:id/validate
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMessage(
        `Challenge ${report.ref} successfully verified at rung '${confidenceRung}'. Ground cluster validated and forwarded to university R&D window.`
      );
      setTimeout(() => {
        router.push('/verify');
      }, 2500);
    }, 600);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert('A rejection reason is strictly required by state policy.');
      return;
    }
    setRejectSubmitting(true);
    setTimeout(() => {
      setRejectSubmitting(false);
      setShowRejectModal(false);
      router.push('/verify');
    }, 500);
  };

  return (
    <RouteGuard allowedRoles={['volunteer', 'coordinator', 'admin']} consoleTitle="Corroboration Panel">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Back Nav */}
          <div className="flex items-center justify-between">
            <Link
              href="/verify"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-gray-600 hover:text-[#102027] transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Verification Queue
            </Link>
            <span className="text-xs font-mono bg-white px-2.5 py-1 rounded border border-[#CCD1C7]">
              Ref: <strong className="text-gray-900">{report.ref}</strong>
            </span>
          </div>

          {/* Top Banner: Challenge Summary & District */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30">
                PRIORITY {report.priority} · {report.priorityBand.toUpperCase()}
              </span>
              <span className="text-xs font-mono text-gray-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#2E7180]" />
                {report.block}, {report.district}
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-extrabold text-[#102027]">
              {report.hazard}: {report.summary}
            </h1>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-mono text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 1: THE CORROBORATION PANEL (Evidence Sitting ABOVE AI Conclusion) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                  Empirical Verification Engine
                </span>
                <h2 className="text-base font-extrabold text-[#102027] mt-0.5">
                  1. Objective Meteorological & News Evidence
                </h2>
              </div>
              <span className="text-[11px] font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-[#CCD1C7]">
                Evidence sits above AI Model
              </span>
            </div>

            {/* A. Weather Record */}
            <div className="p-4 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CloudRain className="w-4 h-4 text-sky-600" />
                  Meteorological Telemetry Record
                </span>
                <span className="text-[11px] font-mono text-sky-800 bg-white px-2 py-0.5 rounded border border-sky-300 font-semibold">
                  {report.weatherEstimateType === 'point' ? 'Point-Station Reading' : 'District-Level Estimate'}
                </span>
              </div>

              <div className="text-xs text-gray-800 leading-relaxed font-sans">
                <strong>Recorded Conditions:</strong> {report.weatherCondition}
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono text-gray-500">
                <span>Provider: <strong className="text-sky-900">{report.weatherProvider}</strong></span>
                <span>·</span>
                <span>Status: Verified via Open API webhook</span>
              </div>
            </div>

            {/* B. News and Web Results */}
            <div className="space-y-3">
              <span className="text-xs font-mono font-bold text-gray-700 uppercase tracking-wider block">
                News & Web Media Coverage ({report.newsCount} articles indexed)
              </span>
              <CitationList
                citations={[
                  {
                    title: 'Prabhat Khabar: Severe Lightning Claims Two Lives in Gumla Open Fields',
                    publisher: 'Prabhat Khabar Ranchi',
                    date: '10-09-2026',
                    supports: 'Farmer casualties and lack of field warning sirens in Sisai',
                    url: 'https://prabhatkhabar.com',
                    type: 'news',
                  },
                  {
                    title: 'Dainik Jagran: Lightning Red Alert Issued for Chotanagpur Tribal Belt',
                    publisher: 'Dainik Jagran Jharkhand',
                    date: '09-09-2026',
                    supports: 'High atmospheric convective instability and radar flash frequency',
                    url: 'https://jagran.com',
                    type: 'news',
                  },
                ]}
                compact
              />
            </div>

            {/* C. Contradiction Flag (If Present) */}
            {report.contradictionFlag && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-900 uppercase">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Contradicting Evidence Flag (Shown for Human Consideration, Never as a Verdict)</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {report.contradictionFlag}
                </p>
              </div>
            )}

            {/* D. AI Model's Conclusion (Strictly BELOW the Evidence) */}
            <div className="p-4 bg-gray-50 border border-[#CCD1C7] rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#2E7180]" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#102027]">
                    Model Conclusion & Confidence (Machine Suggestion)
                  </span>
                  <span className="ai-provenance-tag">AI-AUTHORED</span>
                </div>

                <span className="text-xs font-mono font-bold text-[#2E7180] bg-white px-2 py-0.5 rounded border border-[#CCD1C7]">
                  Confidence: {report.aiConfidence}%
                </span>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed italic">
                "{report.aiVerdict === 'corroborated'
                  ? 'The automated compiler corroborates this cluster based on alignment between ground reports and high IMD Doppler flash rates. The problem is genuine and urgent.'
                  : 'The model flagged contradictory weather readings in adjacent blocks. Human field inspection recommended.'}"
              </p>

              {/* 1-Click Disagree Button */}
              <div className="pt-1 flex items-center justify-between flex-wrap gap-2 border-t border-gray-200">
                <span className="text-[11px] text-gray-500 font-mono">
                  Does your field inspection contradict this conclusion?
                </span>
                <button
                  type="button"
                  onClick={() => setDisagreedWithAi(!disagreedWithAi)}
                  className={`touch-target px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition flex items-center gap-1.5 ${
                    disagreedWithAi
                      ? 'bg-[#102027] text-white border-black'
                      : 'bg-white text-gray-700 border-[#CCD1C7] hover:bg-gray-100'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  {disagreedWithAi ? 'AI Verdict Overridden by You' : 'Disagree with AI Verdict'}
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: CLUSTER VIEW (Confirming the Whole Cluster, Not a Sentence) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                  Cluster Confirmation View
                </span>
                <h2 className="text-base font-extrabold text-[#102027] mt-0.5">
                  2. Ground Reports in this Challenge Cluster ({report.clusterMembers.length} of {report.reportCount})
                </h2>
              </div>
              <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-[#CCD1C7]">
                Multi-Voice Dedup
              </span>
            </div>

            <p className="text-xs text-gray-600">
              You are verifying an entire community cluster rather than an isolated sentence. Confirming this cluster moves all {report.reportCount} villagers into tracked resolution.
            </p>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden text-xs">
              {report.clusterMembers.map((m) => (
                <div key={m.id} className="p-3 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-gray-500 font-bold mr-2">[{m.time}]</span>
                    <strong className="text-gray-900">{m.village}:</strong>{' '}
                    <span className="text-gray-700 italic">"{m.text}"</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    Clustered (Cosine 0.91)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: VERIFICATION FORM */}
          {/* ========================================================================= */}
          <form onSubmit={handleVerifySubmit} className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                Authorized Field Action
              </span>
              <h2 className="text-base font-extrabold text-[#102027] mt-0.5">
                3. Record Decision, Evidence & Grant Confidence Rung
              </h2>
            </div>

            {/* Confidence Rung Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-gray-700 uppercase">
                Confidence Level Granted:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                {[
                  { val: 'community_corroborated', label: 'Community Corroborated', desc: '≥3 independent reports' },
                  { val: 'field_verified', label: 'Field Verified (Photo/Site)', desc: 'Volunteer inspected' },
                  { val: 'coordinator_approved', label: 'Coordinator Approved', desc: 'Official signed off' },
                ].map((rung) => (
                  <button
                    key={rung.val}
                    type="button"
                    onClick={() => setConfidenceRung(rung.val as ConfidenceLevel)}
                    className={`p-3 rounded-lg border text-left transition ${
                      confidenceRung === rung.val
                        ? 'border-[#2E7180] bg-[#2E7180]/10 ring-1 ring-[#2E7180] font-bold text-[#102027]'
                        : 'border-[#CCD1C7] bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{rung.label}</span>
                      {confidenceRung === rung.val && <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7180]" />}
                    </div>
                    <span className="text-[10px] text-gray-500 font-normal block mt-1">{rung.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Verifier Ground Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-gray-700 uppercase">
                Field Inspection Note:
              </label>
              <textarea
                rows={3}
                value={verifierNote}
                onChange={(e) => setVerifierNote(e.target.value)}
                placeholder="Describe ground verification inspection, conversations with panchayat mukhiya, or location observations..."
                className="w-full text-xs p-3 rounded-lg border border-[#CCD1C7] outline-none focus:border-[#2E7180] font-sans"
              />
            </div>

            {/* Source Links Addition */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-gray-700 uppercase">
                Corroborating Source Links:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://... (IMD bulletin, local news link, or district portal)"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  className="flex-1 text-xs p-2.5 rounded-lg border border-[#CCD1C7] font-mono outline-none focus:border-[#2E7180]"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="touch-target px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-mono font-bold border border-gray-300"
                >
                  Add Link
                </button>
              </div>

              {sourceLinks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sourceLinks.map((link, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#2E7180]/10 text-[#245A66] text-xs font-mono truncate max-w-sm"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{link}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Field Photos Upload with Progress */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-mono font-bold text-gray-700 uppercase">
                Field Evidence Photos (Geo-tagged):
              </label>
              <FileUploader
                accept="image/*,.jpg,.jpeg,.png"
                allowedExtensions={['.jpg', '.jpeg', '.png']}
                title="Upload Ground Site Photos"
                description="Upload photos of site, affected nursery, or broken infrastructure"
                onFileSelected={(file) => setUploadedPhotos([...uploadedPhotos, file.name])}
              />
            </div>

            {/* Actions Bar */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="touch-target px-4 py-2.5 border border-red-300 text-[#D94F45] hover:bg-red-50 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition"
              >
                <XCircle className="w-4 h-4" />
                Reject Report (Explain Consequence)
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="touch-target px-6 py-2.5 bg-[#2E7180] hover:bg-[#245A66] disabled:opacity-50 text-white rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Recording Ground Verification...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm & Forward Cluster to University R&D
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ========================================================================= */}
          {/* REJECT MODAL (Mandatory Reason + Consequence Notice) */}
          {/* ========================================================================= */}
          {showRejectModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border-2 border-red-300 animate-fadeIn">
                <div className="flex items-center gap-2 text-red-700">
                  <XCircle className="w-6 h-6 shrink-0" />
                  <h3 className="text-base font-extrabold text-[#102027]">
                    Reject Challenge Cluster {report.ref}
                  </h3>
                </div>

                {/* Explicit Consequence Notice */}
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1">
                  <span className="font-mono font-bold uppercase tracking-wider block">
                    Consequence Warning:
                  </span>
                  <p className="leading-relaxed">
                    Rejecting will permanently archive this cluster. The original reporters in{' '}
                    <strong>{report.block}</strong> will be notified via SMS that this report was marked not actionable,
                    and this problem will <strong>NOT</strong> be dispatched to universities or CSR partners.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-gray-700 uppercase">
                    Mandatory Reason for Rejection:
                  </label>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Provide specific reason (e.g., Duplicate of existing project, resolved prior to inspection, or invalid location coordinates)..."
                    className="w-full text-xs p-3 rounded-lg border border-[#CCD1C7] outline-none focus:border-red-500 font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="touch-target px-4 py-2 border border-gray-300 hover:bg-gray-100 rounded-lg text-xs font-mono font-bold text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectSubmit}
                    disabled={rejectSubmitting || !rejectReason.trim()}
                    className="touch-target px-4 py-2 bg-[#D94F45] hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    {rejectSubmitting ? 'Recording Rejection...' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </RouteGuard>
  );
}
