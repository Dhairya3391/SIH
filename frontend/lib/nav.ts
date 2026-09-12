import type { IconName } from "@/components/ui/Icon";
import type { UserRole } from "@/types/database";

/**
 * Who sees what.
 *
 * Two rules held here so no page has to remember them:
 *  1. A nav entry only exists if the page behind it exists and reads real
 *     data. No dead links dressed up as roadmap.
 *  2. Access is checked again on the server for every API call. This map is
 *     for navigation, not for security — it decides what is worth showing,
 *     not what is allowed.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  citizen: [
    { href: "/report", label: "Report a problem", icon: "mic" },
    { href: "/my-reports", label: "My reports", icon: "list" },
  ],
  volunteer: [
    { href: "/report", label: "File a report", icon: "mic" },
    { href: "/verify", label: "Verification queue", icon: "shield" },
    { href: "/my-reports", label: "My reports", icon: "list" },
  ],
  verifier: [
    { href: "/verify", label: "Queue", icon: "list" },
    { href: "/silent-zones", label: "Silent zones", icon: "pin" },
    { href: "/challenges", label: "All challenges", icon: "eye" },
  ],
  coordinator: [
    { href: "/queue", label: "Triage queue", icon: "list" },
    { href: "/silent-zones", label: "Silent zones", icon: "pin" },
    { href: "/overview", label: "Impact", icon: "gauge" },
    { href: "/challenges", label: "All challenges", icon: "eye" },
  ],
  university: [
    { href: "/college", label: "Overview", icon: "gauge" },
    { href: "/college/problems", label: "Problems", icon: "list" },
    { href: "/college/proposals", label: "My proposals", icon: "file" },
    { href: "/messages", label: "Messages", icon: "chat" },
  ],
  industry: [
    { href: "/needs", label: "Needs", icon: "box" },
    { href: "/contributions", label: "My contributions", icon: "wallet" },
    { href: "/messages", label: "Messages", icon: "chat" },
    { href: "/challenges", label: "All challenges", icon: "eye" },
  ],
  admin: [
    { href: "/admin", label: "Command", icon: "gauge" },
    { href: "/admin/sla", label: "SLA & timings", icon: "clock" },
    { href: "/admin/ledger", label: "Ledger", icon: "shield" },
    { href: "/challenges", label: "All challenges", icon: "eye" },
  ],
};

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<UserRole, string> = {
  citizen: "/my-reports",
  volunteer: "/verify",
  verifier: "/verify",
  coordinator: "/queue",
  university: "/college",
  industry: "/needs",
  admin: "/admin",
};

/**
 * What each role is for, in one sentence. Shown on the login screen and on the
 * wrong-console notice, so nobody has to guess which account they need.
 */
export const ROLE_PURPOSE: Record<UserRole, string> = {
  citizen: "File what you can see, in your own words, and follow what happens to it.",
  volunteer: "File on behalf of people without a phone, and corroborate reports nearby.",
  verifier: "Weigh the evidence on a report and decide whether it stands.",
  coordinator: "Rank verified problems for your district and approve what gets acted on.",
  university: "Take on a verified problem and compete on the quality of your proposal.",
  industry: "Fund or supply a specific, itemised need and see what it delivered.",
  admin: "Own the whole system: every role, every table, every timing.",
};

/** Which roles may open a given path. The first segment is what matters. */
const ACCESS: { prefix: string; roles: UserRole[] }[] = [
  // "/report" is deliberately absent: it is public. Someone reporting a
  // collapsed culvert must not meet a login wall, so that page renders its own
  // chrome and accepts anonymous submissions.
  { prefix: "/my-reports", roles: ["citizen", "volunteer", "admin"] },
  { prefix: "/verify", roles: ["verifier", "volunteer", "coordinator", "admin"] },
  { prefix: "/queue", roles: ["coordinator", "admin"] },
  { prefix: "/overview", roles: ["coordinator", "admin"] },
  { prefix: "/silent-zones", roles: ["verifier", "coordinator", "admin"] },
  {
    prefix: "/challenges",
    roles: ["verifier", "coordinator", "university", "industry", "admin"],
  },
  {
    prefix: "/challenge",
    roles: ["verifier", "coordinator", "university", "industry", "admin"],
  },
  { prefix: "/college", roles: ["university", "admin"] },
  { prefix: "/needs", roles: ["industry", "coordinator", "admin"] },
  { prefix: "/contributions", roles: ["industry", "admin"] },
  { prefix: "/messages", roles: ["university", "industry", "coordinator", "admin"] },
  { prefix: "/admin", roles: ["admin"] },
];

export function rolesFor(pathname: string): UserRole[] | null {
  const hit = ACCESS.filter((a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`))
    // "/challenges" and "/challenge" both match "/challenge"; take the longest.
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return hit ? hit.roles : null;
}

export function canAccess(role: UserRole | null, pathname: string): boolean {
  const roles = rolesFor(pathname);
  if (!roles) return true;
  return role !== null && roles.includes(role);
}

export const ALL_ROLES: UserRole[] = [
  "citizen",
  "volunteer",
  "verifier",
  "coordinator",
  "university",
  "industry",
  "admin",
];
