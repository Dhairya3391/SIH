'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Shield, 
  Users, 
  GraduationCap, 
  Building2, 
  FileText, 
  Radio, 
  CheckCircle2, 
  AlertTriangle,
  Flame,
  ChevronDown,
  Sparkles,
  Layers,
  BarChart3,
  Clock,
  HeartHandshake,
  Search,
  Eye,
  Sliders,
  Send
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@/types/database';

interface RoleNavConfig {
  roleName: string;
  personaLabel: string;
  badgeClass: string;
  links: { label: string; href: string; icon: React.ElementType }[];
}

const ROLE_NAV_MAP: Record<UserRole, RoleNavConfig> = {
  citizen: {
    roleName: 'Citizen',
    personaLabel: 'Sunita Soren (Gumla)',
    badgeClass: 'bg-emerald-500/15 text-emerald-800 border-emerald-300',
    links: [
      { label: 'Report Issue', href: '/report', icon: Send },
      { label: 'My Submissions', href: '/my-reports', icon: FileText },
      { label: 'Public Feed', href: '/', icon: Layers },
    ],
  },
  volunteer: {
    roleName: 'Field Verifier',
    personaLabel: 'Sanjay Kisku (Torpa Volunteer)',
    badgeClass: 'bg-amber-500/15 text-amber-800 border-amber-300',
    links: [
      { label: 'Verify Reports', href: '/verify', icon: CheckCircle2 },
      { label: 'Active Queue', href: '/queue', icon: Radio },
      { label: 'Public Feed', href: '/', icon: Layers },
    ],
  },
  university: {
    roleName: 'College / Faculty',
    personaLabel: 'Dr. A. Roy (BIT Mesra)',
    badgeClass: 'bg-blue-500/15 text-blue-800 border-blue-300',
    links: [
      { label: 'Campus R&D', href: '/college', icon: GraduationCap },
      { label: 'Problem Statements', href: '/college/problems', icon: Search },
      { label: 'Active Projects', href: '/college/projects', icon: Sliders },
      { label: 'Public Queue', href: '/queue', icon: Radio },
    ],
  },
  industry: {
    roleName: 'Industry / CSR / NGO',
    personaLabel: 'Tata Steel CSR Foundation',
    badgeClass: 'bg-purple-500/15 text-purple-800 border-purple-300',
    links: [
      { label: 'Resource Needs', href: '/needs', icon: HeartHandshake },
      { label: 'My Contributions', href: '/contributions', icon: FileText },
      { label: 'Public Queue', href: '/queue', icon: Radio },
    ],
  },
  coordinator: {
    roleName: 'District Coordinator',
    personaLabel: 'Amit Verma (Ranchi HQ)',
    badgeClass: 'bg-teal-500/15 text-teal-800 border-teal-300',
    links: [
      { label: 'Operations Queue', href: '/queue', icon: Radio },
      { label: 'Field Verifications', href: '/verify', icon: CheckCircle2 },
      { label: 'Resource Needs', href: '/needs', icon: HeartHandshake },
      { label: 'Public Portal', href: '/', icon: Layers },
    ],
  },
  admin: {
    roleName: 'State Admin',
    personaLabel: 'Govt. Secretariat (Dept. of Planning)',
    badgeClass: 'bg-rose-500/15 text-rose-800 border-rose-300',
    links: [
      { label: 'Admin Command', href: '/admin', icon: Shield },
      { label: 'SLA & Escalations', href: '/admin/sla', icon: Clock },
      { label: 'Ops Queue', href: '/queue', icon: Radio },
      { label: 'R&D Board', href: '/college', icon: GraduationCap },
    ],
  },
};

const ALL_ROLES: { role: UserRole; title: string; persona: string; description: string }[] = [
  { role: 'citizen', title: 'Citizen', persona: 'Sunita Soren', description: 'Submit voice/text reports & track status' },
  { role: 'volunteer', title: 'Verifier', persona: 'Sanjay Kisku', description: 'Field GPS verification & corroboration' },
  { role: 'university', title: 'College', persona: 'BIT Mesra / Dr. Roy', description: 'Adopt challenges & submit R&D proposals' },
  { role: 'industry', title: 'Industry / NGO', persona: 'Tata Steel CSR', description: 'Pledge funding, equipment & supplies' },
  { role: 'coordinator', title: 'Coordinator', persona: 'Ranchi District HQ', description: 'Triage, assign & orchestrate response' },
  { role: 'admin', title: 'State Admin', persona: 'Secretariat Officer', description: 'State telemetry, SLA rules & overrides' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, updateRole, loading } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const currentNav = ROLE_NAV_MAP[role] || ROLE_NAV_MAP.coordinator;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F5]">
      {/* Top Banner: Honest Demo Persona Bar */}
      <header className="sticky top-0 z-50 bg-[#102027] text-white shadow-md border-b border-[#2E7180]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            
            {/* Logo & Brand */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-[#2E7180] flex items-center justify-center font-bold text-white text-base shadow-sm group-hover:bg-[#3d8c9e] transition">
                  झ
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-base tracking-tight text-white">JharSetu</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-[#2E7180]/50 rounded text-teal-200 border border-teal-500/30">
                      Govt. of Jharkhand
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                    Societal Challenge Exchange
                  </span>
                </div>
              </Link>

              {/* Dynamic Role Navigation Links */}
              <nav className="hidden md:flex items-center gap-1 ml-4 pl-4 border-l border-gray-700/60">
                {currentNav.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        isActive
                          ? 'bg-[#2E7180] text-white shadow-sm'
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Side: Demo Persona Switcher */}
            <div className="flex items-center gap-3">
              {/* Persona Pill Button */}
              <div className="relative">
                <button
                  onClick={() => setSwitcherOpen(!switcherOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium transition cursor-pointer"
                  title="Click to simulate different user personas"
                >
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-teal-300 font-mono font-semibold uppercase">
                      Demo Persona: {currentNav.roleName}
                    </span>
                    <span className="text-xs text-gray-200 max-w-[130px] sm:max-w-[180px] truncate">
                      {currentNav.personaLabel}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {switcherOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setSwitcherOpen(false)} 
                    />
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-[#102027] rounded-xl shadow-2xl border border-[#CCD1C7] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-3.5 bg-[#F4F6F5] border-b border-[#CCD1C7]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono uppercase text-[#2E7180]">
                            Simulate Persona (Demo Mode)
                          </span>
                          <span className="text-[10px] bg-[#2E7180]/15 text-[#2E7180] font-mono px-2 py-0.5 rounded font-bold">
                            FE-1 Role-Aware
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600 mt-1">
                          Switch personas to instantly see how navigation, permissions, and dashboards adapt.
                        </p>
                      </div>

                      <div className="p-2 space-y-1 max-h-[380px] overflow-y-auto">
                        {ALL_ROLES.map((r) => {
                          const isCurrent = r.role === role;
                          return (
                            <button
                              key={r.role}
                              onClick={async () => {
                                setSwitcherOpen(false);
                                await updateRole(r.role);
                              }}
                              className={`w-full text-left p-2.5 rounded-lg transition flex items-start gap-3 cursor-pointer ${
                                isCurrent
                                  ? 'bg-[#2E7180]/10 border border-[#2E7180]/30'
                                  : 'hover:bg-gray-100 border border-transparent'
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs ${
                                isCurrent ? 'bg-[#2E7180] text-white' : 'bg-gray-200 text-gray-700'
                              }`}>
                                {r.title[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-[#102027]">
                                    {r.title}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[10px] font-mono font-bold text-[#2E7180] flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Active
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-medium text-[#2E7180]">
                                  {r.persona}
                                </div>
                                <div className="text-[11px] text-gray-500 truncate">
                                  {r.description}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="md:hidden flex items-center gap-1 px-4 py-2 bg-[#102027]/90 border-t border-gray-800 overflow-x-auto">
          {currentNav.links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap font-medium transition ${
                  isActive
                    ? 'bg-[#2E7180] text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#CCD1C7] py-6 text-center text-xs text-gray-500 space-y-1">
        <div>
          <strong>JharSetu Societal Challenge Exchange</strong> · Government of Jharkhand
        </div>
        <div className="text-[11px] text-gray-400 font-mono">
          Decentralized Community Feedback, University Capstone Matching, and CSR Co-Funding Ledger
        </div>
      </footer>
    </div>
  );
}
