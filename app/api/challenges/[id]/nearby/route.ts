import { ok, route, readQuery } from "@/lib/http";
import { nearbyQuerySchema } from "@/lib/validation/schemas";
import { supabaseServer } from "@/lib/supabase/server";
import { nearbyResources } from "@/lib/services/matching";

/**
 * GET /api/challenges/:id/nearby - what is already within reach.
 *
 * Asked before "who could build something new?", which is the resource-first
 * argument in one endpoint: a siren already in stock in Ranchi beats a siren
 * somebody still has to design.
 */
export const GET = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { radius_km } = readQuery(request, nearbyQuerySchema);
    const supabase = await supabaseServer();
    const resources = await nearbyResources(supabase, id, radius_km);
    return ok({ radius_km, count: resources.length, resources });
  },
);
