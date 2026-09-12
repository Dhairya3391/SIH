'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Trophy, 
  HeartHandshake, 
  Camera, 
  MapPin, 
  Layers, 
  FileText, 
  User, 
  Building2, 
  GraduationCap,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { RouteGuard } from '@/components/shell/RouteGuard';
import { RoleNav } from '@/components/shell/RoleNav';
import { SEED_CHALLENGES } from '@/data/seedData';
import { TimelineGaps } from '@/components/shared/TimelineGaps';

interface LifeEvent {
  id: string;
  stage: string;
  title: string;
  actor: string;
  actorRole: string;
  timestamp: string;
  daysSincePrevious?: number;
  details: string;
  hash?: string;
  badge?: string;
}

export default function OneChallengeWholeLifePage({ params }: { params: Promise<{ ref: string }> }) {
  const resolvedParams = use(params);

  const challenge = SEED_CHALLENGES.find(
    (c) => c.ref === resolvedParams.ref || c.id === resolvedParams.ref
  ) || SEED_CHALLENGES[0];

  const wholeLifeEvents: LifeEvent[] = [
    {
      id: 'e-1',
      stage: '1. Ground Intake',
      title: 'Voice Report Filed by Villager in Sisai Block',
      actor: 'Somra Oraon (Villager)',
      actorRole: 'Citizen',
      timestamp: '2026-09-01 10:15:32 IST',
      details: 'Recorded 24s voice note in Sadri/Hindi regarding 2 farmer deaths in open paddy fields during thunderstorm.',
      hash: 'sha256:4f8a...12c9',
      badge: 'INTAKE',
    },
    {
      id: 'e-2',
      stage: '2. AI Compilation & Dedup',
      title: 'Compiler Merged 31 Reports into Single Cluster',
      actor: 'JharSetu Challenge Compiler (LLM Tool-Use)',
      actorRole: 'Automated Service',
      timestamp: '2026-09-01 10:15:44 IST',
      daysSincePrevious: 0,
      details: 'Cluster generated (cosine similarity 0.91). Priority computed at 82/100 (Critical). Corroborated with IMD Doppler radar flash rate.',
      hash: 'sha256:7b91...88de',
      badge: 'AI-COMPILED',
    },
    {
      id: 'e-3',
      stage: '3. Field Verification',
      title: 'Ground Inspection Confirmed by Aapda Mitra Lead',
      actor: 'Sunil Toppo (Aapda Mitra Volunteer Corps)',
      actorRole: 'Verifier',
      timestamp: '2026-09-02 14:30:10 IST',
      daysSincePrevious: 1,
      details: 'Conducted physical field verification in Sisai. Confirmed lack of mobile alert coverage and absence of field lightning shelters. Granted confidence rung "field_verified".',
      hash: 'sha256:22c4...aa31',
      badge: 'VERIFIED',
    },
    {
      id: 'e-4',
      stage: '4. Competition Window Opened',
      title: 'Challenge Dispatched to Statewide University R&D Registry',
      actor: 'District Disaster Management Authority (DDMA)',
      actorRole: 'Coordinator',
      timestamp: '2026-09-03 09:00:00 IST',
      daysSincePrevious: 1,
      details: '14-day competition window opened with 7-factor deterministic rubric. 10 engineering universities notified.',
      hash: 'sha256:99ff...0012',
      badge: 'WINDOW OPEN',
    },
    {
      id: 'e-5',
      stage: '5. Proposal Submission #1',
      title: 'Team Alpha Proposal Evaluated (Readiness Score 48)',
      actor: 'Team Alpha (Fictional Polytech)',
      actorRole: 'University',
      timestamp: '2026-09-04 16:45:00 IST',
      daysSincePrevious: 1,
      details: 'Submitted generic sensor design. Evaluated across 7 rubric criteria: 48/100 (Penalized for costly imported parts and lack of community warning speakers).',
      hash: 'sha256:55aa...3344',
      badge: 'PROPOSAL 1',
    },
    {
      id: 'e-6',
      stage: '6. Leader Shift & Proposal #2',
      title: 'BIT Mesra ECE Submitted Proposal (Readiness Score 84 - LEADING)',
      actor: 'BIT Mesra ECE - Team MeghDoot (Dr. A. Verma)',
      actorRole: 'University',
      timestamp: '2026-09-06 11:20:00 IST',
      daysSincePrevious: 2,
      details: 'Submitted Damini CAP webhook + 120dB solar siren network. Evaluated at 84/100. Displaced Team Alpha to take the lead.',
      hash: 'sha256:33bc...7761',
      badge: 'LEADER CHANGE',
    },
    {
      id: 'e-7',
      stage: '7. Award & R&D Adoption',
      title: 'Window Closed — Project Formally Awarded to BIT Mesra',
      actor: 'JharSetu Automated Window Scheduler',
      actorRole: 'System Owner',
      timestamp: '2026-09-08 17:00:00 IST',
      daysSincePrevious: 2,
      details: 'Window closed at score 84. BIT Mesra adopted problem as lead R&D institution. Stage plan locked at 4 milestones.',
      hash: 'sha256:11ee...9902',
      badge: 'AWARDED',
    },
    {
      id: 'e-8',
      stage: '8. Resource Swarm Pledges',
      title: 'Tata Steel CSR & CCL Pledged 100% of Required Lines',
      actor: 'Tata Steel CSR Foundation & CCL CSR',
      actorRole: 'Industry',
      timestamp: '2026-09-09 14:10:00 IST',
      daysSincePrevious: 1,
      details: 'Tata Steel pledged 800kg structural steel poles and ₹80,000 cash grant. CCL pledged 12 Faraday cage enclosures. Gap closed to 0.',
      hash: 'sha256:88cd...5510',
      badge: 'SWARM PLEDGED',
    },
    {
      id: 'e-9',
      stage: '9. Dispatch & College Receipt',
      title: '800kg Steel Received & Confirmed by BIT Mesra Team',
      actor: 'Dr. A. Verma (BIT Mesra)',
      actorRole: 'University',
      timestamp: '2026-09-12 10:45:00 IST',
      daysSincePrevious: 3,
      details: 'Confirmed physical receipt of steel mast batch from Ranchi depot under Docket #TS-RNC-4401. Stage 2 unblocked.',
      hash: 'sha256:44aa...1123',
      badge: 'RECEIPT CONFIRMED',
    },
  ];

  return (
    <RouteGuard allowedRoles={['admin']} consoleTitle="Challenge Whole Life Audit">
      <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
        <RoleNav />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
          {/* Back Nav */}
          <div className="flex items-center justify-between">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-gray-600 hover:text-[#102027] transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Admin Command Center
            </Link>

            <span className="text-xs font-mono bg-white px-2.5 py-1 rounded border border-[#CCD1C7]">
              Audit Ledger Hash: <strong className="text-emerald-800">44aa...1123 (Verified)</strong>
            </span>
          </div>

          {/* Top Banner */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#D94F45]/15 text-[#A8332A] border border-[#D94F45]/30">
                CHALLENGE {challenge.ref || challenge.id} · WHOLE LIFE AUDIT
              </span>
              <span className="text-xs font-mono text-gray-500">
                {wholeLifeEvents.length} Recorded Lifecycle Transactions
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-[#102027]">
              {challenge.title}
            </h1>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-sans">
              Complete chronological audit trail: from villager voice note in Sisai block, AI compilation, ground verification, proposal versions and leader changes, to CSR resource delivery and verified stage progression.
            </p>
          </div>

          {/* Horizontal Timeline Strip with Gaps in Days */}
          <TimelineGaps
            projectTitle={`Elapsed Intervals: ${challenge.title}`}
            events={wholeLifeEvents.map((e, idx) => ({
              id: e.id,
              label: e.stage,
              date: e.timestamp.split(' ')[0],
              actor: e.actor,
              daysSincePrevious: e.daysSincePrevious,
              status: idx === wholeLifeEvents.length - 1 ? 'current' : 'completed',
            }))}
          />

          {/* Chronological Life Ledger Rows */}
          <div className="bg-white border border-[#CCD1C7] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#102027]">
                Transaction Ledger (Ordered by Timestamp)
              </h3>
              <span className="text-xs font-mono text-gray-500">Hash-Chained & Immutable</span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#CCD1C7]">
              {wholeLifeEvents.map((event) => (
                <div key={event.id} className="relative">
                  {/* Marker */}
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-[#2E7180] flex items-center justify-center text-[#2E7180]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>

                  <div className="p-4 bg-gray-50/70 border border-[#CCD1C7] rounded-xl space-y-2 hover:border-[#2E7180] transition">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#2E7180]">
                          {event.stage}
                        </span>
                        <h4 className="font-bold text-sm text-[#102027]">{event.title}</h4>
                      </div>

                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-gray-700 border border-gray-300">
                        {event.badge}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed font-sans">
                      {event.details}
                    </p>

                    <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-gray-500">
                      <div className="flex items-center gap-2">
                        <span>Actor: <strong className="text-gray-900">{event.actor}</strong> ({event.actorRole})</span>
                        <span>·</span>
                        <span>{event.timestamp}</span>
                      </div>

                      {event.hash && (
                        <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {event.hash}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
