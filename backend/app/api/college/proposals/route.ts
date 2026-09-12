import { ok, fail, route, readJson } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { submitProposal, SchemaNotReadyError } from "@/lib/services/proposals";
import { opportunisticTick } from "@/lib/services/tick";

const schema = z.object({
  challenge_id: z.string().uuid(),
  /**
   * The document's text. The PDF itself is uploaded separately once the
   * storage bucket exists; the text is what the scorer reads, and taking it
   * here means a college can submit today by pasting or by client-side
   * extraction rather than waiting on the bucket.
   */
  extracted_text: z.string().min(200, "A proposal needs more than a couple of sentences."),
  document_name: z.string().max(200).default("proposal.pdf"),
  document_pages: z.coerce.number().int().min(1).max(500).default(1),
  document_path: z.string().max(500).optional(),
});

/**
 * POST /api/college/proposals - submit, and open the window if this is first.
 *
 * Scoring is NOT done here on purpose: a college uploading a twenty-page
 * document must not wait on a model call, and the scoring job is idempotent so
 * a crash mid-score is recoverable. The response tells the college when the
 * window closes and what the score to beat currently is.
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

  const body = await readJson(request, schema);
  const supabase = supabaseAdmin();

  // A college may only propose against something a human has verified.
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, title, confidence, status")
    .eq("id", body.challenge_id)
    .maybeSingle();
  if (!challenge) return fail(404, "No such challenge.", "not_found");
  if (!["field_verified", "coordinator_approved"].includes(challenge.confidence as string)) {
    return fail(
      409,
      "This problem has not been verified by a human yet, so it is not open for proposals. Writing a proposal against an unverified report risks a semester of work on something that turns out to be wrong.",
      "not_verified",
    );
  }

  try {
    const result = await submitProposal(supabase, {
      challengeId: body.challenge_id,
      orgId: actor.orgId,
      authorId: actor.id,
      documentPath: body.document_path ?? `pending/${actor.orgId}/${Date.now()}`,
      documentName: body.document_name,
      documentPages: body.document_pages,
      extractedText: body.extracted_text,
    });

    return ok(
      {
        proposal_id: result.proposal_id,
        version: result.version,
        state: "submitted",
        scoring: "queued",
        challenge_ref: challenge.ref,
        window: {
          opened_at: result.window.opened_at,
          closes_at: result.window.closes_at,
          window_days: result.window.window_days,
          state: result.window.state,
          // The score to beat. The leading document and the leading college
          // stay hidden until the window closes.
          leader_score: result.window.leader_score,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SchemaNotReadyError) {
      return fail(503, err.message, "schema_not_ready", err.detail);
    }
    if (err instanceof Error) {
      return fail(409, err.message, "cannot_submit");
    }
    throw err;
  }
});

/** GET /api/college/proposals - everything this college has submitted. */
export const GET = route(async () => {
  const actor = await requireRole("university", "admin");
  if (!actor.orgId) return ok({ proposals: [], count: 0 });

  const supabase = supabaseAdmin();
  // A college polling this page is usually waiting for its own score.
  await opportunisticTick(supabase);

  const { data, error } = await supabase
    .from("proposals")
    .select(
      "id, challenge_id, version, state, ai_score, ai_verdict, ai_rubric, funding_required, currency, duration_days, document_name, submitted_at, scored_at, ai_error",
    )
    .eq("org_id", actor.orgId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  const ids = [...new Set((data ?? []).map((p) => p.challenge_id as string))];
  const refs = new Map<string, { ref: string; title: string }>();
  if (ids.length > 0) {
    const { data: challenges } = await supabase
      .from("challenges")
      .select("id, ref, title")
      .in("id", ids);
    for (const c of challenges ?? [])
      refs.set(c.id as string, { ref: c.ref as string, title: c.title as string });
  }

  const windows = new Map<string, Record<string, unknown>>();
  if (ids.length > 0) {
    const { data: w } = await supabase
      .from("proposal_competition_public")
      .select("*")
      .in("challenge_id", ids);
    for (const row of w ?? []) windows.set(row.challenge_id as string, row);
  }

  return ok({
    proposals: (data ?? []).map((p) => {
      const w = windows.get(p.challenge_id as string);
      const leader = typeof w?.leader_score === "number" ? (w.leader_score as number) : null;
      const mine = typeof p.ai_score === "number" ? (p.ai_score as number) : null;
      return {
        ...p,
        challenge: refs.get(p.challenge_id as string) ?? null,
        window: w
          ? { state: w.state, closes_at: w.closes_at, leader_score: leader }
          : null,
        is_leading: leader !== null && mine !== null ? mine >= leader : null,
        score_to_beat: leader !== null && mine !== null && mine < leader ? leader : null,
      };
    }),
    count: data?.length ?? 0,
  });
});
