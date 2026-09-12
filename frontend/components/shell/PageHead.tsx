import React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * The head of a console: what this is, what it is for, and the one control
 * that belongs at the top. The lede is not decoration — it is where a screen
 * says what it will and will not do, which is the difference between a
 * dashboard and a tool someone trusts.
 */
export function PageHead({
  eyebrow,
  title,
  lede,
  right,
  className,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={[
        "shell flex flex-col gap-6 pt-7 pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:pt-9",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-2.5">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="text-[28px] font-extrabold text-navy-dark sm:text-[34px] lg:text-[40px]">
          {title}
        </h1>
        {lede && (
          <p className="max-w-[68ch] text-[15px] leading-relaxed text-body sm:text-[16px]">
            {lede}
          </p>
        )}
      </div>
      {right && <div className="flex flex-none flex-wrap items-center gap-3">{right}</div>}
    </header>
  );
}

/** Breadcrumb back to the console a detail page came from. */
export function BackLink({
  href,
  label,
  trail,
}: {
  href: string;
  label: string;
  trail?: string;
}) {
  return (
    <div className="shell flex items-center gap-2 pt-6">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy hover:text-navy-dark"
      >
        <Icon name="back" size={14} />
        {label}
      </Link>
      {trail && (
        <>
          <span className="text-mute">
            <Icon name="chevRight" size={12} />
          </span>
          <span className="mono text-[12px] text-mute">{trail}</span>
        </>
      )}
    </div>
  );
}

/** The main region. Every console body goes through this for consistent rhythm. */
export function Main({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={["shell flex flex-col gap-5 pb-16 sm:gap-6", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </main>
  );
}
