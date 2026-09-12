import type { Band, ConfidenceLevel } from "@/types/database";

/**
 * Formatting rules, in one place.
 *
 * The house rule: never render a figure the API did not return. Where a value
 * is null, these helpers produce an em dash, and the caller is expected to
 * print a sentence next to it saying why it is missing. A plausible-looking
 * default in a disaster console is worse than an obvious blank.
 */

export const EMDASH = "—";

export function num(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return EMDASH;
  return v.toLocaleString("en-IN");
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return EMDASH;
  return `${Math.round(v)}%`;
}

/** Indian rupees, in the units a district officer actually reads. */
export function money(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return EMDASH;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(v % 10000000 === 0 ? 0 : 2)} cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 2)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

export function hours(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return EMDASH;
  if (v < 1) return `${Math.round(v * 60)} min`;
  if (v < 48) return `${v.toFixed(v < 10 ? 1 : 0)} h`;
  return `${(v / 24).toFixed(v / 24 < 10 ? 1 : 0)} d`;
}

/** A gap between two events, phrased the way the history board reads. */
export function gap(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return "first event";
  if (h < 1) return `${Math.round(h * 60)}m later`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)}h later`;
  return `${Math.round(h / 24)}d later`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return EMDASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EMDASH;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return EMDASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EMDASH;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return EMDASH;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return EMDASH;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return dateOnly(iso);
}

/** Time left before a window closes, or how long ago it closed. */
export function countdown(iso: string | null | undefined): {
  text: string;
  closed: boolean;
  urgent: boolean;
} {
  if (!iso) return { text: EMDASH, closed: false, urgent: false };
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return { text: EMDASH, closed: false, urgent: false };
  if (ms <= 0) return { text: "closed", closed: true, urgent: false };
  const totalMins = Math.floor(ms / 60000);
  const d = Math.floor(totalMins / 1440);
  const h = Math.floor((totalMins % 1440) / 60);
  const m = totalMins % 60;
  const text = d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  return { text, closed: false, urgent: totalMins < 1440 };
}

// ---------------------------------------------------------------------------
// Vocabulary. The API sends machine keys; people read words.
// ---------------------------------------------------------------------------

export const BAND_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  moderate: "Moderate",
  long_term: "Long term",
  "long-term": "Long term",
};

export function bandOf(priority: number | null | undefined): Band {
  const p = priority ?? 0;
  if (p >= 75) return "critical";
  if (p >= 55) return "high";
  if (p >= 35) return "moderate";
  return "long_term";
}

export const CATEGORY_LABEL: Record<string, string> = {
  disaster_safety: "Disaster safety",
  water: "Water",
  health: "Health",
  education: "Education",
  agriculture: "Agriculture",
  roads_infra: "Roads & infrastructure",
  energy_connectivity: "Energy & connectivity",
  environment: "Environment",
};

export const STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported",
  REFINED: "Awaiting verification",
  VERIFIED: "Verified · open to colleges",
  OPEN: "Open for proposals",
  TEAM_FORMED: "Team formed",
  SOLUTION_PROPOSED: "Awarded · being funded",
  PILOT: "Work in progress",
  DEPLOYED: "Work complete",
  IMPACT_VERIFIED: "Confirmed fixed",
  NEEDS_FOLLOW_UP: "Needs follow-up",
  CLOSED_NOT_ACTIONABLE: "Rejected",
  DUPLICATE: "Merged",
};

/** Statuses that are still on the main lists. Everything else has been awarded or closed. */
export const ACTIVE_STATUSES = ["REPORTED", "REFINED", "VERIFIED", "OPEN", "TEAM_FORMED"];

export const PLEDGE_STATE_LABEL: Record<string, string> = {
  offered: "Pledged",
  committed: "Committed",
  dispatched: "Sent",
  received: "Received",
  withdrawn: "Withdrawn",
};

/** "₹2,00,000" — the full figure, for a line someone is about to commit to. */
export function rupees(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return EMDASH;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

/** A quantity in its unit: money as rupees, everything else as "5 kg". */
export function quantity(qty: number | null | undefined, unit: string | null | undefined, kind?: string | null): string {
  if (qty === null || qty === undefined || !Number.isFinite(qty)) return EMDASH;
  if (kind === "money" || unit === "INR") return rupees(qty);
  return `${qty.toLocaleString("en-IN")} ${unit ?? "units"}`;
}

/** The confidence ladder, in order, with what each rung actually means. */
export const CONFIDENCE_RUNGS: { key: ConfidenceLevel; label: string; meaning: string }[] = [
  {
    key: "unverified",
    label: "Unverified",
    meaning: "One citizen said so. Nothing else yet.",
  },
  {
    key: "community_corroborated",
    label: "Community corroborated",
    meaning: "Several people in the same place reported the same thing.",
  },
  {
    key: "externally_corroborated",
    label: "Verified by AI with sources",
    meaning: "Weather records, news or the web confirmed it independently, and every source is cited.",
  },
  {
    key: "field_verified",
    label: "Field verified",
    meaning: "A verifier went, looked, and filed sources and photos.",
  },
  {
    key: "coordinator_approved",
    label: "Coordinator approved",
    meaning: "A district officer has signed it off for action.",
  },
  {
    key: "resolved_with_evidence",
    label: "Resolved with evidence",
    meaning: "The work is done and the proof is on file.",
  },
];

export function confidenceIndex(c: ConfidenceLevel | string | null | undefined): number {
  return CONFIDENCE_RUNGS.findIndex((r) => r.key === c);
}

export const CONFIDENCE_LABEL: Record<string, string> = Object.fromEntries(
  CONFIDENCE_RUNGS.map((r) => [r.key, r.label]),
);

export const PROVIDER_LABEL: Record<string, string> = {
  weather: "Weather records",
  news: "News archive",
  web: "Open web",
};

export const VERDICT_LABEL: Record<string, string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  inconclusive: "Inconclusive",
};

export const CHANNEL_LABEL: Record<string, string> = {
  web: "web",
  sms: "SMS",
  volunteer: "volunteer",
};

export const ROLE_LABEL: Record<string, string> = {
  citizen: "Citizen",
  volunteer: "Volunteer",
  verifier: "Verifier",
  coordinator: "District officer",
  university: "College",
  industry: "Company",
  ngo: "NGO",
  admin: "System owner",
};

export const STAGE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

/** "disaster_safety" -> "Disaster safety" for keys with no entry above. */
export function humanise(key: string | null | undefined): string {
  if (!key) return EMDASH;
  const s = key.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}
