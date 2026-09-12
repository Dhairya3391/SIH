"use client";

import React, { useMemo, useState } from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat } from "@/components/ui/Surface";
import { Empty, ErrorNote, Skeleton, SkeletonRows } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { ThreadRow, ThreadView } from "@/components/domain/MessageThread";
import * as apiClient from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/useResource";
import { num } from "@/lib/format";

/**
 * Messaging.
 *
 * One thread per challenge, between the college doing the work and the
 * organisation funding it. Scoped that narrowly on purpose: a general inbox
 * becomes a place where decisions are made off the record, and the record for
 * a challenge is the thing this platform exists to keep.
 *
 * Citizens are not participants anywhere, and that is enforced server-side
 * with a 403 rather than by hiding a button.
 */
export default function MessagesPage() {
  return (
    <RouteGuard>
      <Messages />
    </RouteGuard>
  );
}

function Messages() {
  const { role } = useAuth();
  const res = useResource(() => apiClient.fetchThreads(), []);
  const [picked, setPicked] = useState<string | null>(null);

  // Memoised so an unresolved fetch does not hand every useMemo below a
  // brand-new empty array on each render.
  const threads = useMemo(() => res.data?.threads ?? [], [res.data]);

  // Derived, not synced: whichever thread was picked if it is still in the
  // list, otherwise the most recent one.
  const active = useMemo(
    () => threads.find((t) => t.id === picked) ?? threads[0] ?? null,
    [threads, picked],
  );
  const activeId = active?.id ?? null;
  const unread = threads.reduce((s, t) => s + t.unread_count, 0);
  const observing = role === "admin" || role === "coordinator";

  return (
    <>
      <PageHead
        eyebrow="Messages"
        title="One conversation per challenge"
        lede="Between the college building the solution and the organisation paying for it, about that specific problem. Everything said here belongs to the record for that challenge."
        right={
          threads.length > 0 ? (
            <div className="flex gap-3">
              <Stat
                label="Threads"
                value={num(threads.length)}
                sub="You are a party to these"
                className="min-w-[150px]"
              />
              <Stat
                label="Unread"
                value={num(unread)}
                sub={unread === 0 ? "Nothing waiting" : "Someone is waiting on a reply"}
                tone={unread > 0 ? "alert" : undefined}
                className="min-w-[150px]"
              />
            </div>
          ) : undefined
        }
      />

      <Main>
        {observing && threads.length > 0 && (
          <Card depth="in" className="flex items-start gap-3 p-4">
            <span className="mt-px text-mute">
              <Icon name="eye" size={16} />
            </span>
            <p className="text-[13px] leading-relaxed text-body">
              <strong className="text-ink">You are reading, not participating.</strong> Your role
              can see every thread for oversight, but the compose box stays disabled — writing into
              a conversation between a college and its funder would put words in someone
              else&rsquo;s mouth, and the record would no longer be theirs.
            </p>
          </Card>
        )}

        {res.loading && !res.settled ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <SkeletonRows rows={4} height={104} />
            <Skeleton height={520} rounded={18} />
          </div>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : threads.length === 0 ? (
          <>
            <Empty
              icon="chat"
              title="No conversations yet"
              why="A thread opens when a company or NGO pledges against a need on a challenge a college is working on. Until both sides exist there is nobody to talk to."
            />
            <Panel title="Who can be in a thread" lede="Two parties, and observers." depth="in">
              <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-body">
                <li>
                  <strong className="text-ink">The college</strong> doing the work on that
                  challenge.
                </li>
                <li>
                  <strong className="text-ink">The contributing organisation</strong> that pledged
                  against one of its needs.
                </li>
                <li>
                  <strong className="text-ink">A coordinator or the system owner</strong> can read
                  it for oversight, and cannot write.
                </li>
                <li>
                  <strong className="text-ink">Citizens are never in it.</strong> A citizen
                  requesting a thread gets a 403 from the server, not a hidden button — the
                  boundary is enforced where it matters.
                </li>
              </ul>
            </Panel>
          </>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2.5 lg:max-h-[720px] lg:overflow-y-auto lg:pr-1">
              {threads.map((t) => (
                <ThreadRow
                  key={t.id}
                  thread={t}
                  active={t.id === activeId}
                  onSelect={() => setPicked(t.id)}
                />
              ))}
            </div>

            {active ? (
              <ThreadView key={active.id} thread={active} />
            ) : (
              <Card depth="in" className="p-6">
                <p className="text-[13px] leading-relaxed text-body">
                  Pick a conversation on the left.
                </p>
              </Card>
            )}
          </div>
        )}
      </Main>
    </>
  );
}
