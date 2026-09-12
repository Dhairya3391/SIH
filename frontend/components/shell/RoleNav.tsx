'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Shield, 
  MapPin, 
  Flame, 
  Radio, 
  User, 
  Users, 
  Building2, 
  GraduationCap, 
  FileText, 
  ClipboardCheck, 
  Clock, 
  HeartHandshake, 
  Settings, 
  ChevronRight,
  PhoneCall,
  LayoutDashboard,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { useAuth, ROLE_HOME } from '@/lib/auth';
import { UserRole } from '@/types/database';

interface RoleNavProps {
  isCrisisMode?: boolean;
  onToggleCrisisMode?: () => void;
  selectedRegion?: string;
  onSelectRegion?: (region: string) => void;
}

export function RoleNav({
  isCrisisMode = false,
  onToggleCrisisMode,
  selectedRegion = 'jharkhand',
  onSelectRegion,
}: RoleNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { role: activeRole, user, organisation, demoSignIn, signOut } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);

  const roleDefaultRoutes = ROLE_HOME;

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleRoleSwitch = async (newRole: UserRole) => {
    setIsSwitching(true);
    try {
      await demoSignIn(newRole);
      // Navigate to the target role console
      router.push(roleDefaultRoutes[newRole]);
    } finally {
      setIsSwitching(false);
    }
  };

  // Nav links per role
  const getNavLinks = () => {
    switch (activeRole) {
      case 'citizen':
        return [
          { href: '/my-reports', label: 'My Ground Reports', icon: FileText },
          { href: '/report', label: 'Report a Need', icon: PhoneCall },
          { href: '/overview', label: 'All Challenges', icon: Eye },
        ];
      case 'volunteer':
        return [
          { href: '/verify', label: 'Verification Queue', icon: ClipboardCheck },
          { href: '/overview', label: 'All Challenges', icon: Eye },
        ];
      case 'university':
        return [
          { href: '/college', label: 'Console Overview', icon: LayoutDashboard },
          { href: '/college/problems', label: 'Browse Problems', icon: FileText },
          { href: '/college/projects', label: 'My R&D Projects', icon: GraduationCap },
          { href: '/overview', label: 'All Challenges', icon: Eye },
        ];
      case 'industry':
        return [
          { href: '/needs', label: 'Needs Marketplace', icon: HeartHandshake },
          { href: '/contributions', label: 'My Contributions', icon: Building2 },
          { href: '/overview', label: 'All Challenges', icon: Eye },
        ];
      case 'coordinator':
        return [
          { href: '/queue', label: 'Grievance & Triage Queue', icon: ClipboardCheck },
          { href: '/overview', label: 'Challenge Directory', icon: Eye },
        ];
      case 'admin':
        return [
          { href: '/admin', label: 'Command Center & Narrator', icon: Shield },
          { href: '/admin/sla', label: 'SLA Metrics & Timelines', icon: Clock },
          { href: '/overview', label: 'Full System Ledger', icon: Eye },
        ];
      default:
        return [
          { href: '/overview', label: 'Challenge Directory', icon: Eye },
        ];
    }
  };

  const roleLabelMap: Record<UserRole, string> = {
    citizen: 'Citizen (Villager)',
    volunteer: 'Verifier / Field Volunteer',
    verifier: 'Verifier Desk',
    university: 'College / University',
    industry: 'Company / NGO (CSR)',
    coordinator: 'District Coordinator',
    admin: 'System Owner / Admin',
  };

  const links = getNavLinks();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#CCD1C7] shadow-xs">
      {/* 1. HONEST DEMO SWITCHER BAR */}
      <div className="bg-[#102027] text-white px-3 py-1.5 text-xs border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#2E7180] text-white px-2 py-0.5 rounded font-mono font-bold tracking-wider text-[11px]">
              DEMO SWITCHER
            </span>
            <span className="text-gray-300 hidden md:inline text-[11px]">
              Simulated 1-Click Role Access for Evaluation:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {(['citizen', 'volunteer', 'university', 'industry', 'coordinator', 'admin'] as UserRole[]).map((r) => {
              const isActive = activeRole === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleSwitch(r)}
                  disabled={isSwitching}
                  className={`px-2.5 py-1 rounded text-xs capitalize transition-all font-mono font-medium cursor-pointer ${
                    isActive
                      ? 'bg-[#2E7180] text-white font-bold ring-1 ring-white/30 shadow-xs'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {r === 'volunteer' ? 'Verifier' : r === 'university' ? 'College' : r === 'industry' ? 'Company/NGO' : r}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. CRISIS BANNER IF TRIGGERED */}
      {isCrisisMode && (
        <div className="bg-[#D94F45] text-white px-4 py-2 border-b border-red-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <Flame className="w-4 h-4 animate-pulse shrink-0" />
            <span className="font-bold uppercase tracking-wider">
              CRISIS MODE ACTIVE · SAHEBGANJ FLOOD DRILL · RAPID ESCALATION ROUTING ENGAGED
            </span>
          </div>
          {onToggleCrisisMode && (
            <button
              type="button"
              onClick={onToggleCrisisMode}
              className="px-2.5 py-1 bg-white text-[#D94F45] font-bold rounded text-[11px] shrink-0 hover:bg-gray-100"
            >
              Exit Crisis
            </button>
          )}
        </div>
      )}

      {/* 3. MAIN APP HEADER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand identity with Sohrai motif */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-[#2E7180] text-white font-bold flex items-center justify-center text-lg shadow-sm group-hover:bg-[#245A66] transition">
              JS
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-[#102027]">JharSetu</span>
                <span className="text-[10px] bg-[#CCD1C7]/40 text-[#102027] px-1.5 py-0.5 rounded font-mono font-medium">
                  झारसेतु
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium leading-none">
                Govt. of Jharkhand Societal Challenge Exchange
              </p>
            </div>
          </Link>

          {/* Current Role Badge */}
          <div className="hidden sm:flex items-center gap-1 pl-3 border-l border-[#CCD1C7]">
            <span className="text-[10px] font-mono text-gray-400 uppercase">Role:</span>
            <span className="text-xs font-mono font-bold text-[#2E7180] bg-[#2E7180]/10 px-2 py-0.5 rounded border border-[#2E7180]/20">
              {activeRole ? roleLabelMap[activeRole] : 'Signed out'}
            </span>
          </div>
        </div>

        {/* Right side controls: Region & Drill & Primary Action */}
        <div className="flex items-center flex-wrap gap-2">
          {onSelectRegion && (
            <div className="flex items-center bg-[#F4F6F5] px-2 py-1 rounded-lg border border-[#CCD1C7] text-xs font-mono">
              <MapPin className="w-3.5 h-3.5 text-[#2E7180] mr-1" />
              <select
                value={selectedRegion}
                onChange={(e) => onSelectRegion(e.target.value)}
                className="bg-transparent font-semibold outline-none cursor-pointer text-[#102027]"
              >
                <option value="jharkhand">Jharkhand (24 Districts)</option>
                <option value="rajkot">Rajkot Pilot Zone</option>
              </select>
            </div>
          )}

          {onToggleCrisisMode && (
            <button
              type="button"
              onClick={onToggleCrisisMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                isCrisisMode
                  ? 'bg-[#D94F45] text-white'
                  : 'bg-white border border-[#D94F45] text-[#D94F45] hover:bg-red-50'
              }`}
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {isCrisisMode ? 'Drill Active' : 'Crisis Drill'}
            </button>
          )}

          {/* Quick primary action button */}
          {activeRole === 'citizen' && (
            <Link
              href="/report"
              className="touch-target px-3 py-1.5 rounded-lg bg-[#2E7180] hover:bg-[#245A66] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Report Need</span>
            </Link>
          )}
        </div>
      </div>

      {/* 4. ROLE CONSOLE NAVIGATION TABS */}
      <nav className="bg-[#F4F6F5] border-t border-[#CCD1C7]/70 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-1">
          <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider font-bold mr-2 hidden sm:inline">
            Console Nav:
          </span>
          {links.map((link) => {
            const Icon = link.icon;
            const isCurrent = pathname === link.href || (link.href !== '/' && link.href !== '/overview' && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`touch-target px-3 py-1.5 rounded-md text-xs font-semibold font-mono flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  isCurrent
                    ? 'bg-white text-[#2E7180] border border-[#CCD1C7] shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-[#102027] hover:bg-white/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-[#2E7180]' : 'text-gray-400'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
