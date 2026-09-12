'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Radio,
  ShieldCheck,
  Siren,
  UserRound,
} from 'lucide-react';
import { useAuth, ROLE_HOME } from '@/lib/auth';
import { UserRole } from '@/types/database';

/**
 * Every role signs in here. Six accounts, six different products behind one
 * door - the role on the account decides which console you land on, not a
 * dropdown you can change afterwards.
 *
 * The demo tiles below the form are a convenience for the stage, clearly
 * labelled as such. They use the same real Supabase session as the form does;
 * they are not a pretend role flag.
 */

const ROLE_TILES: {
  role: UserRole;
  label: string;
  who: string;
  email: string;
  Icon: typeof UserRound;
}[] = [
  {
    role: 'citizen',
    label: 'Citizen',
    who: 'Report a problem in your village and follow what happens to it',
    email: 'citizen@jharsetu.demo',
    Icon: UserRound,
  },
  {
    role: 'volunteer',
    label: 'Verifier',
    who: 'Confirm reports with field photos, news and weather evidence',
    email: 'volunteer@jharsetu.demo',
    Icon: ShieldCheck,
  },
  {
    role: 'coordinator',
    label: 'District Officer',
    who: 'Triage the ranked queue, approve briefs, run drills',
    email: 'coordinator@jharsetu.demo',
    Icon: Siren,
  },
  {
    role: 'university',
    label: 'College',
    who: 'Browse verified problems and submit a solution proposal',
    email: 'university@jharsetu.demo',
    Icon: GraduationCap,
  },
  {
    role: 'industry',
    label: 'Company / NGO',
    who: 'Fund and supply the materials a college needs',
    email: 'industry@jharsetu.demo',
    Icon: Building2,
  },
  {
    role: 'admin',
    label: 'System Owner',
    who: 'Full access to every record, timing and metric',
    email: 'admin@jharsetu.demo',
    Icon: Radio,
  },
];

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get('next');
  const { signIn, demoSignIn, isAuthenticated, role, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Already signed in? Do not show a login form - send them where they belong.
  useEffect(() => {
    if (!loading && isAuthenticated && role) {
      router.replace(nextPath || ROLE_HOME[role] || '/overview');
    }
  }, [loading, isAuthenticated, role, router, nextPath]);

  const land = (r: UserRole) => router.replace(nextPath || ROLE_HOME[r] || '/overview');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy('form');
    try {
      const u = await signIn(email, password);
      land(u.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(null);
    }
  };

  const onDemo = async (r: UserRole) => {
    setError('');
    setBusy(r);
    try {
      const u = await demoSignIn(r);
      land(u.role);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Demo sign-in failed. DEMO_PASSWORD may not be set on this deployment.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F5] flex flex-col">
      {/* masthead */}
      <header className="border-b border-[#CCD1C7] bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#102027] text-white flex items-center justify-center font-bold text-sm shrink-0">
            JS
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[#102027] leading-tight">JharSetu</div>
            <div className="font-mono text-[10px] tracking-wider text-gray-500 uppercase">
              Government of Jharkhand · SIH26043
            </div>
          </div>
          <div className="flex-1" />
          <Link
            href="/overview"
            className="text-xs font-semibold text-[#2E7180] hover:underline whitespace-nowrap"
          >
            What is this?
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-6 py-8 sm:py-12">
        <div className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-8 lg:gap-12">
          {/* ── the real form ── */}
          <section>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102027] tracking-tight leading-tight">
              Sign in
            </h1>
            <p className="text-sm text-gray-600 mt-2 mb-6 leading-relaxed">
              Your account decides what you see. A college cannot read another
              college&apos;s proposal, and a citizen cannot approve a brief.
            </p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1.5"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.ac.in"
                    className="w-full h-12 pl-10 pr-3 rounded-xl border border-[#CCD1C7] bg-white text-sm outline-none focus:border-[#2E7180] focus:ring-2 focus:ring-[#2E7180]/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block font-mono text-[10px] tracking-wider uppercase text-gray-500 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-10 pr-3 rounded-xl border border-[#CCD1C7] bg-white text-sm outline-none focus:border-[#2E7180] focus:ring-2 focus:ring-[#2E7180]/20"
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 text-xs text-[#A8332A] bg-red-50 border border-red-200 rounded-xl p-3"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy !== null}
                className="w-full h-12 rounded-xl bg-[#102027] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#1D3540] disabled:opacity-60 transition"
              >
                {busy === 'form' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
              No account? Accounts are created by the system owner — a college,
              company or NGO is registered as an organisation first, then its
              members are invited.
            </p>
          </section>

          {/* ── demo access ── */}
          <section>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-mono text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded bg-[#E5A83B]/20 text-[#8A5A00]">
                Demo access
              </span>
              <h2 className="text-base font-bold text-[#102027]">
                Sign in as any role, one click
              </h2>
            </div>
            <p className="text-xs text-gray-600 mb-5 max-w-xl leading-relaxed">
              These are six real seeded accounts, not a role switch — each one
              gets a genuine session, so the access rules you see are the ones
              that actually apply. Intended for evaluation and for the demo.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              {ROLE_TILES.map(({ role: r, label, who, email: demoEmail, Icon }) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onDemo(r)}
                  disabled={busy !== null}
                  className="text-left bg-white border border-[#CCD1C7] rounded-xl p-4 hover:border-[#2E7180] hover:shadow-sm disabled:opacity-60 transition group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#F4F6F5] border border-[#CCD1C7] flex items-center justify-center shrink-0 group-hover:border-[#2E7180]">
                      {busy === r ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#2E7180]" />
                      ) : (
                        <Icon className="w-4 h-4 text-[#2E7180]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-[#102027] flex items-center gap-1.5">
                        {label}
                        <ArrowRight className="w-3 h-3 text-[#2E7180] opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <div className="text-[11px] text-gray-600 leading-snug mt-0.5">
                        {who}
                      </div>
                      <div className="font-mono text-[10px] text-gray-400 mt-1.5 truncate">
                        {demoEmail}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-[#CCD1C7] bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 font-mono text-[10px] text-gray-500 flex flex-wrap gap-x-5 gap-y-1">
          <span>JharSetu · SIH26043 · Disaster Management</span>
          <span>Sessions are first-party and role-scoped</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary, because the ?next= redirect is
 * read on the client while the shell prerenders.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F4F6F5] flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#2E7180]" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
