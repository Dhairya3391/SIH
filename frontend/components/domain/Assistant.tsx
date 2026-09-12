"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Panel, Well } from "@/components/ui/Surface";
import { Button, Toggle } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import type { AssistantAnswer } from "@/types/database";

/**
 * Ask the system what has been going on.
 *
 * Answers come only from the record - the same history and figures these
 * pages show - with references and dates. Scoped to one problem when opened
 * from that problem's history page. When no model is available the answer is
 * the record summarised by rules, and it says so.
 */
export function AssistantPanel({
  challengeRef,
  suggestions,
  title = "Ask the system",
}: {
  challengeRef?: string | null;
  suggestions: string[];
  title?: string;
}) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ q: string; a: AssistantAnswer }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const a = await apiClient.askAssistant({ question: text, challenge_ref: challengeRef ?? null });
      setAnswers((prev) => [{ q: text, a }, ...prev].slice(0, 6));
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={title}
      lede={
        challengeRef
          ? `Answers from ${challengeRef}'s full record: reports, AI checks, verification, proposals and scores, contributions and every progress update, with dates.`
          : "Answers from the record only — every problem, verification, proposal, contribution and progress update — with references and dates."
      }
      right={<Icon name="spark" size={16} />}
    >
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Toggle key={s} active={false} onClick={() => void ask(s)} disabled={busy}>
            {s}
          </Toggle>
        ))}
      </div>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          className="field flex-1"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={challengeRef ? `What did the college propose for ${challengeRef}?` : "Which projects have gone quiet, and since when?"}
          aria-label="Question"
        />
        <Button type="submit" variant="primary" icon="send" busy={busy} disabled={question.trim().length < 3}>
          Ask
        </Button>
      </form>

      {error && <p className="mt-2 text-[12.5px] text-alert-ink">{error}</p>}

      {answers.length > 0 && (
        <ol className="mt-4 flex flex-col gap-3">
          {answers.map(({ q, a }, i) => (
            <li key={`${q}-${i}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13.5px] font-bold text-navy-dark">{q}</p>
                <Chip tone={a.generated_by === "ai" ? "teal" : "neutral"}>
                  {a.generated_by === "ai" ? `AI · ${a.model ?? "model"}` : "Rules summary (no AI available)"}
                </Chip>
              </div>
              <Well small className="mt-1.5">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{a.answer}</p>
              </Well>
              {a.refs.length > 0 && (
                <div className="mono mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.08em]">
                  {a.refs.slice(0, 12).map((r) => (
                    <Link key={r} href={`/admin/challenges/${r}`} className="text-navy hover:underline">
                      {r}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
