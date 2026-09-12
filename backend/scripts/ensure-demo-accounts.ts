/**
 * Creates any demo account that does not exist yet, and nothing else.
 *
 * Written as a separate script rather than a re-seed: the full seed rewrites
 * challenges and reports, and the `verifier` role was added to the system
 * after the last seed ran, so the one thing actually missing is one auth user
 * and one profile row. Re-seeding to add a login would have thrown away real
 * verification and proposal history.
 *
 * Idempotent: an account that already exists is left exactly as it is.
 *
 *   npx tsx scripts/ensure-demo-accounts.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.DEMO_PASSWORD;
const DOMAIN = process.env.DEMO_EMAIL_DOMAIN ?? "jharsetu.demo";
const REGION = "jharkhand";

if (!URL || !SERVICE_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
if (!PASSWORD) throw new Error("DEMO_PASSWORD is required");

const PROFILE: Record<string, { name: string; district: string; language: string; org?: string }> = {
  citizen: { name: "Somra Oraon (demo citizen)", district: "Gumla", language: "hi" },
  volunteer: { name: "Demo field volunteer", district: "Ranchi", language: "en", org: "Gram Sahyog Samiti (fictional)" },
  verifier: { name: "Demo verification officer", district: "Ranchi", language: "en", org: "Jharkhand State Disaster Management Authority (demo data)" },
  coordinator: { name: "Demo district coordinator", district: "Ranchi", language: "en", org: "Jharkhand State Disaster Management Authority (demo data)" },
  university: { name: "Demo university team lead", district: "Ranchi", language: "en", org: "BIT Mesra, Department of Electronics and Communication" },
  industry: { name: "Demo CSR lead", district: "Ranchi", language: "en", org: "Damodar Steel Works (fictional)" },
  admin: { name: "Demo administrator", district: "Ranchi", language: "en" },
};

async function main() {
  const supabase = createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false } });

  const { data: orgs } = await supabase.from("organizations").select("id, name");
  const orgIdByName = new Map((orgs ?? []).map((o) => [o.name as string, o.id as string]));

  const { data: authList, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  const idByEmail = new Map((authList?.users ?? []).map((u) => [u.email, u.id]));

  for (const [role, profile] of Object.entries(PROFILE)) {
    const email = `${role}@${DOMAIN}`;
    let userId = idByEmail.get(email);
    let created = false;

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          role,
          full_name: profile.name,
          region_id: REGION,
          language: profile.language,
          district: profile.district,
        },
      });
      if (error) {
        console.error(`  ${role.padEnd(12)} could not be created: ${error.message}`);
        continue;
      }
      userId = data.user.id;
      created = true;
    }

    const { error: upsertError } = await supabase.from("users").upsert({
      id: userId,
      role,
      full_name: profile.name,
      region_id: REGION,
      language: profile.language,
      district: profile.district,
      org_id: profile.org ? (orgIdByName.get(profile.org) ?? null) : null,
    });

    console.log(
      `  ${role.padEnd(12)} ${created ? "CREATED" : "already existed"}` +
        (upsertError ? ` (profile row failed: ${upsertError.message})` : " · profile ok"),
    );
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
