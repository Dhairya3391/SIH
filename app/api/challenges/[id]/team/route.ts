import { ok, route } from "@/lib/http";
import { requireRole, supabaseServer } from "@/lib/supabase/server";
import { buildTeam } from "@/lib/services/matching";

/**
 * POST /api/challenges/:id/team - the skill-gap team builder.
 *
 * Turns the capabilities the brief asked for into the seats a student team
 * needs, and reports which seats nobody has filled yet.
 */
export const POST = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    await requireRole("coordinator", "admin", "university");
    const supabase = await supabaseServer();
    return ok(await buildTeam(supabase, id));
  },
);
