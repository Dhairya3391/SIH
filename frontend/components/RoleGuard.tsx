'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowRight, Home, RefreshCw, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@/types/database';
import { SkeletonLoader } from './SkeletonLoader';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  title?: string;
  description?: string;
  children: React.ReactNode;
}

const ROLE_DISPLAY_MAP: Record<UserRole, { label: string; badgeColor: string; consoleUrl: string }> = {
  citizen: {
    label: 'Citizen / Community Reporter',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    consoleUrl: '/report',
  },
  volunteer: {
    label: 'Volunteer / Field Verifier',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    consoleUrl: '/verify',
  },
  university: {
    label: 'University / R&D Faculty',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    consoleUrl: '/college',
  },
  industry: {
    label: 'Industry / CSR Partner / NGO',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    consoleUrl: '/needs',
  },
  coordinator: {
    label: 'District Operations Coordinator',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    consoleUrl: '/queue',
  },
  admin: {
    label: 'State Administrator',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    consoleUrl: '/admin',
  },
};

export function RoleGuard({ allowedRoles, title, description, children }: RoleGuardProps) {
  const { role, user, loading, updateRole } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <SkeletonLoader className="h-10 w-64 mx-auto" />
        <SkeletonLoader className="h-40 w-full" />
        <SkeletonLoader className="h-60 w-full" />
      </div>
    );
  }

  const isAllowed = allowedRoles.includes(role);

  if (!isAllowed) {
    const currentRoleMeta = ROLE_DISPLAY_MAP[role] || {
      label: role,
      badgeColor: 'bg-gray-100 text-gray-800 border-gray-300',
      consoleUrl: '/',
    };

    const targetRole = allowedRoles[0];
    const targetRoleMeta = ROLE_DISPLAY_MAP[targetRole];

    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-xl w-full bg-white rounded-2xl border border-[#CCD1C7] shadow-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-amber-700">
                Access Restricted · Role Guard
              </div>
              <h1 className="text-xl font-bold text-[#102027]">
                {title || 'Restricted Console'}
              </h1>
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">
            {description || 'This console contains privileged workflows restricted to specific administrative or institutional roles.'}
          </p>

          <div className="bg-[#F4F6F5] rounded-xl p-4 border border-[#CCD1C7] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Your Active Persona:</span>
              <span className={`px-2.5 py-1 rounded-full font-semibold border ${currentRoleMeta.badgeColor}`}>
                {currentRoleMeta.label}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200/60">
              <span className="text-gray-500 font-medium">Required Persona:</span>
              <span className="font-semibold text-gray-800">
                {allowedRoles.map(r => ROLE_DISPLAY_MAP[r]?.label.split('/')[0].trim()).join(' or ')}
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-xs font-mono uppercase tracking-wider text-gray-500 font-semibold">
              Fast Demo Switcher (Simulate Persona):
            </div>
            {targetRole && (
              <button
                onClick={async () => {
                  await updateRole(targetRole);
                  router.refresh();
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#2E7180] text-white hover:bg-[#235864] transition rounded-xl font-semibold text-sm shadow-sm cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  <span>Switch Persona to {targetRoleMeta.label.split('/')[0].trim()}</span>
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Link
                href={currentRoleMeta.consoleUrl}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-medium text-xs border border-gray-200 transition"
              >
                <span>Go to My Console</span>
              </Link>
              <Link
                href="/"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium text-xs border border-[#CCD1C7] transition"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Public Overview</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
