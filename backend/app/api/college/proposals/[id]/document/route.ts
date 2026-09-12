import { NextResponse } from "next/server";
import { fail, route } from "@/lib/http";
import { requireActor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedFileUrl } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * GET /api/college/proposals/[id]/document - open a proposal PDF.
 *
 * While a window is open a document is sealed: only the college that wrote
 * it, and staff, may read it - otherwise a competitor copies the approach.
 * Once it has won, the companies and NGOs deciding whether to fund it may read
 * it too, because that is the plan their money goes into.
 */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireActor();
  const { id } = await ctx.params;

  const { data: proposal } = await supabaseAdmin()
    .from("proposals")
    .select("id, org_id, state, document_path")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return fail(404, "No such proposal.", "not_found");

  const allowed =
    actor.role === "admin" ||
    actor.role === "coordinator" ||
    actor.orgId === proposal.org_id ||
    (proposal.state === "winner" && ["industry", "ngo", "verifier"].includes(actor.role));
  if (!allowed) return fail(403, "This proposal is sealed until its window is awarded.", "forbidden");

  const path = proposal.document_path as string | null;
  if (!path || path.startsWith("pending/")) {
    return fail(404, "No PDF was uploaded; this proposal was submitted as text.", "no_document");
  }
  return NextResponse.redirect(await signedFileUrl(path), 302);
});
