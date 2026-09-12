import React from "react";
import Link from "next/link";
import { GovStrip, Logo } from "@/components/shell/GovStrip";
import { Icon } from "@/components/ui/Icon";

/**
 * Not found. Offers the two things a lost visitor actually wants: the front
 * door, and the report form — which is the one page somebody may have followed
 * a stale link to in an emergency.
 */
export default function NotFound() {
  return (
    <>
      <GovStrip />
      <div className="shell flex h-[78px] items-center">
        <Logo href="/" />
      </div>
      <main className="shell pt-10 pb-20">
        <div className="up mx-auto max-w-[560px] p-7 text-center">
          <div className="up-s mx-auto grid h-12 w-12 place-items-center text-mute">
            <Icon name="search" size={20} />
          </div>
          <h1 className="mt-5 text-[26px] font-extrabold text-navy-dark">
            There is nothing at this address
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-body">
            The link may be out of date, or the reference may belong to a problem that was merged
            into another one. A challenge reference looks like{" "}
            <span className="mono text-ink">C-100</span>.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn">
              <Icon name="back" size={15} />
              Front page
            </Link>
            <Link href="/report" className="btn-2">
              <Icon name="mic" size={15} />
              Report a problem
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
