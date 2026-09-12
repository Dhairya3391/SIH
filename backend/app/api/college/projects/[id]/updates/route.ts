import { ok, fail, route, readJson } from "@/lib/http";
import { checkUpload, progressUpdateSchema } from "@/lib/validation/schemas";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripJpegMetadata } from "@/lib/images";
import { storeFile } from "@/lib/storage";
import { postProgressUpdate, resolveChallengeId } from "@/lib/services/projects";

export const runtime = "nodejs";

/**
 * POST /api/college/projects/[id]/updates - the college reports progress.
 *
 * JSON with `note`, optional `stage_id` and `photo_paths` from /api/uploads,
 * or multipart with the photos attached directly as `photos`. Contributors are
 * told, and the time since the previous update is what the admin console
 * watches for projects going quiet.
 */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole("university", "admin");
  const { id } = await ctx.params;
  const supabase = supabaseAdmin();
  const challengeId = await resolveChallengeId(supabase, id);

  let body: { note: string; stage_id?: string | null; photo_paths: string[] };

  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData();
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (photos.length > 10) return fail(400, "Attach at most ten photos to one update.", "validation");
    const paths: string[] = [];
    for (const photo of photos) {
      const problem = checkUpload(photo, "photo");
      if (problem) return fail(415, problem, "upload");
      const stored = await storeFile({
        purpose: "progress",
        scope: challengeId,
        name: photo.name || "progress.jpg",
        contentType: photo.type,
        bytes: stripJpegMetadata(new Uint8Array(await photo.arrayBuffer()), photo.type),
      });
      paths.push(stored.path);
    }
    body = progressUpdateSchema.parse({
      note: String(form.get("note") ?? ""),
      stage_id: String(form.get("stage_id") ?? "") || null,
      photo_paths: paths,
    });
  } else {
    body = await readJson(request, progressUpdateSchema);
  }

  return ok(await postProgressUpdate(supabase, actor, challengeId, body), { status: 201 });
});
