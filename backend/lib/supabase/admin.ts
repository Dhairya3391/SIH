import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role client. It bypasses row-level security, so it is used only
 * where the platform itself is acting rather than a person:
 *
 *   - the SMS gateway webhook, where there is no signed-in user at all
 *   - the Challenge Compiler job, which writes back to a report it is processing
 *   - the seed and demo-reset scripts
 *
 * Never import this from anything that renders. Every request that has a user
 * behind it goes through lib/supabase/server.ts instead, so the policies in
 * 0006_rls.sql actually do their job.
 */

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-jharsetu-actor": "service" } },
  });
  return cached;
}
