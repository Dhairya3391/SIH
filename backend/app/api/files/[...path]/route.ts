import { NextResponse } from "next/server";
import { fail, route } from "@/lib/http";
import { requireActor } from "@/lib/supabase/server";
import { signedFileUrl } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * GET /api/files/<path> - open a stored photo.
 *
 * Checks the session, then redirects to a signed URL that expires in two
 * minutes, so a link copied out of the page stops working almost at once.
 * Proposal PDFs are not served here: they go through
 * /api/college/proposals/[id]/document, which knows whose document it is.
 */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ path: string[] }> }) => {
  const actor = await requireActor();
  const { path: segments } = await ctx.params;
  const path = segments.map((s) => decodeURIComponent(s)).join("/");

  if (path.includes("..")) return fail(400, "Bad file path.", "validation");
  const purpose = path.split("/")[0];

  if (purpose === "proposal") {
    return fail(403, "Proposal documents open from the proposal itself.", "forbidden");
  }
  if (purpose !== "verification" && purpose !== "progress") {
    return fail(404, "No such file.", "not_found");
  }
  // Field photos can show people and homes; citizens see the problem, not the evidence file.
  if (purpose === "verification" && actor.role === "citizen") {
    return fail(403, "Verification photos are for the people working on the problem.", "forbidden");
  }

  try {
    return NextResponse.redirect(await signedFileUrl(path), 302);
  } catch {
    return fail(404, "That file could not be found.", "not_found");
  }
});
