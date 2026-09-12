import { ok, route, readQuery } from "@/lib/http";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const querySchema = z.object({
  region_id: z.string().max(40).default("jharkhand"),
  days: z.coerce.number().int().min(7).max(365).default(90),
});

/**
 * GET /api/map/silent-zones - where almost nobody is reporting.
 *
 * High hazard, real population, and far fewer reports than we would expect.
 * Silence usually means no access rather than no problems, so these are the
 * blocks where NSS or Aapda Mitra volunteers should be sent to collect reports
 * in person.
 *
 * This is an equity signal, and it is the opposite of an upvote ranking: it
 * looks for the places that are quiet, not the ones that are loud.
 */
export const GET = route(async (request: Request) => {
  const { region_id, days } = readQuery(request, querySchema);
  const supabase = await supabaseServer();

  const [zones, hazards] = await Promise.all([
    supabase.rpc("silent_zones", { p_region: region_id, p_days: days }),
    supabase
      .from("hazard_cells")
      .select("id, hazard, district, intensity, population")
      .eq("region_id", region_id),
  ]);

  if (zones.error) throw zones.error;

  return ok({
    region_id,
    window_days: days,
    silent_zones: zones.data ?? [],
    hazard_layers: groupHazards(hazards.data ?? []),
    explanation:
      "These blocks sit in a mapped hazard zone with a real population, and have received far fewer reports than expected. That usually means a digital divide, not an absence of problems.",
  });
});

function groupHazards(rows: Array<{ hazard: string; district: string | null; intensity: number }>) {
  const out: Record<string, { districts: string[]; max_intensity: number; cells: number }> = {};
  for (const row of rows) {
    const entry = out[row.hazard] ?? { districts: [], max_intensity: 0, cells: 0 };
    if (row.district && !entry.districts.includes(row.district)) entry.districts.push(row.district);
    entry.max_intensity = Math.max(entry.max_intensity, row.intensity);
    entry.cells++;
    out[row.hazard] = entry;
  }
  return out;
}
