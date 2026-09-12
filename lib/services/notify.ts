import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callUpMessage, SMS_MAX_LENGTH } from "@/lib/sms/codec";

/**
 * Notifications.
 *
 * Two channels: in-app rows that the portals subscribe to through Supabase
 * Realtime, and SMS through the gateway phone. Reporter updates go out in the
 * language the person reported in, which is the whole point of asking for it.
 *
 * The gateway is a spare Android phone for the prototype. At real scale in
 * India this moves to a licensed provider with TRAI DLT registration, and that
 * limit is worth admitting rather than hiding.
 */

type TemplateKey =
  | "report_received"
  | "report_merged"
  | "brief_approved"
  | "team_formed"
  | "pilot_approved"
  | "pledge_received"
  | "deployed"
  | "confirm_request"
  | "capability_match"
  | "closed_not_actionable";

const TEMPLATES: Record<TemplateKey, { en: string; hi: string }> = {
  report_received: {
    en: "JharSetu: your report was received and compiled as {ref}. We will tell you what happens next.",
    hi: "JharSetu: आपकी रिपोर्ट मिल गई और {ref} के रूप में दर्ज हुई। आगे की जानकारी हम आपको देंगे।",
  },
  report_merged: {
    en: "JharSetu: your report joined {ref}, which others have reported too. More voices raise its priority.",
    hi: "JharSetu: आपकी रिपोर्ट {ref} से जुड़ गई, जिसे और लोगों ने भी बताया है। अधिक आवाज़ों से प्राथमिकता बढ़ती है।",
  },
  brief_approved: {
    en: "JharSetu: a coordinator approved {ref}. It is now open for universities and companies to take on.",
    hi: "JharSetu: समन्वयक ने {ref} को मंज़ूरी दी। अब विश्वविद्यालय और कंपनियाँ इसे ले सकती हैं।",
  },
  team_formed: {
    en: "JharSetu: a team has taken on {ref}. Work starts now.",
    hi: "JharSetu: {ref} के लिए टीम बन गई है। काम शुरू हो रहा है।",
  },
  pilot_approved: {
    en: "JharSetu: a solution for {ref} was approved for a pilot.",
    hi: "JharSetu: {ref} के समाधान को पायलट की मंज़ूरी मिली।",
  },
  pledge_received: {
    en: "JharSetu: a partner pledged support for {ref}. {open} still needed.",
    hi: "JharSetu: {ref} के लिए एक साझेदार ने सहयोग दिया। अभी {open} और चाहिए।",
  },
  deployed: {
    en: "JharSetu: {ref} is marked deployed with evidence. Please confirm whether it is really fixed.",
    hi: "JharSetu: {ref} प्रमाण के साथ पूरा दर्ज हुआ। कृपया बताएं कि समस्या सच में हल हुई या नहीं।",
  },
  confirm_request: {
    en: "JharSetu: please confirm whether {ref} is fixed. Reply FIXED or STILL.",
    hi: "JharSetu: कृपया बताएं कि {ref} हल हुआ या नहीं। FIXED या STILL लिखकर भेजें।",
  },
  capability_match: {
    en: "JharSetu: {ref} needs {capability}. Your organisation matches. Open the platform to respond.",
    hi: "JharSetu: {ref} को {capability} चाहिए। आपकी संस्था इससे मेल खाती है।",
  },
  closed_not_actionable: {
    en: "JharSetu: {ref} was closed without action. Reason: {reason}",
    hi: "JharSetu: {ref} बिना कार्रवाई बंद किया गया। कारण: {reason}",
  },
};

function render(template: TemplateKey, lang: string, payload: Record<string, unknown>): string {
  const set = TEMPLATES[template];
  const base = lang.startsWith("hi") ? set.hi : set.en;
  return base.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = payload[key];
    return value == null ? "" : String(value);
  });
}

export interface NotifyInput {
  userId?: string | null;
  phoneHash?: string | null;
  lang?: string;
  template: TemplateKey;
  payload?: Record<string, unknown>;
}

/**
 * Tells the person who reported something what happened to it. This is the part
 * most grievance portals never do, and it is why people stop reporting.
 */
export async function notifyReporter(
  supabase: SupabaseClient,
  input: NotifyInput,
): Promise<void> {
  if (!input.userId && !input.phoneHash) return;

  const lang = input.lang ?? "hi";
  const payload = { ref: "your report", ...(input.payload ?? {}) };
  const body = render(input.template, lang, payload);

  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId ?? null,
    phone_hash: input.phoneHash ?? null,
    channel: input.userId ? "app" : "sms",
    template: input.template,
    payload,
    lang,
    body,
  });
  if (error) console.error("[jharsetu] notification insert failed", error.message);
}

/** Alerts every organisation whose capabilities match a new resource need. */
export async function notifyCapabilityMatch(
  supabase: SupabaseClient,
  params: { challengeId: string; challengeRef: string | null; capability: string; orgIds: string[] },
): Promise<void> {
  if (!params.orgIds.length) return;

  const { data: users } = await supabase
    .from("users")
    .select("id, language")
    .in("org_id", params.orgIds);

  const rows = (users ?? []).map((u) => ({
    user_id: u.id,
    channel: "app" as const,
    template: "capability_match",
    payload: {
      challenge_id: params.challengeId,
      ref: params.challengeRef,
      capability: params.capability,
    },
    lang: u.language ?? "en",
    body: render("capability_match", u.language ?? "en", {
      ref: params.challengeRef,
      capability: params.capability,
    }),
  }));

  if (rows.length) await supabase.from("notifications").insert(rows);
}

// ---------------------------------------------------------------------------
// Outbound SMS through the gateway phone
// ---------------------------------------------------------------------------

export function isSmsOutboundConfigured(): boolean {
  return Boolean(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_USER);
}

/**
 * Sends one SMS. Returns false rather than throwing, because a failed SMS must
 * never roll back the database change that triggered it: the platform's record
 * of what happened is the ledger, not a text message.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!isSmsOutboundConfigured()) {
    console.warn("[jharsetu] SMS gateway not configured; would have sent:", body);
    return false;
  }
  try {
    const auth = Buffer.from(
      `${process.env.SMS_GATEWAY_USER}:${process.env.SMS_GATEWAY_PASSWORD ?? ""}`,
    ).toString("base64");

    const res = await fetch(`${process.env.SMS_GATEWAY_URL!.replace(/\/$/, "")}/message`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
      body: JSON.stringify({ message: body.slice(0, SMS_MAX_LENGTH), phoneNumbers: [to] }),
    });
    if (!res.ok) {
      console.error("[jharsetu] SMS gateway returned", res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[jharsetu] SMS gateway unreachable", error);
    return false;
  }
}

/**
 * The Crisis Mode tech-squad call-up. This is the message that buzzes a phone
 * on stage during the drill, and it always says when it is a drill.
 */
export async function callUpTechSquad(
  supabase: SupabaseClient,
  params: {
    challengeId: string;
    challengeRef: string;
    title: string;
    district: string;
    isDrill: boolean;
    phones: string[];
  },
): Promise<number> {
  const body = callUpMessage({
    challengeRef: params.challengeRef,
    title: params.title,
    district: params.district,
    isDrill: params.isDrill,
  });

  let sent = 0;
  for (const phone of params.phones) {
    if (await sendSms(phone, body)) sent++;
  }

  await supabase.from("ledger").insert({
    entity: "challenge",
    entity_id: params.challengeId,
    action: "tech_squad_called_up",
    payload: { recipients: params.phones.length, sent, is_drill: params.isDrill },
  });

  return sent;
}
