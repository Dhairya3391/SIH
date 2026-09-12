import { ok, route, readJson } from "@/lib/http";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { answerAdminQuestion } from "@/lib/services/assistant";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  question: z.string().trim().min(3, "Ask a question.").max(1000),
  /** Ask about one problem. A reference named in the question works too. */
  challenge_ref: z.string().trim().max(20).nullish(),
});

/**
 * POST /api/admin/assistant - "what has been going on?"
 *
 * Answers from the record only: the same history and metrics the admin pages
 * show, with references and dates. See lib/services/assistant.ts.
 */
export const POST = route(async (request: Request) => {
  await requireRole("admin");
  const body = await readJson(request, schema);
  return ok(await answerAdminQuestion(supabaseAdmin(), { question: body.question, challengeRef: body.challenge_ref }));
});
