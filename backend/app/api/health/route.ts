import { ok, route } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";
import { isAiEnabled, MODEL_FAST, MODEL_DRAFT } from "@/lib/ai/llm";
import { isSttEnabled } from "@/lib/ai/stt";
import { isRemoteEmbeddingEnabled } from "@/lib/ai/embeddings";
import { isSmsOutboundConfigured } from "@/lib/services/notify";

/**
 * GET /api/health - is everything this deployment needs actually wired up?
 *
 * Deliberately honest about degradation rather than binary. The platform runs
 * with no AI keys at all, on its rule-based fallbacks, so "AI is off" is a
 * state to report and not a failure. What genuinely breaks the demo is the
 * database being unreachable, and that is the one thing reported as not ok.
 */
export const GET = route(async () => {
  const started = Date.now();

  let database = false;
  let regions = 0;
  let challenges = 0;
  let dbError: string | null = null;

  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.from("regions").select("id");
    if (error) throw error;
    regions = (data ?? []).length;
    database = true;

    const { count } = await supabase
      .from("challenges")
      .select("id", { count: "exact", head: true });
    challenges = count ?? 0;
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  return ok({
    ok: database,
    ms: Date.now() - started,
    database: { connected: database, regions, challenges, error: dbError },
    ai: {
      // False here means every brief comes from the rule-based compiler. The
      // golden path still runs end to end.
      enabled: isAiEnabled(),
      model_fast: MODEL_FAST,
      model_draft: MODEL_DRAFT,
      speech_to_text: isSttEnabled(),
      remote_embeddings: isRemoteEmbeddingEnabled(),
    },
    sms: {
      inbound_secret_set: Boolean(process.env.SMS_INBOUND_SECRET),
      outbound_gateway: isSmsOutboundConfigured(),
      number: process.env.JHARSETU_SMS_NUMBER ?? null,
    },
    demo: {
      role_switcher: Boolean(process.env.DEMO_PASSWORD),
      reset: Boolean(process.env.DEMO_RESET_SECRET),
    },
  });
});
