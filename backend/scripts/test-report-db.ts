import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log("=== STEP 1: Query database counts before test ===");
  const { count: reportsBefore, error: err1 } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true });
  const { count: challengesBefore, error: err2 } = await supabase
    .from("challenges")
    .select("*", { count: "exact", head: true });

  if (err1 || err2) {
    console.error("Supabase count error:", err1 || err2);
    process.exit(1);
  }

  console.log(`Current reports in DB: ${reportsBefore}`);
  console.log(`Current challenges in DB: ${challengesBefore}`);

  console.log("\n=== STEP 2: Submit a report via localhost:3000/api/reports ===");
  const uniqueId = `test-${Date.now()}`;
  const testPayload = {
    client_id: uniqueId,
    region_id: "jharkhand",
    text: `TEST DISASTER REPORT ${uniqueId}: Flash flood broke the river embankment in Karra Toli, 65 families cut off.`,
    district: "Gumla",
    village: "Karra Toli",
    people_est: 180,
    urgency: 4,
    vulnerable: ["children", "elderly"],
    lat: 23.0512,
    lng: 84.5421,
    consent: true,
  };

  const res = await fetch("http://localhost:3000/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testPayload),
  });

  const responseJson = await res.json();
  console.log("HTTP Status:", res.status);
  console.log("Response JSON:", JSON.stringify(responseJson, null, 2));

  if (!res.ok) {
    console.error("Submission failed!");
    process.exit(1);
  }

  const reportId = responseJson.data?.report_id;
  const challengeId = responseJson.data?.challenge_id;
  console.log(`\nGenerated report_id: ${reportId}`);
  console.log(`Assigned challenge_id: ${challengeId}`);

  console.log("\n=== STEP 3: Verify the record directly in Supabase Postgres ===");
  const { data: dbReport, error: reportFetchErr } = await supabase
    .from("reports")
    .select("id, client_id, original_text, district, village, people_est, cluster_id, created_at")
    .eq("id", reportId)
    .single();

  if (reportFetchErr || !dbReport) {
    console.error("Failed to find report in database:", reportFetchErr);
    process.exit(1);
  }
  console.log("Found row in 'reports' table:", JSON.stringify(dbReport, null, 2));

  if (challengeId) {
    const { data: dbChallenge, error: challengeFetchErr } = await supabase
      .from("challenges")
      .select("id, ref, title, district, priority, confidence, status, report_count")
      .eq("id", challengeId)
      .single();

    if (challengeFetchErr || !dbChallenge) {
      console.error("Failed to find challenge in database:", challengeFetchErr);
      process.exit(1);
    }
    console.log("Found row in 'challenges' table:", JSON.stringify(dbChallenge, null, 2));
  }

  console.log("\n=== STEP 4: Query database counts after test ===");
  const { count: reportsAfter } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true });
  const { count: challengesAfter } = await supabase
    .from("challenges")
    .select("*", { count: "exact", head: true });

  console.log(`Reports in DB after: ${reportsAfter} (Difference: +${(reportsAfter || 0) - (reportsBefore || 0)})`);
  console.log(`Challenges in DB after: ${challengesAfter}`);
  console.log("\n✅ VERIFICATION COMPLETE: The report IS successfully written and persisted in the Supabase PostgreSQL database!");
}

run().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
