import { ok, fail, route, readJson } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rescoreChallenge } from "@/lib/services/scoring";

const schema = z.object({
  source_urls: z.array(z.string().url()).max(10).default([]),
  photo_paths: z.array(z.string()).max(10).default([]),
  note: z.string().min(10, "Say what you checked, in a sentence.").max(2000),
  granted: z.enum(["field_verified", "coordinator_approved"]).default("field_verified"),
});

/**
 * POST /api/verify/[id]/confirm - a human confirms a report.
 *
 * This is the gate: a challenge becomes visible to colleges only after this,
 * never on the strength of AI corroboration alone.
 */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("verifier", "volunteer", "coordinator", "admin");
  const { id } = await ctx.params;
  const body = await readJson(request, schema);

  if (body.source_urls.length === 0 && body.photo_paths.length === 0) {
    return fail(
      400,
      "A confirmation needs at least one source link or one field photo. Verification without evidence is just an opinion with a timestamp.",
      "evidence_required",
    );
  }

  const supabase = supabaseAdmin();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, confidence, status")
    .eq("id", id)
    .single();
  if (!challenge) return fail(404, "No such challenge.", "not_found");

  const { error } = await supabase.from("verifications").insert({
    challenge_id: id,
    by_user: actor.id,
    kind: "field",
    method: body.granted === "coordinator_approved" ? "coordinator" : "field",
    source_urls: body.source_urls,
    photo_paths: body.photo_paths,
    note: body.note,
    evidence_url: body.source_urls[0] ?? null,
  });
  if (error) throw error;

  await supabase
    .from("challenges")
    .update({
      confidence: body.granted,
      status: challenge.status === "REPORTED" || challenge.status === "REFINED" ? "VERIFIED" : challenge.status,
      verified_at: new Date().toISOString(),
    })
    .eq("id", id);

  const scored = await rescoreChallenge(supabase, id);

  return ok(
    {
      challenge_id: id,
      ref: challenge.ref,
      confidence: body.granted,
      status: "VERIFIED",
      priority: scored.priority,
      now_visible_to_colleges: true,
      sources_recorded: body.source_urls.length,
      photos_recorded: body.photo_paths.length,
    },
    { status: 201 },
  );
});
