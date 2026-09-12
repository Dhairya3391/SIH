import { after } from "next/server";
import { ok, fail, route, readJson } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { submitProposal, scoreAndNotify, SchemaNotReadyError } from "@/lib/services/proposals";
import { opportunisticTick } from "@/lib/services/tick";
import { extractPdfText, looksLikePdf, meaningfulLength } from "@/lib/documents/pdf";
import { removeFiles, storeFile } from "@/lib/storage";
import { UPLOAD_LIMITS } from "@/lib/validation/schemas";
import { OPEN_FOR_PROPOSALS, VERIFIED_CONFIDENCE } from "@/lib/domain/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_TEXT = 200;

const jsonSchema = z.object({
  challenge_id: z.string().uuid(),
  /** Pasted document text, for a college that cannot export a PDF. */
  extracted_text: z.string().min(MIN_TEXT, "A proposal needs more than a couple of sentences."),
  document_name: z.string().max(200).default("proposal.txt"),
  document_pages: z.coerce.number().int().min(1).max(500).default(1),
});

/**
 * POST /api/college/proposals - submit a proposal, and open the window if first.
 *
 * Multipart with `challenge_id` and a `document` PDF: the text is extracted
 * page by page, the file is stored privately, and the AI analysis starts the
 * moment the response is sent - a college uploading a twenty-page document
 * does not wait on it. JSON with `extracted_text` is accepted too.
 *
 * A proposal the analysis finds not viable is rejected with the reasons, and
 * the college is told; it can send a new version while the window is open.
 */
export const POST = route(async (request: Request) => {
  const actor = await requireRole("university", "admin");
  if (!actor.orgId) {
    return fail(
      403,
      "This account is not attached to a college organisation, so it cannot submit a proposal. An administrator has to link it.",
      "no_org",
    );
  }

  let challengeId: string;
  let extractedText: string;
  let documentName: string;
  let documentPages: number;
  let pdf: { bytes: Uint8Array; name: string } | null = null;

  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData();
    challengeId = String(form.get("challenge_id") ?? "");
    const file = form.get("document");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, "Attach the proposal as a PDF.", "validation");
    }
    if (file.size > UPLOAD_LIMITS.document.maxBytes) {
      return fail(413, "That PDF is larger than 12 MB. Compress the images in it and try again.", "upload");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!looksLikePdf(bytes)) {
      return fail(415, "That file is not a PDF. Export the proposal as a PDF, or paste its text instead.", "upload");
    }

    try {
      const extracted = await extractPdfText(bytes);
      extractedText = extracted.text;
      documentPages = extracted.pages;
    } catch (err) {
      return fail(
        422,
        `That PDF could not be read - it may be damaged or password-protected. Export it again, or paste the text instead. (${
          err instanceof Error ? err.message : "unknown error"
        })`,
        "unreadable_pdf",
      );
    }
    if (meaningfulLength(extractedText) < MIN_TEXT) {
      return fail(
        422,
        "This PDF has almost no selectable text, so it is probably a scan. Export it from Word or Google Docs as a PDF, or paste the text instead.",
        "no_text_in_pdf",
      );
    }
    documentName = file.name || "proposal.pdf";
    pdf = { bytes, name: documentName };
  } else {
    const body = await readJson(request, jsonSchema);
    challengeId = body.challenge_id;
    extractedText = body.extracted_text;
    documentName = body.document_name;
    documentPages = body.document_pages;
  }

  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) {
    return fail(400, "Say which challenge this proposal is for.", "validation");
  }

  const supabase = supabaseAdmin();

  // A college may only propose against something verified, and still open.
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, title, confidence, status")
    .eq("id", challengeId)
    .maybeSingle();
  if (!challenge) return fail(404, "No such challenge.", "not_found");
  if (!VERIFIED_CONFIDENCE.includes(challenge.confidence)) {
    return fail(
      409,
      "This problem has not been verified yet, so it is not open for proposals. Writing a proposal against an unverified report risks a semester of work on something that turns out to be wrong.",
      "not_verified",
    );
  }
  if (!OPEN_FOR_PROPOSALS.includes(challenge.status)) {
    return fail(409, "This problem has already been awarded to a college, so it no longer takes proposals.", "not_open");
  }

  let documentPath = `pending/${actor.orgId}/${Date.now()}`;
  if (pdf) {
    const stored = await storeFile({
      purpose: "proposal",
      scope: `${challengeId}/${actor.orgId}`,
      name: pdf.name,
      contentType: "application/pdf",
      bytes: pdf.bytes,
    });
    documentPath = stored.path;
  }

  try {
    const result = await submitProposal(supabase, {
      challengeId,
      orgId: actor.orgId,
      authorId: actor.id,
      documentPath,
      documentName,
      documentPages,
      extractedText,
    });

    // The analysis runs once the college has its answer.
    after(() =>
      scoreAndNotify(supabaseAdmin(), result.proposal_id).then(
        () => undefined,
        (err) => console.error("[proposals] scoring failed", err),
      ),
    );

    return ok(
      {
        proposal_id: result.proposal_id,
        version: result.version,
        state: "submitted",
        scoring: "started",
        challenge_ref: challenge.ref,
        first_in_window: result.first_in_window,
        document_pages: documentPages,
        document_url: pdf ? `/api/college/proposals/${result.proposal_id}/document` : null,
        window: {
          opened_at: result.window.opened_at,
          closes_at: result.window.closes_at,
          window_days: result.window.window_days,
          state: result.window.state,
          // The score to beat. The leading document and college stay hidden until the window closes.
          leader_score: result.window.leader_score,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (pdf) await removeFiles([documentPath]).catch(() => undefined);
    if (err instanceof SchemaNotReadyError) {
      return fail(503, err.message, "schema_not_ready", err.detail);
    }
    if (err instanceof Error) {
      return fail(409, err.message, "cannot_submit");
    }
    throw err;
  }
});

/** GET /api/college/proposals - everything this college has submitted, with each verdict. */
export const GET = route(async () => {
  const actor = await requireRole("university", "admin");
  if (!actor.orgId) return ok({ proposals: [], count: 0 });

  const supabase = supabaseAdmin();
  // A college opening this page is usually waiting for a score or an award.
  await opportunisticTick(supabase);

  const { data, error } = await supabase
    .from("proposals")
    .select(
      "id, challenge_id, version, state, ai_score, ai_verdict, ai_rubric, ai_model, funding_required, currency, duration_days, document_name, document_path, document_pages, submitted_at, scored_at, ai_error",
    )
    .eq("org_id", actor.orgId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  const ids = [...new Set((data ?? []).map((p) => p.challenge_id as string))];
  const refs = new Map<string, { ref: string; title: string; status: string }>();
  const windows = new Map<string, Record<string, unknown>>();
  if (ids.length > 0) {
    const [{ data: challenges }, { data: w }] = await Promise.all([
      supabase.from("challenges").select("id, ref, title, status").in("id", ids),
      supabase.from("proposal_competition_public").select("*").in("challenge_id", ids),
    ]);
    for (const c of challenges ?? [])
      refs.set(c.id as string, { ref: c.ref as string, title: c.title as string, status: c.status as string });
    for (const row of w ?? []) windows.set(row.challenge_id as string, row);
  }

  return ok({
    proposals: (data ?? []).map((p) => {
      const w = windows.get(p.challenge_id as string);
      const leader = typeof w?.leader_score === "number" ? (w.leader_score as number) : null;
      const mine = typeof p.ai_score === "number" ? (p.ai_score as number) : null;
      const viable = p.ai_verdict === "viable";
      const { document_path, ...rest } = p;
      return {
        ...rest,
        challenge: refs.get(p.challenge_id as string) ?? null,
        window: w ? { state: w.state, closes_at: w.closes_at, leader_score: leader } : null,
        document_url:
          document_path && !String(document_path).startsWith("pending/")
            ? `/api/college/proposals/${p.id}/document`
            : null,
        is_winner: p.state === "winner",
        // Only a viable proposal can lead; a high but not-viable score is not "leading".
        is_leading: leader !== null && mine !== null && viable ? mine >= leader : leader !== null && mine !== null ? false : null,
        score_to_beat: leader !== null && mine !== null && (mine < leader || !viable) ? leader : null,
      };
    }),
    count: data?.length ?? 0,
  });
});
