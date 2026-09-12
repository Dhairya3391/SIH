import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { llmText, isAiEnabled } from "@/lib/ai/llm";
import { challengeHistory } from "./history";
import { adminMetrics } from "./metrics";

/**
 * The admin assistant: ask what has been going on, in plain words.
 *
 * It answers only from the record - the same history and metrics the admin
 * pages show - and cites references and dates. Asked about one problem (by
 * naming its reference, or from that problem's page) it reads that problem's
 * whole timeline: the reports, the AI checks, who verified it, what each
 * college proposed and how it scored, what was pledged and received, and every
 * progress update with the gap since the last. Asked in general, it reads the
 * system-wide numbers and the latest activity.
 *
 * With no model available it still answers, by summarising the same record
 * with rules, and says so.
 */

const fmt = (iso: unknown) =>
  typeof iso === "string"
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      })
    : "?";

const REF = /\bC-\d{2,5}\b/i;

export interface AssistantAnswer {
  answer: string;
  generated_by: "ai" | "rules";
  model: string | null;
  scope: "challenge" | "system";
  refs: string[];
}

async function challengeDigest(supabase: SupabaseClient, ref: string) {
  const h = await challengeHistory(supabase, ref);
  const c = h.challenge as Record<string, unknown>;
  const lines: string[] = [];
  lines.push(`PROBLEM ${String(c.ref)}: ${String(c.title)} (${String(c.district ?? "district unknown")})`);
  lines.push(`Status now: ${String(c.status)}. Confidence: ${String(c.confidence)}. Priority ${String(c.priority)}/100, severity ${String(c.severity)}/5, about ${String(c.people_est)} people.`);
  lines.push(`Reported ${fmt(c.created_at)}; verified ${c.verified_at ? fmt(c.verified_at) : "not yet"}; work complete ${c.deployed_at ? fmt(c.deployed_at) : "not yet"}.`);
  if (h.window) {
    const w = h.window as Record<string, unknown>;
    lines.push(`Proposal window: ${String(w.state)}, opened ${fmt(w.opened_at)}, closes ${fmt(w.closes_at)}${w.closed_at ? `, closed ${fmt(w.closed_at)}` : ""}.`);
  }
  for (const p of h.proposals) {
    const r = p as Record<string, unknown>;
    const rubric = (r.ai_rubric ?? {}) as { summary?: string; required_changes?: string[]; source?: string };
    lines.push(
      `Proposal v${String(r.version)} by ${String(r.org)} submitted ${fmt(r.submitted_at)}: ${String(r.state)}, score ${r.ai_score ?? "not yet scored"}, verdict ${String(r.ai_verdict ?? "pending")}${rubric.source === "rules" ? " (rule-based)" : ""}; asks ₹${Number(r.funding_required ?? 0).toLocaleString("en-IN")} over ${String(r.duration_days ?? "?")} days.${rubric.summary ? ` Reviewer: ${rubric.summary}` : ""}${rubric.required_changes?.length ? ` Required changes: ${rubric.required_changes.join("; ")}` : ""}`,
    );
  }
  for (const s of h.stages) {
    const r = s as Record<string, unknown>;
    lines.push(`Stage ${String(r.seq)} "${String(r.title)}": ${String(r.status)}${r.started_at ? `, started ${fmt(r.started_at)}` : ""}${r.completed_at ? `, done ${fmt(r.completed_at)}` : ""}.`);
  }
  for (const k of h.contributions) {
    lines.push(`Contribution: ${k.org} - ${k.kind === "money" ? `₹${k.qty.toLocaleString("en-IN")}` : `${k.qty} ${k.unit} ${k.item}`}; ${k.state}; pledged ${fmt(k.pledged_at)}${k.dispatched_at ? `, sent ${fmt(k.dispatched_at)}` : ""}${k.received_at ? `, received ${fmt(k.received_at)}` : ""}.`);
  }
  const cad = h.progress_cadence;
  lines.push(
    `Progress updates: ${cad.updates.length}; average gap ${cad.average_gap_days ?? "n/a"} days; longest gap ${cad.longest_gap_days ?? "n/a"} days; ${cad.days_since_last_update ?? "n/a"} days since the last.`,
  );
  lines.push("TIMELINE (oldest first; gap since previous entry in hours):");
  for (const e of h.timeline.slice(-120)) {
    lines.push(`- ${fmt(e.at)} [${e.kind}] ${e.summary}${e.actor ? ` (by ${e.actor})` : ""}${e.gap_hours != null ? ` +${e.gap_hours}h` : ""}`);
  }
  return { digest: lines.join("\n"), history: h };
}

async function systemDigest(supabase: SupabaseClient) {
  const m = await adminMetrics(supabase);
  const { data: recent } = await supabase
    .from("ledger")
    .select("entity_id, action, payload, created_at")
    .order("id", { ascending: false })
    .limit(60);
  const ids = [...new Set((recent ?? []).map((r) => r.entity_id).filter(Boolean))] as string[];
  const { data: refs } = ids.length
    ? await supabase.from("challenges").select("id, ref").in("id", ids)
    : { data: [] as Array<{ id: string; ref: string }> };
  const refOf = new Map((refs ?? []).map((r) => [r.id as string, r.ref as string]));

  const lines: string[] = [];
  const t = m.totals;
  lines.push(`TOTALS: ${t.challenges} problems. ${t.awaiting_verification} awaiting verification, ${t.open_to_colleges} open to colleges, ${t.in_delivery} in delivery, ${t.solved} solved, ${t.closed_not_actionable} rejected.`);
  lines.push(`SEVERE (priority 75+): ${t.severe_open} still open, ${t.severe_solved} solved.`);
  for (const s of m.severe_open.slice(0, 10)) {
    lines.push(`- ${s.ref} ${s.title} (${s.district ?? "?"}), ${s.status}, open ${s.age_days} days${s.listed_days != null ? `, listed for colleges ${s.listed_days} days` : ", not yet listed"}.`);
  }
  lines.push(`VERIFICATION: ${m.verification.ai_verified} verified by AI with sources, ${m.verification.human_verified} by a person, ${m.verification.rejected} rejected; median ${m.median_verification_hours ?? "n/a"} hours to verify.`);
  const p = m.proposals;
  lines.push(`PROPOSALS: ${p.total} submitted, ${p.viable} viable, ${p.needs_changes} need changes, ${p.not_viable} rejected as not viable, ${p.awarded} awarded, ${p.awaiting_score} awaiting analysis.`);
  lines.push(`WINDOWS: ${m.competition.windows_open} open, ${m.competition.windows_awarded} awarded, ${m.competition.windows_reopened} reopened.`);
  for (const w of m.open_windows.slice(0, 8)) lines.push(`- ${w.ref} closes ${fmt(w.closes_at)}, ${w.proposals} proposal(s), ${w.viable} viable, leader ${w.leader_score ?? "none"}.`);
  lines.push(`FUNDING: ₹${m.funding.money_pledged.toLocaleString("en-IN")} pledged, ₹${m.funding.money_received.toLocaleString("en-IN")} received; ${m.funding.material_lines_received} of ${m.funding.material_lines} material contributions received.`);
  lines.push(`DELIVERY: ${m.delivery.length} projects; average ${m.cadence.average_gap_days ?? "n/a"} days between college progress updates.`);
  for (const d of m.delivery.slice(0, 10)) lines.push(`- ${d.ref} by ${d.college ?? "?"}: ${d.status}, ${d.updates} update(s), ${d.days_since_update ?? "?"} days since the last.`);
  if (m.quiet_projects.length) lines.push(`QUIET (no update in 7+ days): ${m.quiet_projects.map((q) => `${q.ref} (${q.days_since_update} days)`).join(", ")}.`);
  lines.push("LATEST ACTIVITY (newest first):");
  for (const r of recent ?? []) {
    lines.push(`- ${fmt(r.created_at)} ${refOf.get(r.entity_id as string) ?? ""} ${String(r.action).replace(/_/g, " ")}`);
  }
  return { digest: lines.join("\n"), metrics: m };
}

function rulesAnswer(scope: "challenge" | "system", digest: string): string {
  const head = digest.split("\n").filter((l) => !l.startsWith("- ") && !l.startsWith("TIMELINE") && !l.startsWith("LATEST"));
  const events = digest.split("\n").filter((l) => l.startsWith("- ")).slice(scope === "challenge" ? -12 : 0, scope === "challenge" ? undefined : 12);
  return [
    "The AI assistant is not available on this deployment, so this is the recorded state, summarised by rules:",
    "",
    ...head,
    "",
    scope === "challenge" ? "Most recent entries:" : "Latest activity:",
    ...events,
  ].join("\n");
}

export async function answerAdminQuestion(
  supabase: SupabaseClient,
  input: { question: string; challengeRef?: string | null },
): Promise<AssistantAnswer> {
  const ref = (input.challengeRef ?? input.question.match(REF)?.[0] ?? null)?.toUpperCase() ?? null;
  const scope: AssistantAnswer["scope"] = ref ? "challenge" : "system";
  const { digest } = ref ? await challengeDigest(supabase, ref) : await systemDigest(supabase);
  const refs = [...new Set(digest.match(/\bC-\d{2,5}\b/g) ?? [])].slice(0, 40);

  if (isAiEnabled()) {
    try {
      const result = await llmText({
        system: `You are the operations assistant for the system owner of JharSetu, a Government of Jharkhand platform: citizens report problems, the AI and verifiers verify them, colleges propose solutions, companies and NGOs fund them, and colleges deliver them stage by stage.

Answer ONLY from the RECORD below. Name problems by their reference (C-123) and give dates. When asked about time, use the gaps and cadence figures given. If the record does not answer the question, say exactly that - never guess or invent a number. Keep it short: a few sentences or a short list.`,
        prompt: `RECORD\n${digest.slice(0, 60_000)}\n\nQUESTION\n${input.question}`,
        maxTokens: 900,
      });
      if (result.text.trim()) {
        return { answer: result.text.trim(), generated_by: "ai", model: result.model, scope, refs };
      }
    } catch {
      // fall through to the rules answer
    }
  }

  return { answer: rulesAnswer(scope, digest), generated_by: "rules", model: null, scope, refs };
}
