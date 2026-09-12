import { ok, route, readJson } from "@/lib/http";
import { crisisStartSchema } from "@/lib/validation/schemas";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { startCrisis } from "@/lib/services/crisis";

/**
 * POST /api/crisis/start - a real alert, or a district's mock drill.
 *
 * The drill button is not a demo trick. Districts run mock drills before the
 * monsoon, and drill mode lets them rehearse with universities, companies and
 * NGOs on the same platform. It is labelled as a drill everywhere it appears,
 * including in the SMS call-up.
 *
 * Affected districts turn red, their open challenges switch to crisis mode, and
 * the priority formula floors urgency at 80% for them, so the queue reorders
 * itself the moment the alert lands.
 */
export const POST = route(async (request: Request) => {
  const actor = await requireRole("coordinator", "admin");
  const body = await readJson(request, crisisStartSchema);
  const supabase = await supabaseServer();

  const { crisis, challengesSwitched } = await startCrisis(supabase, {
    regionId: body.region_id,
    hazard: body.hazard,
    isDrill: body.drill,
    source: body.source,
    headline: body.headline,
    districts: body.districts,
    severity: body.severity,
    actorId: actor.id,
  });

  return ok(
    {
      crisis,
      challenges_switched: challengesSwitched,
      is_drill: crisis.is_drill,
      /** The red band reads "Crisis Mode - <districts> - mock drill" when this is set. */
      banner: `${crisis.is_drill ? "Mock drill" : "Crisis Mode"} - ${body.districts.join(", ")} - ${body.hazard}`,
    },
    { status: 201 },
  );
});

/** GET /api/crisis/start - active crises for a region, for the red banner. */
export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const regionId = url.searchParams.get("region_id") ?? "jharkhand";
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("crisis_events")
    .select("id, hazard, source, headline, is_drill, districts, severity, started_at")
    .eq("region_id", regionId)
    .is("ended_at", null)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return ok({ active: data ?? [] });
});
