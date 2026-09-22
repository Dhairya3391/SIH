import { POST as whatsappPost } from "../app/api/webhooks/whatsapp/route";
import { POST as iotPost } from "../app/api/webhooks/iot/route";
import { NextRequest } from "next/server";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
dotenv.config({ path: "../.env.local", override: true });

async function run() {
  console.log("Testing WhatsApp Webhook...");
  const waReq = new NextRequest("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: "whatsapp:+919876543210",
      Body: "Help, my house is flooded in Ranchi",
      Latitude: "23.3441",
      Longitude: "85.3096",
    }),
  });
  
  try {
    const waRes = await whatsappPost(waReq);
    console.log("WhatsApp Webhook Response Status:", waRes.status);
    console.log("WhatsApp Webhook Response Body:", await waRes.json());
  } catch (e: any) {
    console.log("WhatsApp Webhook Error:", e?.message);
  }

  console.log("\\nTesting IoT Webhook...");
  const iotReq = new NextRequest("http://localhost/api/webhooks/iot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sensor_id: "SW-099",
      water_level: 85,
    }),
  });
  
  try {
    const iotRes = await iotPost(iotReq);
    console.log("IoT Webhook Response Status:", iotRes.status);
    console.log("IoT Webhook Response Body:", await iotRes.json());
  } catch (e: any) {
    console.log("IoT Webhook Error:", e?.message);
  }
}

run();
