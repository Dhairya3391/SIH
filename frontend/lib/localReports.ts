"use client";

/**
 * What this device filed.
 *
 * Anonymous reporting is allowed — someone reporting an unsafe school should
 * not have to make an account first — so the server has nothing to key their
 * history on. This keeps a small record in the browser: the reference the
 * submission returned, and enough to look it up again. The challenge behind
 * the reference is public, so following it needs no credential.
 *
 * It is per-device and per-browser by nature. That is stated on screen rather
 * than pretended away: clearing site data loses the list, and the reference
 * number is the durable copy.
 */

const KEY = "jharsetu.local-reports.v1";
const MAX = 40;

export interface LocalReport {
  report_id: string;
  challenge_ref: string;
  challenge_id: string;
  /** What the citizen actually wrote or said, trimmed. */
  text: string;
  district: string | null;
  village: string | null;
  decision: string;
  priority: number | null;
  filed_at: string;
}

function read(): LocalReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalReport[]) : [];
  } catch {
    // A private window, cleared site data, or storage disabled entirely. An
    // empty list is the correct answer in all three cases.
    return [];
  }
}

function write(rows: LocalReport[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
  } catch {
    // Out of quota or blocked. The reference number on screen is the copy
    // that matters; losing the convenience list is not worth an error.
  }
}

export function listLocalReports(): LocalReport[] {
  return read().sort((a, b) => b.filed_at.localeCompare(a.filed_at));
}

export function rememberLocalReport(entry: LocalReport) {
  const rows = read().filter((r) => r.report_id !== entry.report_id);
  write([entry, ...rows]);
}

export function forgetLocalReports() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
