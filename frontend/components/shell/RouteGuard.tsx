"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppBar } from "@/components/shell/AppBar";
import { GovStrip, Logo } from "@/components/shell/GovStrip";
import { Skeleton } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth";
import { ROLE_HOME, ROLE_PURPOSE, rolesFor } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/format";
import type { UserRole } from "@/types/database";

/**
 * Wraps every signed-in console. Three jobs:
 *
 *  1. Wait for the session probe before rendering anything. Rendering a
 *     console first and redirecting after is how a wrong-role user gets a
 *     flash of data they should not see.
 *  2. Send a signed-out visitor to /login, remembering where they wanted to go.
 *  3. Tell a signed-in user with the wrong role which account this console
 *     needs, instead of bouncing them somewhere with no explanation.
 *
 * This is navigation, not security. Every API call is authorised again
 * server-side; the guard only decides what is worth drawing.
 */
export function RouteGuard({
  roles,
  children,
}: {
  /** Override the map in lib/nav.ts. Rarely needed. */
  roles?: UserRole[];
  children: React.ReactNode;
}) {
  const { role, loading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const allowed = roles ?? rolesFor(pathname) ?? [];

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, isAuthenticated, pathname, router]);

  if (loading) return <BootScreen />;

  if (!isAuthenticated) {
    // The redirect above is in flight. Show the frame, not a console.
    return <BootScreen />;
  }

  if (allowed.length > 0 && role && !allowed.includes(role)) {
    return <WrongConsole role={role} allowed={allowed} />;
  }

  return (
    <>
      <AppBar />
      {children}
    </>
  );
}

function BootScreen() {
  return (
    <>
      <GovStrip />
      <div className="shell flex h-[78px] items-center">
        <Logo href={null} />
      </div>
      <div className="shell flex flex-col gap-6 pt-8" role="status" aria-label="Loading">
        <Skeleton height={30} rounded={8} className="max-w-[220px]" />
        <Skeleton height={54} rounded={12} className="max-w-[560px]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={104} rounded={18} />
          ))}
        </div>
        <Skeleton height={260} rounded={18} />
        <span className="sr-only">Checking your session</span>
      </div>
    </>
  );
}

function WrongConsole({ role, allowed }: { role: UserRole; allowed: UserRole[] }) {
  return (
    <>
      <AppBar />
      <main className="shell pt-10 pb-20">
        <div className="up mx-auto max-w-[640px] p-7 text-center">
          <div className="up-s mx-auto grid h-12 w-12 place-items-center text-mute">
            <Icon name="shield" size={20} />
          </div>
          <h1 className="mt-5 text-[24px] font-extrabold text-navy-dark">
            This console is not for your account
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-body">
            You are signed in as{" "}
            <strong className="text-ink">{ROLE_LABEL[role]}</strong>. This screen belongs to{" "}
            {allowed.map((r, i) => (
              <React.Fragment key={r}>
                {i > 0 && (i === allowed.length - 1 ? " or " : ", ")}
                <strong className="text-ink">{ROLE_LABEL[r]}</strong>
              </React.Fragment>
            ))}
            .
          </p>
          <div className="in mt-6 p-4 text-left">
            <p className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
              What your role does here
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-body">{ROLE_PURPOSE[role]}</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href={ROLE_HOME[role]} variant="primary" iconAfter="arrow">
              Go to my console
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" icon="login">
              Sign in as someone else
            </ButtonLink>
          </div>
        </div>
      </main>
    </>
  );
}
