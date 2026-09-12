import "server-only";
import piexif from "piexifjs";

/**
 * Strips EXIF - including GPS - from a JPEG before it is stored.
 *
 * A verifier's field photo can carry the exact coordinates of a reporter's
 * house. The stored copy does not need them: the challenge already records
 * where the problem is, at the precision each role is allowed to see.
 */
export function stripJpegMetadata(bytes: Uint8Array, contentType: string): Uint8Array {
  if (!/^image\/jpe?g$/i.test(contentType)) return bytes;
  try {
    const cleaned = piexif.remove(Buffer.from(bytes).toString("binary"));
    return new Uint8Array(Buffer.from(cleaned, "binary"));
  } catch {
    // Most commonly a JPEG with no EXIF segment at all, which is already clean.
    return bytes;
  }
}
