"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Chip, Tag } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Empty, ErrorNote, SkeletonRows } from "@/components/ui/States";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { ROLE_LABEL, dateTime, humanise, initials, relative } from "@/lib/format";
import type { Thread } from "@/types/database";

/**
 * One thread per challenge: the college doing the work and the organisation
 * funding it, talking about that specific problem.
 *
 * The participant strip is not decoration. It is the answer to "who can read
 * this", and citizens are deliberately not in it — the backend enforces that
 * with a 403, not with a hidden button, and showing the parties makes the
 * boundary visible rather than implied.
 */
export function ThreadView({ thread }: { thread: Thread }) {
  const res = useResource(() => apiClient.fetchMessages(thread.id), [thread.id]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const messages = res.data?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const readOnly = thread.my_side === "observer";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setSendError(null);
    try {
      await apiClient.sendMessage(thread.id, body);
      setDraft("");
      res.reload();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "That message did not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="up flex min-h-[520px] flex-col p-5">
      {/* who is in the room */}
      <header className="hairline flex flex-wrap items-start justify-between gap-3 border-t-0 pb-4">
        <div className="min-w-0">
          <Link
            href={`/challenge/${thread.challenge.ref}`}
            className="mono text-[10.5px] uppercase tracking-[0.1em] text-navy hover:underline"
          >
            {thread.challenge.ref}
            {thread.challenge.district ? ` · ${thread.challenge.district}` : ""}
          </Link>
          <h2 className="mt-1 text-[16px] font-bold leading-snug text-navy-dark">
            {thread.challenge.title}
          </h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {thread.college && (
              <Tag icon={<Icon name="grad" size={11} />}>{thread.college.name}</Tag>
            )}
            {thread.contributor && (
              <Tag icon={<Icon name="box" size={11} />}>{thread.contributor.name}</Tag>
            )}
            <Chip tone="neutral">
              {thread.my_side === "observer"
                ? "You are observing"
                : `You are the ${humanise(thread.my_side)}`}
            </Chip>
          </div>
        </div>
      </header>

      {/* messages */}
      <div className="scroll-x flex-1 overflow-y-auto py-4">
        {res.loading && !res.settled ? (
          <SkeletonRows rows={3} height={74} />
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : messages.length === 0 ? (
          <Empty
            icon="chat"
            title="Nothing said yet"
            why="This thread was opened but nobody has written in it. The first message usually settles a delivery date or a specification."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`flex gap-2.5 ${m.is_self ? "flex-row-reverse" : ""}`}
              >
                <span
                  className="up-s mono grid h-9 w-9 flex-none place-items-center text-[11px] font-semibold text-navy"
                  title={m.author_name ?? "Unknown"}
                >
                  {initials(m.author_name)}
                </span>
                <div className={`min-w-0 max-w-[78%] ${m.is_self ? "text-right" : ""}`}>
                  <div
                    className={`mono flex flex-wrap items-center gap-x-2 text-[9.5px] uppercase tracking-[0.08em] text-mute ${
                      m.is_self ? "justify-end" : ""
                    }`}
                  >
                    <span className="font-semibold">{m.author_name ?? "Unknown"}</span>
                    <span>{ROLE_LABEL[m.author_role] ?? humanise(String(m.author_role))}</span>
                    <span title={dateTime(m.created_at)}>{relative(m.created_at)}</span>
                  </div>
                  <div
                    className={`${m.is_self ? "press" : "in-s"} mt-1.5 inline-block px-4 py-3 text-left`}
                  >
                    <p className="text-[13.5px] leading-relaxed text-ink whitespace-pre-wrap">
                      {m.body}
                    </p>
                  </div>
                  {m.author_org && (
                    <div className="mono mt-1 text-[9.5px] text-mute">{m.author_org}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      {/* compose */}
      {readOnly ? (
        <div className="in-s mt-2 flex items-start gap-2.5 p-3.5">
          <span className="mt-px text-mute">
            <Icon name="eye" size={14} />
          </span>
          <p className="text-[12px] leading-relaxed text-body">
            You can read this thread because you administer the system, but you are not a party to
            it. Writing into a conversation between a college and its funder would put words in
            somebody else&rsquo;s mouth, so the box is disabled rather than hidden.
          </p>
        </div>
      ) : (
        <form onSubmit={send} className="mt-2 flex flex-col gap-2.5">
          {sendError && (
            <p className="text-[12.5px] leading-relaxed text-alert-ink" role="alert">
              {sendError}
            </p>
          )}
          <div className="flex items-end gap-2.5">
            <textarea
              className="field min-h-[52px]"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about a delivery date, a specification, a site visit…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e);
              }}
            />
            <Button
              type="submit"
              variant="primary"
              icon="send"
              busy={sending}
              disabled={!draft.trim()}
              className="flex-none"
            >
              Send
            </Button>
          </div>
          <p className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">
            ⌘/Ctrl + Enter to send · everything here is on the record for this challenge
          </p>
        </form>
      )}
    </div>
  );
}

/** A thread in the list on the left. */
export function ThreadRow({
  thread,
  active,
  onSelect,
}: {
  thread: Thread;
  active: boolean;
  onSelect: () => void;
}) {
  const other =
    thread.my_side === "college"
      ? thread.contributor
      : thread.my_side === "contributor"
        ? thread.college
        : (thread.college ?? thread.contributor);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`${active ? "press" : "up-s up-hit"} w-full p-4 text-left`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
          {thread.challenge.ref}
        </span>
        {thread.unread_count > 0 && (
          <span className="mono rounded-full bg-navy px-2 py-0.5 text-[9.5px] font-semibold text-white">
            {thread.unread_count}
          </span>
        )}
      </div>
      <div className="mt-1.5 line-clamp-2 text-[13.5px] font-bold leading-snug text-navy-dark">
        {thread.challenge.title}
      </div>
      <div className="mono mt-1.5 truncate text-[10px] text-mute">
        {other?.name ?? "—"}
      </div>
      <div className="mono mt-1 text-[9.5px] uppercase tracking-[0.08em] text-mute">
        {thread.message_count} message{thread.message_count === 1 ? "" : "s"}
        {thread.last_message_at ? ` · ${relative(thread.last_message_at)}` : ""}
      </div>
    </button>
  );
}
