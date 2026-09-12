import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Private file storage: verification photos, proposal PDFs, progress photos.
 *
 * One private bucket. Nothing in it is public: the browser never gets a
 * storage URL directly, it gets /api/files/<path>, which checks the session and
 * then redirects to a signed URL that expires in two minutes. A proposal PDF a
 * competing college could fetch by guessing a URL would defeat the point of the
 * sealed competition.
 *
 * The bucket is created on first use, so a fresh Supabase project needs no
 * manual step before the first upload.
 */

export const FILES_BUCKET = process.env.STORAGE_BUCKET ?? "jharsetu-files";

export type FilePurpose = "verification" | "proposal" | "progress";

let bucketReady: Promise<void> | null = null;

function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const storage = supabaseAdmin().storage;
      const { data } = await storage.getBucket(FILES_BUCKET);
      if (data) return;
      const { error } = await storage.createBucket(FILES_BUCKET, {
        public: false,
        fileSizeLimit: 12 * 1024 * 1024,
      });
      if (error && !/already exists/i.test(error.message)) throw error;
    })().catch((err) => {
      // Let the next upload try again rather than caching the failure.
      bucketReady = null;
      throw err;
    });
  }
  return bucketReady;
}

function safeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (cleaned || "file").slice(-80);
}

/** The app URL for a stored file. Always goes through the access check. */
export function fileUrl(path: string): string {
  return `/api/files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function storeFile(input: {
  purpose: FilePurpose;
  /** Folder under the purpose, e.g. a challenge id. */
  scope: string;
  name: string;
  contentType: string;
  bytes: Uint8Array;
}): Promise<{ path: string; url: string }> {
  await ensureBucket();
  const path = `${input.purpose}/${input.scope}/${Date.now()}-${randomUUID().slice(0, 8)}-${safeName(input.name)}`;
  const { error } = await supabaseAdmin()
    .storage.from(FILES_BUCKET)
    .upload(path, input.bytes, { contentType: input.contentType, upsert: false });
  if (error) throw error;
  return { path, url: fileUrl(path) };
}

export async function signedFileUrl(path: string, seconds = 120): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .storage.from(FILES_BUCKET)
    .createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw error ?? new Error("That file could not be opened.");
  return data.signedUrl;
}

export async function removeFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await supabaseAdmin().storage.from(FILES_BUCKET).remove(paths);
}
