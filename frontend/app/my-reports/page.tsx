'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Users, 
  ExternalLink, 
  ArrowRight, 
  CloudRain, 
  GraduationCap, 
  Building2, 
  PhoneCall, 
  RefreshCw,
  Sparkles,
  WifiOff,
  Send,
  Eye
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { getQueuedReports, flushOfflineQueue, setupOfflineSyncListener, QueuedReport } from '@/lib/offlineQueue';
import { SEED_CHALLENGES } from '@/data/seedData';
import { CitationList, Citation } from '@/components/shared/CitationList';

// Plain language status mapping (never raw enum names!)
export function getPlainLanguageStatus(status: string): { label: string; color: string; desc: string } {
  switch (status) {
    case 'REPORTED':
      return { 
        label: 'Waiting to be checked', 
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        desc: 'Your report has reached the system and is waiting for ground verification.'
      };
    case 'REFINED':
      return { 
        label: 'Compiled by AI & grouped', 
        color: 'bg-sky-100 text-sky-800 border-sky-300',
        desc: 'The Challenge Compiler structured your voice note and matched it with nearby reports.'
      };
    case 'VERIFIED':
      return { 
        label: 'Confirmed by a verifier', 
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        desc: 'A local Aapda Mitra volunteer or district officer visited and verified this need.'
      };
    case 'OPEN':
    case 'TEAM_FORMED':
    case 'SOLUTION_PROPOSED':
    case 'PILOT':
      return { 
        label: 'A college is working on it', 
        color: 'bg-teal-100 text-teal-800 border-teal-300',
        desc: 'Engineering students from BIT Mesra ECE Lab are building and testing an active prototype.'
      };
    case 'DEPLOYED':
    case 'IMPACT_VERIFIED':
      return { 
        label: 'Finished & Verified on Ground', 
        color: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold',
        desc: 'Work is installed, tested, and confirmed resolved by the community.'
      };
    default:
      return { 
        label: 'In Review', 
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        desc: 'Ground coordination in progress.'
      };
  }
}

const SEED_CITIZEN_REPORTS = [
  {
    id: 'rep-gumla-31',
    date: '3 days ago',
    originalText: 'Panchayat Sisai aur Bharno ke beech khet me bijli girne se 2 kisan bhaiyo ki maut ho gayi. Khet me koi siren ya alert nahi pahunchta.',
    district: 'Gumla',
    village: 'Sisai Block (Bharno-Sisai border)',
    status: 'PILOT',
    challengeRef: 'CH-GUM-001',
    challengeTitle: 'Last-mile lightning alerts and safe shelter for farm workers, Gumla block',
    clusterMergeNote: 'Your report joined 30 other reports from 12 villages across Gumla block. Together, these reports escalated the priority score from 28 (isolated) to 82 (CRITICAL).',
    leadOrg: 'BIT Mesra ECE Lab (Team MeghDoot)',
    progressUpdate: 'Prototype 120dB solar acoustic sirens tested successfully in lab. Installation scheduled at Sisai Panchayat rooftop this week.',
    corroboration: [
      {
        title: 'IMD Lightning Doppler Radar Detection — Chotanagpur Plateau',
        publisher: 'IMD Mausam / Damini Network',
        date: '10-09-2026',
        supports: 'Cloud-to-ground flash rate > 45 strikes/hr in Sisai block',
        url: 'https://mausam.imd.gov.in',
        type: 'weather' as const,
      },
      {
        title: 'Prabhat Khabar: Fatal lightning strike claims two in Gumla rural belt',
        publisher: 'Prabhat Khabar Ranchi',
        date: '09-09-2026',
        supports: 'Confirmed 2 farmer casualties in Sisai block open fields',
        url: 'https://prabhatkhabar.com',
        type: 'news' as const,
      },
    ],
    verifierConfirmed: true,
    verifierNote: 'Ground inspected by Sunil Toppo (Aapda Mitra Volunteer). Confirmed open paddy fields lack shade or siren reach.',
  },
  {
    id: 'rep-gumla-12',
    date: '1 week ago',
    originalText: 'Solar drinking water pump broken for 2 weeks. Village children walking 2km for water.',
    district: 'Gumla',
    village: 'Kolebira Road',
    status: 'REPORTED',
    challengeRef: 'CH-GUM-004',
    challengeTitle: 'Solar pump inverter failure and borewell water disruption',
    clusterMergeNote: 'This report is currently unmerged. Waiting for verification from the field team.',
    verifierConfirmed: false,
    corroboration: [],
  },
];

export default function MyReportsPage() {
  const [offlineReports, setOfflineReports] = useState<QueuedReport[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'followed'>('reports');

  const reloadOfflineQueue = () => {
    setOfflineReports(getQueuedReports());
  };

  useEffect(() => {
    reloadOfflineQueue();
    const cleanup = setupOfflineSyncListener(reloadOfflineQueue);
    return cleanup;
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await flushOfflineQueue();
      reloadOfflineQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['citizen']} consoleTitle="Citizen Ground Reports">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Headline & Welcoming villager banner */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-[#2E7180] font-bold uppercase tracking-wider">
                Citizen Portal · Johar!
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027] mt-1">
                My Ground Reports & Problem Tracking
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                Track how your voice note travels from the village field to college engineers and verified ground resolution.
              </p>
            </div>

            <Link
              href="/report"
              className="touch-target px-4 py-2.5 rounded-lg bg-[#2E7180] hover:bg-[#245A66] text-white text-xs font-bold font-mono flex items-center justify-center gap-1.5 shadow-xs transition shrink-0"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Report Another Need
            </Link>
          </div>

          {/* Low-Connectivity / Offline Outbox Strip */}
          {offlineReports.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-amber-700" />
                  <h4 className="text-xs font-mono font-bold text-amber-900">
                    Local Device Outbox ({offlineReports.length} reports queued locally)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="touch-target px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-mono font-bold flex items-center gap-1 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync Outbox Now
                </button>
              </div>

              <div className="divide-y divide-amber-200 border border-amber-200 rounded-lg bg-white overflow-hidden text-xs">
                {offlineReports.map((q) => (
                  <div key={q.clientId} className="p-3 flex items-center justify-between gap-3">
                    <div className="truncate">
                      <p className="font-semibold text-gray-800 truncate">"{q.payload.text}"</p>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {q.payload.village || 'Local area'} · {q.payload.district || 'Jharkhand'} · Client ID: {q.clientId}
                      </div>
                    </div>

                    <div className="shrink-0 font-mono text-xs">
                      {q.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                          Pending Network
                        </span>
                      )}
                      {q.status === 'sending' && (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Sending...
                        </span>
                      )}
                      {q.status === 'sent' && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Sent & Logged
                        </span>
                      )}
                      {q.status === 'failed' && (
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                          Retry Needed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reports List */}
          <div className="space-y-4">
            {SEED_CITIZEN_REPORTS.map((rep) => {
              const statusInfo = getPlainLanguageStatus(rep.status);

              return (
                <div
                  key={rep.id}
                  className="bg-white border border-[#CCD1C7] rounded-2xl p-5 shadow-xs space-y-4 hover:border-[#2E7180] transition"
                >
                  {/* Top Bar: Plain-Language Status & Date */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold border ${statusInfo.color}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {statusInfo.label}
                      </span>
                      <span className="text-[11px] font-mono text-gray-400">· {rep.date}</span>
                    </div>

                    <span className="text-xs font-mono text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#2E7180]" />
                      {rep.village}, {rep.district}
                    </span>
                  </div>

                  {/* Original text filed by citizen */}
                  <div className="p-3 bg-[#F4F6F5] rounded-xl border border-[#CCD1C7]/70 text-xs sm:text-sm text-gray-800 italic">
                    "{rep.originalText}"
                  </div>

                  {/* What AI made of it & cluster merge reassurance */}
                  {rep.clusterMergeNote && (
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>AI Cluster Consolidation</span>
                        <span className="ai-provenance-tag ml-1">AI-AUTHORED MERGE</span>
                      </div>
                      <p className="text-xs text-emerald-800 leading-relaxed font-sans">
                        {rep.clusterMergeNote}
                      </p>
                    </div>
                  )}

                  {/* Active College Project Details */}
                  {rep.leadOrg && (
                    <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                        <GraduationCap className="w-3.5 h-3.5 text-sky-700" />
                        <span>Assigned R&D Team: {rep.leadOrg}</span>
                      </div>
                      <p className="text-xs text-sky-800 leading-relaxed">
                        {rep.progressUpdate}
                      </p>
                    </div>
                  )}

                  {/* External Corroboration Box */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-gray-700 flex items-center gap-1">
                        <CloudRain className="w-3.5 h-3.5 text-[#2E7180]" />
                        Automated Corroboration & Verification Check
                      </span>
                      <span className="text-[11px] font-mono text-gray-500">
                        {rep.verifierConfirmed ? 'Verified by Field Volunteer' : 'A verifier still needs to confirm this'}
                      </span>
                    </div>

                    {rep.corroboration && rep.corroboration.length > 0 ? (
                      <CitationList citations={rep.corroboration} title="External Meteorological & Media Sources" compact />
                    ) : (
                      <div className="p-2.5 bg-gray-50 rounded-lg text-xs text-gray-500 font-mono border border-dashed border-[#CCD1C7]">
                        A verifier still needs to confirm this report with field photos.
                      </div>
                    )}
                  </div>

                  {/* Link to follow challenge page */}
                  {rep.challengeRef && (
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-mono">
                        Challenge ID: <strong className="text-gray-800">{rep.challengeRef}</strong>
                      </span>
                      <Link
                        href={`/challenge/${rep.challengeRef}`}
                        className="text-xs font-mono font-bold text-[#2E7180] hover:underline flex items-center gap-1"
                      >
                        Follow Project Progress & Live Updates <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
