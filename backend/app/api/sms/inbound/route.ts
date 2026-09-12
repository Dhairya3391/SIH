import type { NextRequest } from "next/server";
import { ok, fail, route, rateLimit, hashPhone } from "@/lib/http";
import { smsInboundSchema } from "@/lib/validation/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { intakeReport } from "@/lib/services/intake";
import { parseCodedSms, ackMessage, generateSmsCode } from "@/lib/sms/codec";
import { sendSms } from "@/lib/services/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/sms/inbound - the gateway phone forwards every incoming SMS here.
 *
 * Two kinds of message arrive:
 *
 *   1. A coded message the PWA built, carrying an exact GPS fix. That is the
 *      rung of the connectivity ladder for a phone with signal but no data.
 *   2. Plain text in Hindi or any other language from a basic phone. It goes to
 *      the Challenge Compiler as free text and starts at a lower confidence,
 *      because a village name is not a location and an unknown number is not a
 *      verified reporter.
 *
 * There is no signed-in user here, so this runs with the service-role client.
 * That makes the shared secret and the per-number rate limit load-bearing.
 */
export const POST = route(async (request: NextRequest) => {
  const body = smsInboundSchema.parse(await request.json());

  const expected = process.env.SMS_INBOUND_SECRET;
  const provided = body.secret ?? request.headers.get("x-jharsetu-secret");
  if (expected && provided !== expected) {
    return fail(401, "Bad or missing gateway secret.", "unauthorised");
  }

  const phoneHash = await hashPhone(body.from);

  // Per-number rate limiting, so one handset cannot flood a coordinator's queue.
  if (!rateLimit(`sms:${phoneHash}`, 8, 10 * 60_000)) {
    return fail(429, "That number has sent too many messages recently.", "rate_limit");
  }

  const supabase = supabaseAdmin();
  const parsed = parseCodedSms(body.text);

  // Keep the raw traffic. When a parse fails on stage, we can show exactly what
  // arrived instead of guessing.
  const { data: inboxRow } = await supabase
    .from("sms_inbox")
    .insert({
      phone_hash: phoneHash,
      raw_text: body.text,
      parsed: parsed as unknown as Record<string, unknown> | null,
      parse_ok: Boolean(parsed),
      received_at: body.received_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  const regionId = process.env.DEFAULT_REGION_ID ?? "jharkhand";
  const code = parsed?.code ?? generateSmsCode();

  const result = await intakeReport(supabase, {
    // The SMS code doubles as the idempotency key, which is what lets the full
    // report merge with this one when the phone gets data back.
    client_id: `sms-${code}`,
    region_id: regionId,
    text: parsed ? parsed.text || `Reported by SMS: ${body.text}` : body.text,
    lang: "hi",
    photo_urls: [],
    lat: parsed?.lat ?? null,
    lng: parsed?.lng ?? null,
    location_source: parsed?.lat != null ? "sms" : "none",
    district: null,
    village: null,
    people_est: parsed?.peopleEst ?? null,
    urgency: parsed?.severity ?? null,
    vulnerable: parsed?.vulnerable ?? [],
    consent: false,
    sms_code: code,
    channel: "sms",
    reporter_id: null,
    phone_hash: phoneHash,
    audio: null,
  });

  if (inboxRow) {
    await supabase.from("sms_inbox").update({ report_id: result.reportId }).eq("id", inboxRow.id);
  }

  // Acknowledge, and name 112 every single time. Anything life-threatening is
  // an emergency call, not a platform ticket.
  const reply = ackMessage(code, "hi");
  await sendSms(body.from, reply);

  return ok({
    report_id: result.reportId,
    challenge_id: result.challengeId,
    challenge_ref: result.challengeRef,
    sms_code: code,
    parsed: Boolean(parsed),
    /** A coded SMS drops a pin to about ten metres; plain text does not. */
    has_exact_location: parsed?.lat != null,
    decision: result.decision,
    priority: result.priority,
    confidence: result.confidence,
    reply_sent: reply,
  }, { status: 201 });
});
