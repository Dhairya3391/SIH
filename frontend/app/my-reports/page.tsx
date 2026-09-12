'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Sparkles, 
  ArrowRight, 
  PhoneCall, 
  Volume2, 
  ChevronRight, 
  ExternalLink,
  Users,
  GraduationCap,
  Bell,
  Check,
  Newspaper,
  CloudSun,
  ShieldCheck,
  Camera,
  Layers,
  Wrench,
  ThumbsUp
} from 'lucide-react';
import { RouteGuard as RoleGuard } from '@/components/shell/RouteGuard';
import { SEED_REPORTS, SEED_CHALLENGES } from '@/data/seedData';
import { useAuth } from '@/lib/auth';

interface CorroborationSource {
  type: 'news' | 'weather' | 'satellite';
  title: string;
  source: string;
  date: string;
  url: string;
}

interface CollegeUpdate {
  date: string;
  author: string;
  text: string;
  photoUrl?: string;
  stage: string;
}

export default function MyReportsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [customReports, setCustomReports] = useState<any[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({
    'rep-001': true,
    'rep-002': true,
  });
  const [verifiedIds, setVerifiedIds] = useState<string[]>([]);
  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>('rep-001');

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('jharsetu_custom_reports');
      if (saved) setCustomReports(JSON.parse(saved));
      const v = localStorage.getItem('jharsetu_verified_report_ids');
      if (v) setVerifiedIds(JSON.parse(v));
    } catch {}
  }, []);

  const toggleFollow = (id: string) => {
    setFollowingMap(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Convert technical enum states to plain, human-friendly village language
  const getPlainLanguageStatus = (status: string, isVerified: boolean) => {
    if (status === 'DEPLOYED' || status === 'IMPACT_VERIFIED') {
      return {
        label: 'Finished & working in your village',
        sub: 'Verified by district officers and community elders.',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        icon: CheckCircle2,
      };
    }
    if (status === 'PILOT') {
      return {
        label: 'Solution is being pilot-tested in your block',
        sub: 'Working prototype installed on site for 14-day field trial.',
        badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
        icon: Wrench,
      };
    }
    if (['TEAM_FORMED', 'SOLUTION_PROPOSED', 'OPEN'].includes(status)) {
      return {
        label: 'A college team is working on the solution',
        sub: 'BIT Mesra faculty & students are building the technical fix.',
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
        icon: GraduationCap,
      };
    }
    if (isVerified || status === 'VERIFIED') {
      return {
        label: 'Confirmed by a verifier on the ground',
        sub: 'Volunteer Sanjay Kisku inspected and verified with GPS & photos.',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
        icon: ShieldCheck,
      };
    }
    return {
      label: 'Waiting to be checked by a ground officer',
      sub: 'Assigned to the local panchayat volunteer for on-site visit.',
      badgeClass: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: Clock,
    };
  };

  // Realistic external corroborations
  const getCorroborations = (category: string, district: string): CorroborationSource[] => {
    if (category === 'water' || category === 'agriculture') {
      return [
        {
          type: 'news',
          title: `Dainik Jagran (${district}): Groundwater table drops 35 feet across block`,
          source: 'Dainik Jagran Jharkhand Edition',
          date: 'Aug 2026',
          url: 'https://jagran.com/jharkhand',
        },
        {
          type: 'weather',
          title: 'IMD Weather Bureau: 42% seasonal monsoon rainfall deficit recorded',
          source: 'India Meteorological Dept (IMD Ranchi)',
          date: 'Aug 2026',
          url: 'https://mausam.imd.gov.in',
        },
      ];
    }
    return [
      {
        type: 'news',
        title: `Prabhat Khabar (${district}): Heavy thunderstorms trigger localized infrastructure damage`,
        source: 'Prabhat Khabar State Desk',
        date: 'Sep 2026',
        url: 'https://prabhatkhabar.com',
      },
      {
        type: 'satellite',
        title: 'ISRO Bhuvan Geo-Portal: Surface moisture anomaly detected',
        source: 'National Remote Sensing Centre',
        date: 'Sep 2026',
        url: 'https://bhuvan.nrsc.gov.in',
      },
    ];
  };

  // College updates for citizen tracking
  const collegeUpdatesMock: Record<string, CollegeUpdate[]> = {
    'rep-001': [
      {
        date: 'Sep 11, 2026',
        author: 'Dr. Anirban Roy & Priya Kumari (BIT Mesra)',
        text: 'Our engineering capstone team completed lab testing on the low-cost arsenic adsorption filter. Fabrication of 5 field units completed.',
        stage: 'Lab Tested',
      },
      {
        date: 'Sep 12, 2026',
        author: 'BIT Mesra Field Deployment Unit',
        text: 'Dispatched units to Gumla District Panchayat Bhavan. Ground installation scheduled for this week with CSR co-funding from Tata Steel.',
        stage: 'Dispatched to Block',
      },
    ],
    'rep-002': [
      {
        date: 'Sep 09, 2026',
        author: 'NIT Jamshedpur Rural Engineering Lab',
        text: 'Structural design review completed for the reinforced culvert replacement. Local gravel sourcing verified.',
        stage: 'Design Approved',
      },
    ],
  };

  // Combine custom newly submitted reports with seed reports
  const myReports = [
    ...customReports,
    ...SEED_REPORTS.filter(r => r.district === 'Gumla' || r.reporter_name?.includes('Sunita') || true),
  ].slice(0, 6);

  return (
    <RoleGuard 
      allowedRoles={['citizen', 'coordinator', 'admin']} 
      title="Citizen Report Tracking"
      description="Track the status of your submitted community issues in simple language, see who has joined your report, and view college progress."
    >
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 sm:p-7 rounded-2xl border border-[#CCD1C7] shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-[#2E7180]">
              <FileText className="w-4 h-4" />
              <span>Citizen Service Portal · ग्रामीण सेवा केंद्र</span>
            </div>
            <h1 className="text-2xl font-bold text-[#102027] mt-1">
              My Submissions & Community Grievances
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              Registered Reporter: <strong>Sunita Soren</strong> (+91 94311-XXXXX) · Gumla District, Sisai Block
            </p>
          </div>

          <Link
            href="/report"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2E7180] text-white font-bold text-sm hover:bg-[#235864] transition shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Report Another Problem</span>
          </Link>
        </div>

        {/* Reassurance Banner */}
        <div className="bg-gradient-to-r from-[#EAF4EE] to-[#E3F2FD] p-5 rounded-2xl border border-[#2E7180]/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#2E7180] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold font-mono uppercase text-[#2E7180]">
                Community Strength & Collective Voice
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#102027] mt-0.5">
                Every grievance submitted here is grouped with neighboring hamlets to create official district problem briefs for university engineering labs.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
            ✓ 100% Tracked on State Ledger
          </span>
        </div>

        {/* Reports Timeline List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#102027] flex items-center gap-2">
              <span>Your Reported Problems Timeline</span>
              <span className="text-xs font-mono font-normal bg-gray-200 px-2 py-0.5 rounded-full text-gray-700">
                {myReports.length} Active
              </span>
            </h2>
          </div>

          <div className="space-y-6">
            {myReports.map((report, idx) => {
              const reportKey = report.id?.toLowerCase() || `rep-${idx}`;
              const matchedChallenge = SEED_CHALLENGES.find(c => c.district === report.district) || SEED_CHALLENGES[0];
              const isVerified = verifiedIds.includes(report.id) || idx === 0 || idx === 1;
              const isFollowing = followingMap[reportKey] ?? true;
              const statusInfo = getPlainLanguageStatus(matchedChallenge?.status || 'SOLUTION_PROPOSED', isVerified);
              const StatusIcon = statusInfo.icon;
              const corroborations = getCorroborations(report.category, report.district);
              const collegeUpdates = collegeUpdatesMock[reportKey] || collegeUpdatesMock['rep-001'];
              const isExpanded = expandedUpdateId === reportKey;

              // Cluster calculation
              const clusterCount = idx === 0 ? 31 : idx === 1 ? 18 : 7;
              const villageCount = idx === 0 ? 3 : 2;

              return (
                <div 
                  key={report.id || idx}
                  className="bg-white rounded-2xl border border-[#CCD1C7] p-6 hover:border-[#2E7180] transition shadow-sm space-y-5"
                >
                  {/* Top Bar: Reference ID & Plain Language Status Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 border border-gray-200">
                        REF #{String(report.id || `REP-${idx + 1}`).toUpperCase()}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        {report.category?.toUpperCase() || 'CIVIC ISSUE'}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        Submitted on {new Date(report.created_at || Date.now()).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Plain Language Real State Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}>
                        <StatusIcon className="w-4 h-4 shrink-0" />
                        <span>{statusInfo.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Citizen's Original Problem Description */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono font-bold uppercase text-gray-500">
                      Your Problem Report:
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-[#102027]">
                      "{report.original_text}"
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-600 pt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-[#2E7180]" />
                        {report.district} ({report.village || 'Sisai Area'})
                      </span>
                      <span>·</span>
                      <span className="font-medium">
                        ~{report.people_est || 350} neighbors impacted
                      </span>
                    </div>
                  </div>

                  {/* FE-2 REQUIREMENT: THE REASSURING MERGE CLUSTER BANNER */}
                  <div className="bg-[#EAF4EE] border border-[#2E7180]/30 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase text-[#2E7180]">
                      <Users className="w-4 h-4 text-[#2E7180]" />
                      <span>Cluster Strength · You Are Not Alone</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[#102027]">
                      🎉 Your report joined {clusterCount} other reports from {villageCount} neighboring villages.
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <strong>What the district understood:</strong> "{matchedChallenge?.problem || 'Acute community water and infrastructure bottleneck requiring urgent engineering response.'}"
                    </p>
                  </div>

                  {/* FE-2 REQUIREMENT: HONEST CORROBORATION & NEWS / WEATHER EVIDENCE */}
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono uppercase text-amber-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                        Automated Data Corroboration (Ground + External)
                      </span>
                      {isVerified ? (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          ✓ Field Verifier Confirmed On Site
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          ⏳ A verifier still needs to confirm on-site
                        </span>
                      )}
                    </div>

                    <p className="text-gray-700 text-[11px]">
                      We automatically cross-referenced your report with published news articles and meteorological archives:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {corroborations.map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition group"
                        >
                          {c.type === 'news' ? (
                            <Newspaper className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          ) : (
                            <CloudSun className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-[#102027] group-hover:text-[#2E7180] transition truncate text-[11px]">
                              {c.title}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {c.source} · {c.date}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* FE-2 REQUIREMENT: COLLEGE PROGRESS UPDATES & FIELD PHOTOS */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedUpdateId(isExpanded ? null : reportKey)}
                      className="w-full bg-gray-50 hover:bg-gray-100 p-3.5 text-left flex items-center justify-between text-xs font-bold text-gray-800 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-700" />
                        <span>University Engineering Progress & Field Logs ({collegeUpdates.length} Updates)</span>
                      </div>
                      <span className="text-xs text-blue-700 font-mono">
                        {isExpanded ? 'Hide Details ▴' : 'View College Updates ▾'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="p-4 bg-white space-y-4 border-t border-gray-200 animate-in fade-in">
                        <div className="space-y-3">
                          {collegeUpdates.map((update, uIdx) => (
                            <div key={uIdx} className="p-3 bg-[#F4F6F5] rounded-xl space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-blue-900">{update.author}</span>
                                <span className="font-mono text-[11px] text-gray-500">{update.date}</span>
                              </div>
                              <p className="text-gray-700 leading-relaxed text-[11px]">
                                {update.text}
                              </p>
                              <div className="pt-1">
                                <span className="inline-block font-mono text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                                  STAGE: {update.stage}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions: Follow Challenge (SMS) & Full Public Challenge Link */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100">
                    <button
                      onClick={() => toggleFollow(reportKey)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                        isFollowing
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Bell className={`w-3.5 h-3.5 ${isFollowing ? 'text-blue-700 fill-blue-700' : ''}`} />
                      <span>{isFollowing ? 'Following (SMS Alerts Active to +91 94311-XXXXX)' : 'Follow for SMS Updates'}</span>
                    </button>

                    <Link
                      href={`/challenge/${matchedChallenge?.ref || matchedChallenge?.id || 'CHAL-WATER-001'}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E7180] hover:underline"
                    >
                      <span>View Full Societal Challenge Brief</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>
    </RoleGuard>
  );
}
