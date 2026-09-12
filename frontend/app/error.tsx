"use client";

import React from "react";
import Link from "next/link";
import { GovStrip, Logo } from "@/components/shell/GovStrip";
import { Icon } from "@/components/ui/Icon";

/**
 * The last resort. Shows the actual error message rather than a friendly lie —
 * this is an internal government tool, and an officer who can read "failed to
 * fetch" knows to check their connection instead of filing a support ticket.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <GovStrip />
      <div className="shell flex h-[78px] items-center">
        <Logo href="/" />
      </div>
      <main className="shell pt-10 pb-20">
        <div className="up mx-auto max-w-[620px] p-7">
          <div className="flex items-start gap-3.5">
            <span className="up-s grid h-11 w-11 flex-none place-items-center text-alert-ink">
              <Icon name="alert" size={19} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold text-navy-dark">
                This screen stopped working
              </h1>
              <p className="mt-2.5 text-[14px] leading-relaxed text-body">
                Nothing you were looking at was saved or changed. Reloading the panel is usually
                enough; if it keeps happening, the message below is what to report.
              </p>
              <div className="in mt-4 p-4">
                <p className="mono break-words text-[12px] leading-relaxed text-ink">
                  {error.message || "No message was attached to this error."}
                </p>
                {error.digest && (
                  <p className="mono mt-2 text-[10px] uppercase tracking-[0.1em] text-mute">
                    digest {error.digest}
                  </p>
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={reset} className="btn">
                  <Icon name="refresh" size={15} />
                  Try again
                </button>
                <Link href="/" className="btn-2">
                  Front page
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
