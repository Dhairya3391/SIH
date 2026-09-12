import { ok, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/regions - the region switch.
 *
 * A region is a setting, not a fork: its map, languages and partners load from
 * here. That is how the same platform runs for Jharkhand and, in the college
 * round, for Rajkot.
 */
export const GET = route(async () => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("regions")
    .select("id, name, country, zoom, languages, timezone, is_default, boundary")
    .order("is_default", { ascending: false });
  if (error) throw error;
  return ok({ regions: data ?? [] });
});
