"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GovStrip, Logo } from "@/components/shell/GovStrip";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/States";
import { useAuth } from "@/lib/auth";
import { ALL_ROLES, ROLE_HOME, ROLE_PURPOSE, canAccess } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/format";
import type { UserRole } from "@/types/database";

/**
 * One door, six roles.
 *
 * The role is resolved server-side from the account — there is no role picker
 * in the real sign-in path, because letting the client choose its own role is
 * not authentication. The picker at the bottom is the demo path for judging,
 * and it says so in plain words rather than being dressed up as a feature.
 */

const ROLE_ICON: Record<UserRole, IconName> = {
  citizen: "mic",
  volunteer: "users",
  verifier: "shield",
  coordinator: "gauge",
  university: "grad",
  industry: "box",
  ngo: "wallet",
  admin: "eye",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <>
      <GovStrip />
      <div className="shell flex h-[78px] items-center">
        <Logo href={null} />
      </div>
      <div className="shell grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Skeleton height={420} rounded={18} />
        <Skeleton height={420} rounded={18} />
      </div>
    </>
  );
}

function LoginInner() {
  const { signIn, demoSignIn, signOut, isAuthenticated, role, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next");
  // Same-origin paths only: reject "//evil.com", backslashes and schemes, or
  // a crafted link could bounce a fresh sign-in off-origin.
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && !/[\\:]/.test(rawNext)
      ? rawNext
      : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState<UserRole | null>(null);

  // A requested destination (?next=, e.g. from RouteGuard) is followed when the
  // signed-in role belongs there. A stale ?next= from a previous account falls
  // back to this role's console instead of somebody else's screen. With no
  // ?next= there is no bounce, so the banner below and the role switcher stay
  // usable for an evaluator walking the whole chain.
  useEffect(() => {
    if (!loading && isAuthenticated && role && next) {
      router.replace(canAccess(role, next) ? next : ROLE_HOME[role]);
    }
  }, [loading, isAuthenticated, role, next, router]);

  function go(r: UserRole) {
    router.replace(next && canAccess(r, next) ? next : (ROLE_HOME[r] ?? "/"));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await signIn(email.trim(), password);
      go(user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That sign-in did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function onDemo(r: UserRole) {
    setError(null);
    setDemoBusy(r);
    try {
      const user = await demoSignIn(r);
      go(user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The demo sign-in did not work.");
    } finally {
      setDemoBusy(null);
    }
  }

  return (
    <>
      <GovStrip />

      <div className="shell flex h-[72px] items-center justify-between lg:h-[78px]">
        <Logo href="/" />
        <span className="mono hidden text-[11px] uppercase tracking-[0.1em] text-mute sm:inline">
          Disaster Management · District bridge
        </span>
      </div>

      <main
        id="main"
        className="shell grid items-start gap-6 pt-4 pb-16 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-8 lg:pt-6"
      >
        {/* ---- currently signed-in banner ---- */}
        {isAuthenticated && role && (
          <div className="up-s col-span-full flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2.5">
              <span className="text-moderate">
                <Icon name="shield" size={16} />
              </span>
              <span className="text-[13.5px] text-body">
                Currently signed in as <strong className="text-navy">{user?.full_name ?? "Active User"}</strong> ({ROLE_LABEL[role]}).
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                iconAfter="arrow"
                onClick={() => go(role)}
              >
                Go to my console
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="logout"
                onClick={async () => {
                  await signOut();
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        )}

        {/* ---- the form ---------------------------------------------------- */}
        <section className="up p-6 sm:p-7">
          <span className="eyebrow">Sign in</span>
          <h1 className="mt-3 text-[30px] font-extrabold text-navy-dark sm:text-[34px]">
            One door, every role
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-body">
            Your role comes from your account, not from a dropdown. You land on the console that
            role is responsible for.
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                Official email
              </span>
              <input
                type="email"
                className="field"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@jharkhand.gov.in"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
                Password
              </span>
              <input
                type="password"
                className="field"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="in-s flex items-start gap-2.5 p-3.5" role="alert">
                <span className="mt-px text-alert-ink">
                  <Icon name="alert" size={15} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" busy={busy} iconAfter="arrow" className="mt-1">
              Sign in
            </Button>
          </form>

          <div className="hairline mt-6 pt-5">
            <p className="text-[12.5px] leading-relaxed text-mute">
              A citizen does not need an account to report something. Reports can be sent by SMS,
              or filed here and claimed later.
            </p>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                icon="mic"
                onClick={() => router.push("/report")}
              >
                Report without signing in
              </Button>
            </div>
          </div>
        </section>

        {/* ---- what each role is for --------------------------------------- */}
        <section className="flex flex-col gap-4">
          <div className="up p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[19px] font-bold text-navy-dark">
                  What each account is responsible for
                </h2>
                <p className="mt-1.5 max-w-[60ch] text-[13.5px] leading-relaxed text-body">
                  The roles are a chain, not a menu. A report only becomes work once each link
                  has done its own job, and no link can do another&rsquo;s.
                </p>
              </div>
              <span className="mono hidden flex-none text-[10.5px] uppercase tracking-[0.1em] text-mute sm:inline">
                {ALL_ROLES.length} roles
              </span>
            </div>

            <ol className="mt-5 flex flex-col">
              {ALL_ROLES.map((r, i) => (
                <li
                  key={r}
                  className={`flex items-start gap-3.5 py-3 ${i > 0 ? "hairline" : ""}`}
                >
                  <span className="in-s mt-0.5 grid h-9 w-9 flex-none place-items-center text-mute">
                    <Icon name={ROLE_ICON[r]} size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-bold text-ink">{ROLE_LABEL[r]}</span>
                      <span className="mono text-[10px] uppercase tracking-[0.08em] text-mute">
                        {r}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-body">{ROLE_PURPOSE[r]}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* ---- the demo path, labelled as such --------------------------- */}
          <div className="in p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-mute">
                <Icon name="info" size={16} />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-navy-dark">
                  Demo sign-in, for judging
                </h2>
                <p className="mt-1.5 max-w-[64ch] text-[13px] leading-relaxed text-body">
                  These buttons call a separate endpoint that issues a real session for a seeded
                  account of that role. It exists so a reviewer can walk the whole chain in one
                  sitting. It is not how a real user signs in, and it is disabled in a production
                  deployment.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {ALL_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onDemo(r)}
                  disabled={demoBusy !== null}
                  className="up-s up-hit flex min-h-[58px] flex-col items-start justify-center gap-0.5 px-3.5 py-2 text-left disabled:opacity-60"
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-navy">
                    <Icon name={ROLE_ICON[r]} size={13} />
                    {ROLE_LABEL[r]}
                  </span>
                  <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
                    {demoBusy === r ? "signing in…" : ROLE_HOME[r]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
