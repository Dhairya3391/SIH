import { ok, fail, route, readJson } from "@/lib/http";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { USER_ROLES, type UserRole } from "@/lib/domain/types";

const schema = z.object({ role: z.enum(USER_ROLES) });

/**
 * POST /api/auth/demo-login - the one-click role switcher.
 *
 * Nobody types a password on stage. Six seeded accounts, one per role, and this
 * signs into whichever one the switcher asks for.
 *
 * These are real Supabase Auth sessions, not a pretend role flag, which matters
 * more than it sounds: row-level security is evaluated against the actual
 * signed-in user, so switching to the university role really does hide the
 * reporter's phone number and really does fuzz the location. That is the ten
 * seconds of live proof that makes the security slide believable.
 *
 * Refuses to work unless DEMO_PASSWORD is set, so a production deployment
 * cannot be walked into by calling this endpoint.
 */
export const POST = route(async (request: Request) => {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    return fail(
      403,
      "The demo role switcher is disabled because DEMO_PASSWORD is not set on this deployment.",
      "disabled",
    );
  }

  const { role } = await readJson(request, schema);
  const email = demoEmail(role);
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return fail(
      401,
      `Could not sign in as the demo ${role}. Run the seed script so the six demo accounts exist.`,
      "demo_login_failed",
      error.message,
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, full_name, org_id, region_id, district, language")
    .eq("id", data.user.id)
    .single();

  return ok({
    user: profile,
    role,
    email,
    // The access token is included so non-browser clients (e.g. the smoke
    // test) can authenticate via Authorization: Bearer instead of a cookie.
    // The cookie is still set for browser sessions via supabaseServer().
    access_token: data.session?.access_token ?? null,
    refresh_token: data.session?.refresh_token ?? null,
  });
});

/** GET /api/auth/demo-login - who am I right now? */
export const GET = route(async () => {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return ok({ user: null, signed_in: false });

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, full_name, org_id, region_id, district, language")
    .eq("id", auth.user.id)
    .single();

  return ok({ user: profile, signed_in: true });
});

export function demoEmail(role: UserRole): string {
  const domain = process.env.DEMO_EMAIL_DOMAIN ?? "jharsetu.demo";
  return `${role}@${domain}`;
}
