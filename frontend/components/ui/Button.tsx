import React from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * Actions.
 *
 * One primary per screen, solid navy on white. Everything else is raised or
 * inset. This is the deliberate break from soft UI: if every control is a soft
 * bump, nothing is findable, and the control a user needs during a flood has
 * to be findable in one glance.
 */

type Variant = "primary" | "secondary" | "danger";

const CLASS: Record<Variant, string> = {
  primary: "btn",
  secondary: "btn-2",
  danger: "btn-danger",
};

const cx = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(" ");

export function Button({
  variant = "secondary",
  icon,
  iconAfter,
  size,
  busy,
  children,
  className,
  ...rest
}: {
  variant?: Variant;
  icon?: IconName;
  iconAfter?: IconName;
  size?: "sm";
  busy?: boolean;
  children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={rest.type ?? "button"}
      className={cx(CLASS[variant], size === "sm" && "btn-sm", className)}
      disabled={rest.disabled || busy}
      {...rest}
    >
      {busy ? <Spinner /> : icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children}
      {iconAfter && !busy && <Icon name={iconAfter} size={size === "sm" ? 14 : 16} />}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  icon,
  iconAfter,
  size,
  children,
  className,
}: {
  href: string;
  variant?: Variant;
  icon?: IconName;
  iconAfter?: IconName;
  size?: "sm";
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cx(CLASS[variant], size === "sm" && "btn-sm", className)}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={size === "sm" ? 14 : 16} />}
    </Link>
  );
}

/** A square raised control for a single glyph. 44px, because it is tapped. */
export function IconButton({
  icon,
  label,
  active,
  className,
  ...rest
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        active ? "press" : "up-s up-hit",
        "grid h-11 w-11 place-items-center rounded-xl",
        active ? "text-navy" : "text-mute",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

/** Filter pills. Selected is pressed in, not recoloured. */
export function Toggle({
  active,
  children,
  className,
  ...rest
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        active ? "press font-bold text-navy" : "up-s up-hit font-medium text-body",
        "inline-flex min-h-9 items-center gap-1.5 px-3.5 text-[13px]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: "spin 900ms linear infinite", flex: "none" }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
