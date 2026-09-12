import { ok, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { challengeGap } from "@/lib/services/swarm";

/** GET /api/challenges/:id/gap - the live Resource Swarm bar. */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const supabase = await supabaseServer();
    return ok(await challengeGap(supabase, id));
  },
);
