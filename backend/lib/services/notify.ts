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
 * Every step of the flow tells the people who are waiting on it: reporters when
 * their problem is verified or delivered, colleges when their proposal is
 * scored or awarded, companies and NGOs when a college publishes what it needs,
 * and each side of a contribution when it is sent and when it arrives.
 *
 * The gateway is a spare Android phone for the prototype. At real scale in
 * India this moves to a licensed provider with TRAI DLT registration, and that
 * limit is worth admitting rather than hiding.
 */

export type TemplateKey =
  | "report_received"
  | "report_merged"
  | "brief_approved"
  | "team_formed"
  | "pilot_approved"
  | "pledge_received"
  | "deployed"
  | "confirm_request"
  | "capability_match"
  | "closed_not_actionable"
  | "verified"
  | "proposal_scored"
  | "proposal_needs_changes"
  | "proposal_not_viable"
  | "proposal_displaced"
  | "proposal_awarded"
  | "proposal_not_awarded"
  | "window_reopened"
  | "requirements_published"
  | "pledge_offered"
  | "pledge_dispatched"
  | "pledge_confirmed_received"
  | "project_update"
  | "work_completed"
  | "thread_message";

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
  verified: {
    en: "JharSetu: {ref} has been verified ({method}). It is now open to colleges for solutions.",
    hi: "JharSetu: {ref} की पुष्टि हो गई ({method})। अब कॉलेज इसके समाधान भेज सकते हैं।",
  },
  proposal_scored: {
    en: "JharSetu: your proposal for {ref} scored {score}/100 and is viable. It competes until the window closes.",
    hi: "JharSetu: {ref} के लिए आपके प्रस्ताव को {score}/100 अंक मिले और यह व्यवहार्य है।",
  },
  proposal_needs_changes: {
    en: "JharSetu: your proposal for {ref} scored {score}/100 and needs changes before it can lead: {reasons}",
    hi: "JharSetu: {ref} के लिए आपके प्रस्ताव को {score}/100 अंक मिले; आगे बढ़ने से पहले बदलाव चाहिए: {reasons}",
  },
  proposal_not_viable: {
    en: "JharSetu: your proposal for {ref} was rejected as not viable ({score}/100). Reasons: {reasons}",
    hi: "JharSetu: {ref} के लिए आपका प्रस्ताव व्यवहार्य नहीं माना गया ({score}/100)। कारण: {reasons}",
  },
  proposal_displaced: {
    en: "JharSetu: another proposal for {ref} now leads with {score_to_beat}/100. Yours scored {your_score}; you can submit a new version while the window is open.",
    hi: "JharSetu: {ref} के लिए अब एक दूसरा प्रस्ताव {score_to_beat}/100 के साथ आगे है। आपका स्कोर {your_score} है; विंडो खुली रहने तक नया संस्करण भेज सकते हैं।",
  },
  proposal_awarded: {
    en: "JharSetu: your proposal won {ref}. Publish your funding and material requirements so companies and NGOs can contribute.",
    hi: "JharSetu: {ref} के लिए आपका प्रस्ताव चुना गया। अपनी फंडिंग और सामग्री की ज़रूरतें प्रकाशित करें।",
  },
  proposal_not_awarded: {
    en: "JharSetu: the proposal window for {ref} closed and another proposal was awarded. Your score and feedback stay on record.",
    hi: "JharSetu: {ref} की प्रस्ताव विंडो बंद हुई और दूसरा प्रस्ताव चुना गया। आपका स्कोर और सुझाव रिकॉर्ड में रहेंगे।",
  },
  window_reopened: {
    en: "JharSetu: no viable proposal was received for {ref}, so its window is open again.",
    hi: "JharSetu: {ref} के लिए कोई व्यवहार्य प्रस्ताव नहीं मिला, इसलिए विंडो फिर से खुली है।",
  },
  requirements_published: {
    en: "JharSetu: {college} needs {summary} for {ref}. Open the needs board to contribute part or all of it.",
    hi: "JharSetu: {ref} के लिए {college} को {summary} चाहिए। योगदान देने के लिए ज़रूरतों का बोर्ड खोलें।",
  },
  pledge_offered: {
    en: "JharSetu: {org} pledged {amount} of {item} for {ref}.",
    hi: "JharSetu: {org} ने {ref} के लिए {item} में {amount} का योगदान देने का वचन दिया।",
  },
  pledge_dispatched: {
    en: "JharSetu: {org} has sent {amount} of {item} for {ref}. Confirm on the project page when it arrives.",
    hi: "JharSetu: {org} ने {ref} के लिए {item} में {amount} भेज दिया है। मिलने पर प्रोजेक्ट पेज पर पुष्टि करें।",
  },
  pledge_confirmed_received: {
    en: "JharSetu: {college} confirmed receiving {amount} of {item} for {ref}. Thank you.",
    hi: "JharSetu: {college} ने {ref} के लिए {item} में {amount} मिलने की पुष्टि की। धन्यवाद।",
  },
  project_update: {
    en: "JharSetu: new progress on {ref}: {note}",
    hi: "JharSetu: {ref} पर नई प्रगति: {note}",
  },
  work_completed: {
    en: "JharSetu: work on {ref} is complete. Please confirm whether the problem is really fixed.",
    hi: "JharSetu: {ref} का काम पूरा हुआ। कृपया बताएं कि समस्या सच में हल हुई या नहीं।",
  },
  thread_message: {
    en: "JharSetu: new message about {ref} from {org}: {preview}",
    hi: "JharSetu: {ref} के बारे में {org} का नया संदेश: {preview}",
  },
};

export function renderTemplate(
  template: TemplateKey,
  lang: string,
  payload: Record<string, unknown>,
): string {
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
  const body = renderTemplate(input.template, lang, payload);

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

/** Every distinct person who reported into this challenge, in their own language. */
export async function notifyReporters(
  supabase: SupabaseClient,
  challengeId: string,
  template: TemplateKey,
  payload: Record<string, unknown>,
): Promise<number> {
  const { data: reporters } = await supabase
    .from("reports")
    .select("reporter_id, phone_hash, lang")
    .eq("cluster_id", challengeId);

  const seen = new Set<string>();
  for (const r of reporters ?? []) {
    const key = (r.reporter_id as string | null) ?? (r.phone_hash as string | null);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    await notifyReporter(supabase, {
      userId: r.reporter_id as string | null,
      phoneHash: r.phone_hash as string | null,
      lang: (r.lang as string) ?? "hi",
      template,
      payload,
    });
  }
  return seen.size;
}

/** In-app notifications to specific accounts, each rendered in that account's language. */
export async function notifyUsers(
  supabase: SupabaseClient,
  params: { userIds: string[]; template: TemplateKey; payload: Record<string, unknown> },
): Promise<number> {
  const ids = [...new Set(params.userIds.filter(Boolean))];
  if (!ids.length) return 0;
  const { data: users } = await supabase.from("users").select("id, language").in("id", ids);
  const rows = (users ?? []).map((u) => {
    const lang = (u.language as string) ?? "en";
    return {
      user_id: u.id as string,
      channel: "app" as const,
      template: params.template,
      payload: params.payload,
      lang,
      body: renderTemplate(params.template, lang, params.payload),
    };
  });
  if (!rows.length) return 0;
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.error("[jharsetu] notification insert failed", params.template, error.message);
  return rows.length;
}

/** Everyone attached to these organisations. */
export async function notifyOrgs(
  supabase: SupabaseClient,
  params: { orgIds: Array<string | null | undefined>; template: TemplateKey; payload: Record<string, unknown> },
): Promise<number> {
  const orgIds = [...new Set(params.orgIds.filter((x): x is string => Boolean(x)))];
  if (!orgIds.length) return 0;
  const { data: users } = await supabase.from("users").select("id").in("org_id", orgIds);
  return notifyUsers(supabase, {
    userIds: (users ?? []).map((u) => u.id as string),
    template: params.template,
    payload: params.payload,
  });
}

/** Everyone holding one of these roles, e.g. every company when materials are needed. */
export async function notifyRoles(
  supabase: SupabaseClient,
  params: { roles: string[]; template: TemplateKey; payload: Record<string, unknown> },
): Promise<number> {
  if (!params.roles.length) return 0;
  const { data: users } = await supabase.from("users").select("id").in("role", params.roles);
  return notifyUsers(supabase, {
    userIds: (users ?? []).map((u) => u.id as string),
    template: params.template,
    payload: params.payload,
  });
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
    body: renderTemplate("capability_match", u.language ?? "en", {
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
