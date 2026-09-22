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
    { href: "/challenges", label: "All challenges", icon: "eye" },
    { href: "/silent-zones", label: "Silent zones", icon: "pin" },
  ],
  coordinator: [
    { href: "/crisis", label: "Crisis room", icon: "alert" },
    { href: "/queue", label: "Triage queue", icon: "list" },
    { href: "/silent-zones", label: "Silent zones", icon: "pin" },
    { href: "/overview", label: "Impact", icon: "gauge" },
    { href: "/challenges", label: "All challenges", icon: "eye" },
  ],
  university: [
    { href: "/college", label: "Overview", icon: "gauge" },
    { href: "/college/problems", label: "Problems", icon: "list" },
    { href: "/college/proposals", label: "My proposals", icon: "file" },
    { href: "/college/projects", label: "Projects", icon: "box" },
    { href: "/messages", label: "Messages", icon: "chat" },
  ],
  industry: [
    { href: "/needs", label: "Materials needed", icon: "box" },
    { href: "/contributions", label: "My contributions", icon: "wallet" },
    { href: "/messages", label: "Messages", icon: "chat" },
    { href: "/challenges", label: "All challenges", icon: "eye" },
  ],
  ngo: [
    { href: "/needs", label: "Funding needed", icon: "wallet" },
    { href: "/contributions", label: "My contributions", icon: "list" },
    { href: "/messages", label: "Messages", icon: "chat" },
    { href: "/challenges", label: "All challenges", icon: "eye" },
  ],
  admin: [
    { href: "/admin", label: "Command", icon: "gauge" },
    { href: "/crisis", label: "Crisis room", icon: "alert" },
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
  ngo: "/needs",
  admin: "/admin",
};

/**
 * What each role is for, in one sentence. Shown on the login screen and on the
 * wrong-console notice, so nobody has to guess which account they need.
 */
export const ROLE_PURPOSE: Record<UserRole, string> = {
  citizen: "File what you can see, in your own words, and follow what happens to it.",
  volunteer: "File on behalf of people without a phone, and corroborate reports nearby.",
  verifier: "Check the reports the AI could not verify, with sources and photos, and audit the ones it did.",
  coordinator: "Rank verified problems for your district and approve what gets acted on.",
  university: "Propose solutions to verified problems, publish what you need, and report progress as you deliver.",
  industry: "Supply the materials a college's project needs - a whole line or part of it - and follow what it built.",
  ngo: "Fund the money a college's project needs - all of it or a share - and follow what it delivered.",
  admin: "Own the whole system: every role, every table, every timing.",
};

/** Which roles may open a given path. The first segment is what matters. */
const ACCESS: { prefix: string; roles: UserRole[] }[] = [
  // "/report" and "/challenge/<ref>" are deliberately absent: they are public.
  // Someone reporting a collapsed culvert must not meet a login wall, and the
  // reference they were given must keep working without an account.
  { prefix: "/my-reports", roles: ["citizen", "volunteer", "admin"] },
  { prefix: "/verify", roles: ["verifier", "volunteer", "coordinator", "admin"] },
  { prefix: "/queue", roles: ["coordinator", "admin"] },
  { prefix: "/crisis", roles: ["coordinator", "admin", "verifier", "university", "industry", "ngo"] },
  { prefix: "/overview", roles: ["coordinator", "admin"] },
  { prefix: "/silent-zones", roles: ["verifier", "coordinator", "admin"] },
  {
    prefix: "/challenges",
    roles: ["verifier", "coordinator", "university", "industry", "ngo", "admin"],
  },
  { prefix: "/college", roles: ["university", "admin"] },
  { prefix: "/projects", roles: ["university", "industry", "ngo", "coordinator", "admin"] },
  { prefix: "/needs", roles: ["industry", "ngo", "coordinator", "admin"] },
  { prefix: "/contributions", roles: ["industry", "ngo", "admin"] },
  { prefix: "/messages", roles: ["university", "industry", "ngo", "coordinator", "admin"] },
  { prefix: "/admin", roles: ["admin"] },
];

export function rolesFor(pathname: string): UserRole[] | null {
  const hit = ACCESS.filter((a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`))
    // Longest prefix wins, so a nested rule can override its parent.
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
  "ngo",
  "admin",
];
