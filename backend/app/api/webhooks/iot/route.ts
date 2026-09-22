import { type NextRequest } from "next/server";
import { ok, fail, route } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { intakeReport } from "@/lib/services/intake";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/iot
 * Simulates receiving telemetry from remote river water-level sensors or embankment tension sensors.
 * If a dangerous threshold is breached, it creates a high-priority "Sensor Alert" challenge automatically.
 */
export const POST = route(async (request: NextRequest) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  
  const sensorId = body.sensor_id || body.device_id;
  const waterLevel = body.water_level;
  const lat = body.lat || 23.3441; // Default to somewhere in Jharkhand
  const lng = body.lng || 85.3096;
  const battery = body.battery || 100;
  
  if (!sensorId || typeof waterLevel !== "number") {
    return fail(400, "sensor_id and water_level are required", "validation");
  }

  // Threshold check: say waterLevel > 80 is critical
  const isCritical = waterLevel > 80;
  
  if (!isCritical) {
    // Acknowledge but don't alert
    return ok({
      success: true,
      message: "Telemetry received. Status: Normal.",
    });
  }

  // It's critical, trigger an automated intake report.
  const text = `AUTOMATED SENSOR ALERT: Sensor ${sensorId} reports critical water level at ${waterLevel}%. Potential flood risk imminent.`;
  
  const clientId = `iot-${sensorId}-${Date.now()}`;
  const supabase = supabaseAdmin();

  const result = await intakeReport(supabase, {
    client_id: clientId,
    region_id: "jharkhand",
    text: text,
    lang: "en",
    audio: null,
    photo_urls: [], // A real IoT sensor with a camera might send an image
    lat: lat,
    lng: lng,
    location_source: "gps",
    vulnerable: [],
    channel: "system", // Treat it as an internal system report
    reporter_id: null,
    consent: true,
  });

  return ok({
    success: true,
    message: "Critical telemetry received. Alert challenge created.",
    challenge_id: result.challengeId,
    decision: result.decision,
  });
});
