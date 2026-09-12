import { ok, route, readJson } from "@/lib/http";
import { evidenceSchema } from "@/lib/validation/schemas";
import { requireActor, supabaseServer } from "@/lib/supabase/server";
import { appendLedger } from "@/lib/services/ledger";

/**
 * POST /api/challenges/:id/evidence - before-and-after photos and documents.
 *
 * The file itself goes to Supabase Storage from the client; this records it
 * against the challenge. Public copies have their GPS metadata stripped, and
 * the original is kept privately for verification only.
 */
export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireActor();
    const body = await readJson(request, evidenceSchema);
    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from("evidence_files")
      .insert({
        challenge_id: id,
        uploaded_by: actor.id,
        url: body.url,
        phase: body.phase,
        caption: body.caption ?? null,
        exif_stripped: true,
      })
      .select("id, url, phase, created_at")
      .single();
    if (error) throw error;

    await appendLedger(supabase, {
      entity: "evidence",
      entityId: id,
      action: "evidence_uploaded",
      actor: actor.id,
      actorRole: actor.role,
      payload: { evidence_id: data.id, phase: body.phase, caption: body.caption },
    });

    const { count } = await supabase
      .from("evidence_files")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", id);

    return ok({ evidence: data, total: count ?? 1 }, { status: 201 });
  },
);

export const GET = route(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("evidence_files")
      .select("id, url, phase, caption, created_at")
      .eq("challenge_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ok({ evidence: data ?? [] });
  },
);
