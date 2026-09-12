import { ok, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { crisisRoom } from "@/lib/services/crisis";

/**
 * GET /api/crisis/:id/room - everything the crisis room shows.
 *
 * The needs board with each gap, what is already nearby, the reports arriving
 * by SMS from areas with no mobile data, and the university tech-squad roster.
 *
 * One thing this deliberately does not do: dispatch anybody. JharSetu never
 * sends rescue. That is 112 and the district administration. What it routes is
 * technical, knowledge and resource needs, under the district authority.
 */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const supabase = await supabaseServer();
    return ok(await crisisRoom(supabase, id));
  },
);
