/**
 * The coded SMS, one rung of the connectivity ladder.
 *
 *   JS1 K7F2 W5 25.2481,87.6412 P200 VCE "pani nahi 2 din"
 *
 *   JS1    JharSetu message format, version 1
 *   K7F2   report ID, so the full version merges with it when data returns
 *   W5     category W (water) at severity 5
 *   25.2481,87.6412   GPS, accurate to about 10 m
 *   P200   200 people affected
 *   VCE    vulnerable groups: C children, E elderly
 *   "..."  a few words
 *
 * Only critical reports use SMS: severity 4-5, or vulnerable groups ticked.
 * SMS carries no photo or voice, it costs the sender, and coordinators should
 * not be flooded. Everything else waits for the internet.
 *
 * GPS is one-way. Satellites transmit and the phone only listens, so GPS can
 * never send a report. What it does is put the exact location inside the SMS,
 * which is how a one-line text drops a pin within about ten metres.
 */

import {
  CATEGORY_LABELS,
  VULNERABILITY_SMS_CODES,
  type Category,
  type VulnerabilityTag,
} from "@/lib/domain/types";

export const SMS_PREFIX = "JS1";
export const SMS_MAX_LENGTH = 160;

const CATEGORY_BY_CODE = Object.fromEntries(
  (Object.entries(CATEGORY_LABELS) as [Category, { smsCode: string }][]).map(([cat, meta]) => [
    meta.smsCode,
    cat,
  ]),
) as Record<string, Category>;

const VULN_BY_CODE = Object.fromEntries(
  (Object.entries(VULNERABILITY_SMS_CODES) as [VulnerabilityTag, string][]).map(([tag, code]) => [
    code,
    tag,
  ]),
) as Record<string, VulnerabilityTag>;

export interface CodedSms {
  version: string;
  code: string;
  category: Category;
  severity: number;
  lat: number | null;
  lng: number | null;
  peopleEst: number | null;
  vulnerable: VulnerabilityTag[];
  text: string;
}

/** Four characters from an unambiguous alphabet: no O/0, no I/1, no S/5. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";

export function generateSmsCode(): string {
  let out = "";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export interface BuildSmsInput {
  code?: string;
  category: Category;
  severity: number;
  lat?: number | null;
  lng?: number | null;
  peopleEst?: number | null;
  vulnerable?: VulnerabilityTag[];
  text?: string;
}

/**
 * Builds the message the PWA hands to the phone's SMS app through an `sms:`
 * link. It trims the free-text tail rather than the structured fields, because
 * the structured fields are what makes a one-line text actionable.
 */
export function buildCodedSms(input: BuildSmsInput): { code: string; body: string } {
  const code = input.code ?? generateSmsCode();
  const parts: string[] = [SMS_PREFIX, code];

  parts.push(`${CATEGORY_LABELS[input.category].smsCode}${clampSeverity(input.severity)}`);

  if (input.lat != null && input.lng != null) {
    parts.push(`${input.lat.toFixed(4)},${input.lng.toFixed(4)}`);
  }
  if (input.peopleEst != null && input.peopleEst > 0) {
    parts.push(`P${Math.round(input.peopleEst)}`);
  }
  if (input.vulnerable?.length) {
    const codes = [...new Set(input.vulnerable)].map((v) => VULNERABILITY_SMS_CODES[v]).join("");
    if (codes) parts.push(`V${codes}`);
  }

  let body = parts.join(" ");
  const raw = (input.text ?? "").replace(/["\n\r]/g, " ").trim();
  if (raw) {
    const room = SMS_MAX_LENGTH - body.length - 3; // space and two quotes
    if (room > 4) body += ` "${raw.slice(0, room)}"`;
  }
  return { code, body };
}

function clampSeverity(s: number): number {
  return Math.max(1, Math.min(5, Math.round(s)));
}

/**
 * Parses an incoming SMS. Returns null for anything that is not in our format,
 * which is the normal case for a basic phone: that text goes to the Challenge
 * Compiler as free text instead, starting at a lower confidence.
 */
export function parseCodedSms(raw: string): CodedSms | null {
  const trimmed = raw.trim();
  if (!trimmed.toUpperCase().startsWith(SMS_PREFIX)) return null;

  // Pull the quoted tail off first so its spaces do not confuse the tokeniser.
  let text = "";
  let head = trimmed;
  const quoted = trimmed.match(/"([^"]*)"\s*$/);
  if (quoted) {
    text = quoted[1].trim();
    head = trimmed.slice(0, quoted.index).trim();
  }

  const tokens = head.split(/\s+/);
  if (tokens.length < 3) return null;

  const version = tokens[0].toUpperCase();
  const code = tokens[1].toUpperCase();

  let category: Category | null = null;
  let severity = 3;
  let lat: number | null = null;
  let lng: number | null = null;
  let peopleEst: number | null = null;
  const vulnerable: VulnerabilityTag[] = [];

  for (const token of tokens.slice(2)) {
    const t = token.toUpperCase();

    // Category + severity, e.g. W5
    const cat = t.match(/^([DWHEARCN])([1-5])$/);
    if (cat && CATEGORY_BY_CODE[cat[1]]) {
      category = CATEGORY_BY_CODE[cat[1]];
      severity = Number(cat[2]);
      continue;
    }

    // GPS pair
    const geo = token.match(/^(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)$/);
    if (geo) {
      const parsedLat = Number(geo[1]);
      const parsedLng = Number(geo[2]);
      if (Math.abs(parsedLat) <= 90 && Math.abs(parsedLng) <= 180) {
        lat = parsedLat;
        lng = parsedLng;
      }
      continue;
    }

    // People affected
    const people = t.match(/^P(\d{1,7})$/);
    if (people) {
      peopleEst = Number(people[1]);
      continue;
    }

    // Vulnerable groups
    const vuln = t.match(/^V([CEDPMIN]+)$/);
    if (vuln) {
      for (const ch of vuln[1]) {
        const tag = VULN_BY_CODE[ch];
        if (tag && !vulnerable.includes(tag)) vulnerable.push(tag);
      }
      continue;
    }
  }

  if (!category) return null;

  return { version, code, category, severity, lat, lng, peopleEst, vulnerable, text };
}

/** True when a report is critical enough to be worth an SMS at all. */
export function qualifiesForSms(severity: number, vulnerable: VulnerabilityTag[]): boolean {
  return severity >= 4 || vulnerable.length > 0;
}

/** The acknowledgement the gateway sends back. 112 is named on every reply. */
export function ackMessage(code: string, lang: "hi" | "en" = "en"): string {
  return lang === "hi"
    ? `JharSetu: रिपोर्ट ${code} मिल गई। जानलेवा आपात स्थिति में 112 पर कॉल करें।`
    : `JharSetu: report ${code} received. For life-threatening emergencies, call 112.`;
}

/** The Crisis Mode tech-squad call-up that buzzes a phone on stage. */
export function callUpMessage(params: {
  challengeRef: string;
  title: string;
  district: string;
  isDrill: boolean;
}): string {
  const drill = params.isDrill ? "[MOCK DRILL] " : "";
  const body = `${drill}JharSetu ${params.challengeRef}: ${params.title} (${params.district}). Reply YES to accept.`;
  return body.slice(0, SMS_MAX_LENGTH);
}

/** The `sms:` link the PWA opens, pre-filled. Android and iOS differ on the separator. */
export function smsLink(to: string, body: string, platform: "ios" | "android" | "other" = "other"): string {
  const sep = platform === "ios" ? "&" : "?";
  return `sms:${to}${sep}body=${encodeURIComponent(body)}`;
}
