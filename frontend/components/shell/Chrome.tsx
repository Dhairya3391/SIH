"use client";

import React from "react";
import Link from "next/link";
import { AppBar } from "@/components/shell/AppBar";
import { GovStrip, Logo } from "@/components/shell/GovStrip";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth";

/**
 * Chrome for pages that a signed-out visitor is allowed to open — the report
 * form, above all. A citizen reporting a collapsed culvert gets the full bar
 * if they happen to be signed in, and a plain header with one sign-in link if
 * they are not. What they must never get is a locked door.
 */
export function Chrome() {
  const { isAuthenticated, loading } = useAuth();

  if (isAuthenticated) return <AppBar />;

  return (
    <>
      <GovStrip />
      <div className="bg-ground">
        <div className="shell flex h-[72px] items-center justify-between gap-4 lg:h-[78px]">
          <Logo href="/" />
          {!loading && (
            <Link
              href="/login"
              className="btn-2 btn-sm"
              aria-label="Sign in to JharSetu"
            >
              <Icon name="login" size={14} />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
