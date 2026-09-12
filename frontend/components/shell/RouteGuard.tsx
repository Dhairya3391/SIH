'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@/types/database';
import { RoleNav } from './RoleNav';

interface RouteGuardProps {
  allowedRoles: UserRole[];
  consoleTitle: string;
  children: React.ReactNode;
}

const roleDescriptions: Record<UserRole, string> = {
  citizen: 'Citizen / Villager reporting local emergencies and tracking ground community resolution',
  volunteer: 'Field Volunteer & Official Verifier verifying reports with photographic and meteorological evidence',
  university: 'University / College R&D lab submitting engineering proposals and piloting solutions',
  industry: 'Company / NGO CSR partner funding and dispatching material needs',
  coordinator: 'District Officer reviewing triage queues and approving pilots',
  admin: 'System Owner overseeing end-to-end SLA timings, ledger integrity, and statewide operations',
};

const roleConsoleMap: Record<UserRole, string> = {
  citizen: '/my-reports',
  volunteer: '/verify',
  university: '/college',
  industry: '/needs',
  coordinator: '/queue',
  admin: '/admin',
};

export function RouteGuard({
  allowedRoles,
  consoleTitle,
  children,
}: RouteGuardProps) {
  const { role: activeRole, updateRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
        <RoleNav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center font-mono text-xs text-gray-500 space-y-2">
            <div className="w-8 h-8 border-2 border-[#2E7180] border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Verifying role credentials and permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  // If role is authorized, render children
  if (allowedRoles.includes(activeRole)) {
    return <>{children}</>;
  }

  // Otherwise, render honest, helpful refusal screen
  const primaryAllowed = allowedRoles[0];

  return (
    <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col">
      <RoleNav />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg bg-white border-2 border-amber-300 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
          {/* Header icon */}
          <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
            <ShieldAlert className="w-6 h-6 text-amber-700" />
          </div>

          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Role Access Restricted
            </span>
            <h2 className="text-xl font-extrabold text-[#102027] mt-2">
              {consoleTitle} requires authorization
            </h2>
          </div>

          <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
            <p>
              You are currently viewing JharSetu as a{' '}
              <strong className="text-[#102027] capitalize font-bold font-mono">
                {activeRole === 'volunteer' ? 'Verifier' : activeRole}
              </strong>{' '}
              ({roleDescriptions[activeRole]}).
            </p>

            <div className="p-3 bg-[#F4F6F5] rounded-lg border border-[#CCD1C7] text-gray-700 font-mono text-[11px]">
              This console requires one of the following roles:{' '}
              <strong className="text-[#2E7180]">
                {allowedRoles.map((r) => (r === 'volunteer' ? 'Verifier' : r)).join(', ')}
              </strong>
            </div>

            <p>
              In production, permissions are enforced cryptographically via Supabase Row-Level Security (RLS) and auth tokens.
              In this evaluation demo, you can instantly switch your role using the button below.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              onClick={() => updateRole(primaryAllowed)}
              className="touch-target px-4 py-2.5 bg-[#2E7180] hover:bg-[#245A66] text-white text-xs font-bold font-mono rounded-lg flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              Switch to {primaryAllowed === 'volunteer' ? 'Verifier' : primaryAllowed} (Demo)
            </button>

            <Link
              href={roleConsoleMap[activeRole] || '/'}
              className="touch-target px-4 py-2.5 bg-white border border-[#CCD1C7] hover:bg-gray-50 text-gray-700 text-xs font-bold font-mono rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to My Console
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
