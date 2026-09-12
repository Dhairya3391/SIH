'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@/types/database';
import { Loader2, ArrowRight, Shield, FileText, ClipboardCheck, GraduationCap, Building2 } from 'lucide-react';

const roleConsoleMap: Record<UserRole, { path: string; label: string; icon: any }> = {
  citizen: { path: '/my-reports', label: 'Citizen Console (Ground Reports)', icon: FileText },
  volunteer: { path: '/verify', label: 'Verifier Console (Field Verification)', icon: ClipboardCheck },
  university: { path: '/college', label: 'College Console (R&D & Proposals)', icon: GraduationCap },
  industry: { path: '/needs', label: 'Company/NGO Console (Needs & CSR)', icon: Building2 },
  coordinator: { path: '/queue', label: 'District Coordinator Console (Triage)', icon: ClipboardCheck },
  admin: { path: '/admin', label: 'System Admin Console (Narrator & SLA)', icon: Shield },
};

export default function RootRedirectPage() {
  const router = useRouter();
  const { role: activeRole, loading } = useAuth();

  useEffect(() => {
    if (!loading && activeRole) {
      const target = roleConsoleMap[activeRole]?.path || '/overview';
      router.replace(target);
    }
  }, [activeRole, loading, router]);

  return (
    <div className="min-h-screen bg-[#F4F6F5] text-[#102027] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-[#CCD1C7] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-[#2E7180] text-white font-bold flex items-center justify-center text-2xl shadow-sm">
            JS
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[#102027]">JharSetu</h1>
            <p className="text-xs text-gray-500 font-mono">झारसेतु · SIH26043</p>
          </div>
        </div>

        {/* Redirect status */}
        <div className="p-4 bg-[#F4F6F5] rounded-xl border border-[#CCD1C7] text-xs font-mono space-y-2">
          <div className="flex items-center justify-center gap-2 text-[#2E7180] font-bold">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting to your {activeRole} console...</span>
          </div>
          <p className="text-[11px] text-gray-500">
            Authenticated role: <strong className="text-gray-800 capitalize">{activeRole}</strong>
          </p>
        </div>

        {/* Quick Directory Fallback */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <span className="text-[10px] font-mono uppercase text-gray-400 font-bold block">
            Or Jump Directly to Any Console:
          </span>
          <div className="grid grid-cols-1 gap-1.5 text-left text-xs font-mono">
            {Object.entries(roleConsoleMap).map(([roleKey, item]) => {
              const Icon = item.icon;
              return (
                <Link
                  key={roleKey}
                  href={item.path}
                  className="px-3 py-2 rounded-lg border border-[#CCD1C7]/60 hover:border-[#2E7180] hover:bg-teal-50/50 flex items-center justify-between text-gray-700 hover:text-[#2E7180] transition"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                    {item.label}
                  </span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="pt-1">
          <Link
            href="/overview"
            className="text-xs font-mono font-bold text-[#2E7180] hover:underline"
          >
            Explore Public Statewide Catalog →
          </Link>
        </div>
      </div>
    </div>
  );
}
