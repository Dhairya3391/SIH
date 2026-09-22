import { type NextRequest } from "next/server";
import { ok, fail, route } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { intakeReport } from "@/lib/services/intake";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/whatsapp
 * Simulates receiving a payload from Meta/Twilio WhatsApp API.
 * Extracts phone number, GPS, and text/image, feeding it directly into the AI intake pipeline.
 */
export const POST = route(async (request: NextRequest) => {
  let body: Record<string, any> = {};

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    body = Object.fromEntries(formData.entries());
  } else if (contentType.includes("application/json")) {
    body = await request.json();
  } else {
    return fail(400, "Unsupported content type", "validation");
  }

  // Twilio format
  const text = body.Body || body.text || "";
  const from = body.From || body.from || "whatsapp:+910000000000";
  const mediaUrl = body.MediaUrl0 || body.media_url || null;
  const latStr = body.Latitude || body.lat || null;
  const lngStr = body.Longitude || body.lng || null;

  if (!text && !mediaUrl) {
    return fail(400, "Message body or media is required", "validation");
  }

  // Parse GPS if available
  let lat = latStr ? parseFloat(latStr) : null;
  let lng = lngStr ? parseFloat(lngStr) : null;
  if (lat && isNaN(lat)) lat = null;
  if (lng && isNaN(lng)) lng = null;

  const photo_urls = mediaUrl ? [mediaUrl] : [];
  
  // Use a pseudo client ID based on the phone number
  const clientId = `wa-${Buffer.from(from).toString("base64")}-${Date.now()}`;

  const supabase = supabaseAdmin();

  const result = await intakeReport(supabase, {
    client_id: clientId,
    region_id: "jharkhand",
    text: text,
    lang: "hi", // assume Hindi/Hinglish from WhatsApp users, AI will auto-detect
    audio: null,
    photo_urls: photo_urls,
    lat: lat,
    lng: lng,
    location_source: (lat && lng) ? "gps" : "sms",
    vulnerable: [],
    channel: "whatsapp",
    reporter_id: null,
    consent: true,
  });

  // A real webhook would return TwiML or a JSON response acknowledging receipt
  return ok({
    success: true,
    message: "Report successfully ingested from WhatsApp",
    challenge_id: result.challengeId,
    decision: result.decision,
  });
});
