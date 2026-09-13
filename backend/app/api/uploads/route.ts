import { ok, fail, route } from "@/lib/http";
import { requireRole, type Actor } from "@/lib/supabase/server";
import { storeFile, type FilePurpose } from "@/lib/storage";
import { stripJpegMetadata } from "@/lib/images";
import { checkUpload } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Who may upload what. Mirrors the visibility rules in GET /api/files. */
const PURPOSE_ROLES: Record<FilePurpose, Parameters<typeof requireRole>[number][]> = {
  verification: ["verifier", "volunteer", "coordinator", "admin"],
  proposal: ["university", "admin"],
  progress: ["university", "volunteer", "coordinator", "admin"],
};

/**
 * POST /api/uploads - store one photo privately.
 *
 * Multipart with `file`, `purpose` ("verification" | "progress") and an
 * optional `challenge_id` used as the storage folder. JPEG metadata
 * (including GPS) is stripped before the bytes are stored. Returns the
 * storage `path` - which is what verify-confirm and progress-update accept
 * as `photo_paths` - plus a `url` that opens through GET /api/files.
 */
export const POST = route(async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return fail(400, "Send the photo as multipart form data.", "validation");
  }

  const form = await request.formData();
  const purpose = String(form.get("purpose") ?? "");
  if (purpose !== "verification" && purpose !== "progress") {
    return fail(400, "Purpose must be verification or progress.", "validation");
  }

  const actor: Actor = await requireRole(...PURPOSE_ROLES[purpose]);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail(400, "Attach a photo.", "validation");
  }
  const problem = checkUpload(file, "photo");
  if (problem) {
    return fail(file.size > 8 * 1024 * 1024 ? 413 : 415, problem, "upload");
  }

  const rawChallengeId = String(form.get("challenge_id") ?? "").trim();
  const scope =
    rawChallengeId && !rawChallengeId.includes("/") && !rawChallengeId.includes("..")
      ? rawChallengeId.slice(0, 100)
      : (actor.orgId ?? actor.id);

  const type = file.type.split(";")[0].toLowerCase();
  const bytes = stripJpegMetadata(new Uint8Array(await file.arrayBuffer()), type);
  const stored = await storeFile({
    purpose,
    scope,
    name: file.name || "photo.jpg",
    contentType: type,
    bytes,
  });

  return ok(
    { path: stored.path, url: stored.url, name: file.name, size: file.size },
    { status: 201 },
  );
});
