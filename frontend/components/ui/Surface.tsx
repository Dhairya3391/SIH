import React from "react";
import Link from "next/link";

/**
 * The three surfaces, as components.
 *
 * Everything is the same colour as the ground; depth comes only from the light
 * at the top left. Raised means "this is an object". Inset means "the ground
 * is carved here" — inputs, wells, tracks. Nothing else.
 */

type Depth = "up" | "up-s" | "in" | "in-s" | "press";

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export function Card({
  depth = "up",
  className,
  children,
  as: As = "div",
  ...rest
}: {
  depth?: Depth;
  className?: string;
  children?: React.ReactNode;
  as?: "div" | "section" | "article" | "aside" | "li" | "header" | "footer";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx(depth, className)} {...rest}>
      {children}
    </As>
  );
}

/** A raised card that is also a link. Lifts on hover, sinks when held. */
export function CardLink({
  href,
  className,
  children,
  depth = "up",
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  depth?: Depth;
}) {
  return (
    <Link href={href} className={cx(depth, "up-hit block", className)}>
      {children}
    </Link>
  );
}

/** A titled panel: the unit most consoles are built from. */
export function Panel({
  title,
  lede,
  right,
  children,
  className,
  depth = "up",
  bodyClassName,
}: {
  title?: React.ReactNode;
  lede?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  depth?: Depth;
  bodyClassName?: string;
}) {
  return (
    <section className={cx(depth, "p-5 sm:p-6", className)}>
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[17px] font-bold text-navy-dark sm:text-[19px]">{title}</h2>
            )}
            {lede && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-body">{lede}</p>
            )}
          </div>
          {right && <div className="flex flex-none items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** An inset well: quoted text, raw transcripts, model reasoning. */
export function Well({
  className,
  children,
  small,
}: {
  className?: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return <div className={cx(small ? "in-s" : "in", "p-4", className)}>{children}</div>;
}

/** A row of figures. Each one carries its own sub-line explaining the number. */
export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "ink" | "teal" | "alert" | "navy";
  className?: string;
}) {
  const colour =
    tone === "teal"
      ? "text-teal-ink"
      : tone === "alert"
        ? "text-alert-ink"
        : tone === "navy"
          ? "text-navy"
          : "text-ink";
  return (
    <div className={cx("up p-4 sm:p-5", className)}>
      <div className="mono text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
        {label}
      </div>
      <div className={cx("mono mt-2 text-[26px] font-semibold leading-none", colour)}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12.5px] leading-snug text-body">{sub}</div>}
    </div>
  );
}

/** An inset track with a raised fill. */
export function Meter({
  value,
  max = 100,
  colour = "var(--color-navy)",
  className,
  height = 10,
}: {
  value: number;
  max?: number;
  colour?: string;
  className?: string;
  height?: number;
}) {
  const pctFull = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx("track", className)} style={{ height }}>
      <div className="track-fill" style={{ width: `${pctFull}%`, background: colour }} />
    </div>
  );
}
