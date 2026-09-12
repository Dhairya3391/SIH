import React from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

/**
 * The honest states.
 *
 * Loading is not zero. Empty is not broken. Broken is not empty. Every one of
 * these says which it is, and empty and broken both say WHY — a console that
 * shows a blank panel during a flood teaches its operator to distrust it.
 */

export function Skeleton({
  className,
  height,
  rounded = 12,
}: {
  className?: string;
  height?: number;
  rounded?: number;
}) {
  return (
    <div
      className={["skeleton", className].filter(Boolean).join(" ")}
      style={{ height, borderRadius: rounded }}
      aria-hidden="true"
    />
  );
}

/** A placeholder shaped like the rows that are coming. */
export function SkeletonRows({ rows = 4, height = 92 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={height} rounded={16} />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={104} rounded={18} />
      ))}
    </div>
  );
}

/**
 * A legitimately empty panel. `why` is mandatory: "nothing here" without a
 * reason is the most expensive sentence in an emergency tool.
 */
export function Empty({
  icon = "info",
  title,
  why,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  why: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={["in flex flex-col items-center px-6 py-10 text-center", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="up-s grid h-12 w-12 place-items-center text-mute">
        <Icon name={icon} size={20} />
      </div>
      <h3 className="mt-4 text-[16px] font-bold text-navy-dark">{title}</h3>
      <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-body">{why}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * A failure. Shows the service's own sentence, not a generic apology, and
 * offers the retry — an operator who can see the reason can often fix it.
 */
export function ErrorNote({
  message,
  code,
  onRetry,
  className,
}: {
  message: string;
  code?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={["in p-5", className].filter(Boolean).join(" ")}
      role="alert"
      style={{ boxShadow: "inset 5px 5px 10px #C5CFDC, inset -5px -5px 10px #FFFFFF" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-alert-ink">
          <Icon name="alert" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-bold text-alert-ink">
            This panel could not load its data
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-body">{message}</p>
          {code && (
            <p className="mono mt-2 text-[10.5px] uppercase tracking-[0.1em] text-mute">
              code {code}
            </p>
          )}
          {onRetry && (
            <div className="mt-4">
              <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** An inline note that a figure is missing, and what that means. */
export function NotMeasured({ what, why }: { what: string; why: string }) {
  return (
    <span className="inline-flex flex-col">
      <span className="mono text-[22px] font-semibold leading-none text-mute" title={why}>
        —
      </span>
      <span className="mt-1 text-[11.5px] leading-snug text-mute">
        {what} not measurable yet: {why}
      </span>
    </span>
  );
}

/** A short caution that sits inside a panel. Used for AI-derived content. */
export function Caveat({
  children,
  icon = "info",
}: {
  children: React.ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="in-s flex items-start gap-2.5 p-3">
      <span className="mt-px text-mute">
        <Icon name={icon} size={14} />
      </span>
      <p className="text-[12px] leading-relaxed text-body">{children}</p>
    </div>
  );
}

/**
 * Everything the model produced carries this. It is not decoration: the state
 * requires that an AI recommendation be labelled and human-validated, and a
 * judge will look for it.
 */
export function AiNote({ model }: { model?: string | null }) {
  return (
    <Caveat icon="spark">
      AI-assisted. A human has to validate this before it is acted on.
      {model ? (
        <>
          {" "}
          <span className="mono text-[11px] text-mute">{model}</span>
        </>
      ) : null}
    </Caveat>
  );
}
