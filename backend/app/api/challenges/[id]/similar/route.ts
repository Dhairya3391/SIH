import { ok, fail, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/challenges/:id/similar - the do-not-duplicate library.
 *
 * Similar problems already solved elsewhere, with what they cost and how long
 * they took. Institutional memory, and Point 9 of the Ten-Point Agenda put into
 * practice: learn from every disaster.
 */
export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const supabase = await supabaseServer();

    const { data: challenge } = await supabase
      .from("challenges")
      .select("id, embedding")
      .eq("id", id)
      .maybeSingle();
    if (!challenge) return fail(404, "No such challenge.", "not_found");
    if (!challenge.embedding) {
      return ok({ similar: [], reason: "This challenge has not been embedded yet." });
    }

    const { data, error } = await supabase.rpc("similar_solved", {
      p_embedding: challenge.embedding,
      p_exclude: id,
      p_limit: 5,
    });
    if (error) throw error;
    return ok({ similar: data ?? [] });
  },
);
