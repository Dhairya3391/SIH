import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

async function testClusterMerge() {
  console.log("=== Testing report deduplication & clustering ===");
  const secondReportPayload = {
    client_id: `test-merge-${Date.now()}`,
    region_id: "jharkhand",
    text: "River water entering houses near Karra Toli bridge, flood water rising fast.",
    district: "Gumla",
    village: "Karra Toli",
    people_est: 200,
    urgency: 4,
    vulnerable: ["children"],
    lat: 23.0515,
    lng: 84.5423,
    consent: true,
  };

  const res = await fetch("http://localhost:3000/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(secondReportPayload),
  });

  const json = await res.json();
  console.log("Submission response:", JSON.stringify(json, null, 2));

  const reportId = json.data?.report_id;
  const challengeId = json.data?.challenge_id;

  const { data: report } = await supabase
    .from("reports")
    .select("id, client_id, cluster_id, district, village")
    .eq("id", reportId)
    .single();

  console.log("Saved report record in DB:", report);

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, report_count, confidence, priority")
    .eq("id", challengeId)
    .single();

  console.log("Associated challenge in DB:", challenge);
  console.log("Decision:", json.data?.decision);
}

testClusterMerge().catch(console.error);
