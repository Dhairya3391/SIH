'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  CheckCircle2, 
  MapPin, 
  Camera, 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  UploadCloud,
  FileSpreadsheet,
  Users,
  Navigation
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { SEED_REPORTS } from '@/data/seedData';

export default function VerifyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [report, setReport] = useState<any>(SEED_REPORTS.find(r => r.id === id) || SEED_REPORTS[0]);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('jharsetu_custom_reports');
      if (saved) {
        const custom: any[] = JSON.parse(saved);
        const match = custom.find(r => r.id === id || r.client_id === id);
        if (match) setReport(match);
      }
    } catch {}
  }, [id]);

  const [severityConfirmed, setSeverityConfirmed] = useState(4);
  const [peopleEst, setPeopleEst] = useState(450);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [uploadProof, setUploadProof] = useState(true);

  React.useEffect(() => {
    if (report) {
      setSeverityConfirmed(report.urgency || 4);
      setPeopleEst(report.people_est || 450);
    }
  }, [report]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      router.push('/verify');
    }, 2000);
  };

  return (
    <RoleGuard 
      allowedRoles={['volunteer', 'coordinator', 'admin']} 
      title="Perform Field Verification"
      description="Ground truth confirmation protocol for verifying citizen reports with GPS coordinates, on-site photographs, and corroboration."
    >
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* Back Link */}
        <Link
          href="/verify"
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-[#2E7180] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Verification Queue</span>
        </Link>

        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-300 p-8 rounded-2xl text-center space-y-4 shadow-sm animate-in fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900">
              Field Verification Recorded!
            </h2>
            <p className="text-xs text-emerald-700 max-w-md mx-auto">
              Confidence level elevated to <strong>FIELD_VERIFIED</strong>. Ledger transaction signed with Verifier ID #VER-SK-8492. Redirecting to queue...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl border border-[#CCD1C7] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  REPORT REF #{report.id.toUpperCase()}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-300">
                  PENDING FIELD CHECK
                </span>
              </div>
              <h1 className="text-xl font-bold text-[#102027]">
                {report.original_text}
              </h1>
              <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {report.district} ({report.village || 'Panchayat Area'})
                </span>
                <span>GPS: {report.lat.toFixed(4)}, {report.lng.toFixed(4)}</span>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="bg-white p-6 rounded-2xl border border-[#CCD1C7] space-y-6">
              <h2 className="text-base font-bold text-[#102027] border-b border-gray-100 pb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <span>On-Site Ground Assessment</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Severity adjustment */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700">
                    Confirmed Ground Severity (1 to 5)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={severityConfirmed}
                    onChange={(e) => setSeverityConfirmed(Number(e.target.value))}
                    className="w-full accent-amber-600"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-gray-500">
                    <span>1: Minor</span>
                    <span className="font-bold text-amber-700 text-sm">{severityConfirmed} / 5</span>
                    <span>5: Critical Crisis</span>
                  </div>
                </div>

                {/* People affected adjustment */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700">
                    Estimated Inhabitants Affected
                  </label>
                  <input
                    type="number"
                    value={peopleEst}
                    onChange={(e) => setPeopleEst(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              {/* Photo Evidence Simulation */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">
                  Geo-Tagged Photographic Evidence
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50 space-y-2">
                  <Camera className="w-8 h-8 text-gray-400 mx-auto" />
                  <div className="text-xs text-gray-600 font-medium">
                    Attached: <strong>IMG_FIELD_SITE_PROOF_8492.JPG</strong> (EXIF geocoded)
                  </div>
                  <div className="text-[11px] text-emerald-700 font-mono">
                    ✓ EXIF Metadata verified: 23.3441° N, 85.3096° E · Accuracy ±6m
                  </div>
                </div>
              </div>

              {/* Ground notes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">
                  Field Inspector Notes & Ground Truth Findings
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Inspected on site. Three village handpumps are non-functional due to lowered water table. School children currently walking 2.5km to stream..."
                  className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-amber-600"
                />
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href="/verify"
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-100 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Field Verification & Sign Ledger</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </RoleGuard>
  );
}
