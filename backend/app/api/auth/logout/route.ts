import { ok, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout - end the session and clear the cookie.
 *
 * Always answers 200. A sign-out that fails is still a sign-out as far as the
 * person clicking it is concerned, and leaving them on a page that says
 * "could not log out" is worse than clearing what we can.
 */
export const POST = route(async () => {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return ok({ signed_out: true });
});
