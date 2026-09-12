/**
 * Loads both demo scenarios, the background data and the Rajkot region.
 *
 *   npm run db:seed             add the seed data
 *   npm run db:seed -- --wipe   clear everything first
 *
 * No AI calls and no network beyond Supabase, so this finishes in seconds and
 * works with no API keys. A demo reset must never depend on a model being up.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { seedDatabase } from "../lib/seed/run";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Seeding needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const wipe = process.argv.includes("--wipe");
  console.log(wipe ? "Clearing and seeding." : "Seeding.");

  const started = Date.now();
  const summary = await seedDatabase(supabase, { wipe });

  console.log("\nSeeded:");
  for (const [key, value] of Object.entries(summary)) {
    console.log(`  ${key.padEnd(16)} ${value}`);
  }
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  console.log("Every seeded row is labelled as simulated.");

  if (!process.env.DEMO_PASSWORD) {
    console.log(
      "\nDEMO_PASSWORD was not set, so the six demo accounts were not created.\n" +
        "Set it and run this again if you want the one-click role switcher to work.",
    );
  }
}

main().catch((error) => {
  console.error("\nSeeding failed:\n", error instanceof Error ? error.message : error);
  process.exit(1);
});
