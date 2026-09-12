import { ok, fail, route, readJson } from "@/lib/http";
import { z } from "zod";
import { supabaseServer, currentActor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().email("That does not look like an email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

/**
 * POST /api/auth/login - real email and password sign-in.
 *
 * This is the door every real user comes through. The demo switcher at
 * /api/auth/demo-login stays, because nobody wants to type a password on
 * stage, but it is a convenience over the top of this - not a replacement.
 *
 * The session is a genuine Supabase Auth session set as a first-party cookie,
 * so row-level security is evaluated against the actual signed-in user. A
 * college signing in really cannot read another college's proposal.
 */
export const POST = route(async (request: Request) => {
  const { email, password } = await readJson(request, schema);
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    // Deliberately vague: telling an attacker which half was wrong turns this
    // into an account-enumeration endpoint.
    return fail(401, "That email and password do not match an account.", "invalid_credentials");
  }

  const { data: profile } = await supabaseAdmin()
    .from("users")
    .select("id, role, full_name, org_id, region_id, district, language")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    return fail(
      403,
      "This login exists but has no JharSetu profile yet. An administrator has to finish setting the account up.",
      "no_profile",
    );
  }

  let organisation: { id: string; name: string; type: string } | null = null;
  if (profile.org_id) {
    const { data: org } = await supabaseAdmin()
      .from("organizations")
      .select("id, name, type")
      .eq("id", profile.org_id)
      .single();
    organisation = org ?? null;
  }

  return ok({
    user: profile,
    organisation,
    role: profile.role,
    email: data.user.email,
    access_token: data.session?.access_token ?? null,
    refresh_token: data.session?.refresh_token ?? null,
  });
});

/** GET /api/auth/login - the current session, with the org resolved. */
export const GET = route(async () => {
  const actor = await currentActor();
  if (!actor) return ok({ user: null, signed_in: false });

  const { data: profile } = await supabaseAdmin()
    .from("users")
    .select("id, role, full_name, org_id, region_id, district, language")
    .eq("id", actor.id)
    .single();

  let organisation: { id: string; name: string; type: string } | null = null;
  if (profile?.org_id) {
    const { data: org } = await supabaseAdmin()
      .from("organizations")
      .select("id, name, type")
      .eq("id", profile.org_id)
      .single();
    organisation = org ?? null;
  }

  return ok({ user: profile ?? null, organisation, signed_in: Boolean(profile) });
});
