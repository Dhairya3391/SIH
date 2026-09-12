"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { BandChip, Chip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { VIABILITY_FLOOR } from "@/components/domain/Competition";
import * as apiClient from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/useResource";
import { bandOf, countdown, humanise, money, num, relative } from "@/lib/format";

/**
 * The college's own front page.
 *
 * Answers the four questions a department head actually has: what am I
 * leading, what is about to close, what have I been beaten on, and who is
 * waiting for a reply from me.
 */
export default function CollegeOverviewPage() {
  return (
    <RouteGuard>
      <CollegeOverview />
    </RouteGuard>
  );
}

function CollegeOverview() {
  const { organisation, user } = useAuth();
  const proposals = useResource(() => apiClient.fetchMyProposals(), []);
  const problems = useResource(() => apiClient.fetchCollegeProblems(), []);
  const threads = useResource(() => apiClient.fetchThreads(), []);

  // Memoised so an unresolved fetch does not hand every useMemo below a
  // brand-new empty array on each render.
  const rows = useMemo(() => proposals.data?.proposals ?? [], [proposals.data]);

  const stats = useMemo(() => {
    const leading = rows.filter((p) => p.is_leading === true);
    const behind = rows.filter((p) => p.is_leading === false);
    const awarded = rows.filter((p) => p.state === "awarded");
    const closing = rows
      .filter((p) => p.window?.state === "open" && p.window.closes_at)
      .sort(
        (a, b) =>
          new Date(a.window!.closes_at!).getTime() - new Date(b.window!.closes_at!).getTime(),
      );
    const funding = rows
      .filter((p) => p.state === "awarded" || p.is_leading === true)
      .reduce((sum, p) => sum + (p.funding_required ?? 0), 0);
    return { leading, behind, awarded, closing, funding };
  }, [rows]);

  const openProblems = problems.data?.problems ?? [];
  const unclaimed = openProblems.filter(
    (p) => !p.competition || p.competition.state === "not_opened",
  );
  const unread = (threads.data?.threads ?? []).reduce((s, t) => s + t.unread_count, 0);

  const loading = proposals.loading && !proposals.settled;

  return (
    <>
      <PageHead
        eyebrow="College"
        title={organisation?.name ?? "Your department"}
        lede={
          user?.district
            ? `Signed in for ${user.district}. What you are leading, what closes soonest, and what nobody has taken on yet.`
            : "What you are leading, what closes soonest, and what nobody has taken on yet."
        }
        right={
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink href="/college/problems" variant="primary" icon="list">
              Open problems
            </ButtonLink>
            <ButtonLink href="/messages" variant="secondary" icon="chat">
              Messages{unread > 0 ? ` (${unread})` : ""}
            </ButtonLink>
          </div>
        }
      />

      <Main>
        {loading ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={3} height={140} />
          </>
        ) : proposals.error ? (
          <ErrorNote message={proposals.error} code={proposals.code} onRetry={proposals.reload} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Leading"
                value={num(stats.leading.length)}
                sub={
                  stats.leading.length === 0
                    ? "Nothing in the lead right now"
                    : "Highest viable score in the window"
                }
                tone={stats.leading.length > 0 ? "teal" : undefined}
              />
              <Stat
                label="Awarded to you"
                value={num(stats.awarded.length)}
                sub="Window closed in your favour"
                tone={stats.awarded.length > 0 ? "teal" : undefined}
              />
              <Stat
                label="Beaten, window still open"
                value={num(stats.behind.length)}
                sub={
                  stats.behind.length === 0
                    ? "Nothing to retake"
                    : "A revised version can retake the lead"
                }
                tone={stats.behind.length > 0 ? "alert" : undefined}
              />
              <Stat
                label="Funding you have asked for"
                value={money(stats.funding)}
                sub="Across leading and awarded proposals"
              />
            </div>

            {/* ---- closing soonest ---------------------------------------- */}
            <Panel
              title="Closing soonest"
              lede="Windows you are in, ordered by how long is left. A closed window cannot be reopened by submitting."
            >
              {stats.closing.length === 0 ? (
                <Empty
                  icon="clock"
                  title="No window of yours is running"
                  why="Either your submissions are in windows that already closed, or you have not submitted into an open one. Either way there is no clock on you right now."
                  action={
                    <ButtonLink href="/college/problems" variant="primary" size="sm" icon="list">
                      Find a problem
                    </ButtonLink>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {stats.closing.slice(0, 5).map((p) => {
                    const cd = countdown(p.window?.closes_at ?? null);
                    const gapToLeader =
                      p.score_to_beat !== null ? p.score_to_beat - (p.ai_score ?? 0) : null;
                    return (
                      <li key={p.id} className="up-s p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                              {p.challenge?.ref} · v{p.version} · {humanise(p.state)}
                            </div>
                            <div className="mt-1 text-[14.5px] font-bold leading-snug text-navy-dark">
                              {p.challenge?.title ?? "Challenge not resolved"}
                            </div>
                          </div>
                          <div className="flex flex-none items-center gap-2">
                            <Chip tone={cd.urgent ? "alert" : "moderate"}>
                              <Icon name="clock" size={11} />
                              {cd.text}
                            </Chip>
                            {p.is_leading === true ? (
                              <Chip tone="teal">Leading</Chip>
                            ) : gapToLeader !== null ? (
                              <Chip tone="high">−{gapToLeader}</Chip>
                            ) : null}
                          </div>
                        </div>

                        {p.ai_score !== null && (
                          <div className="mt-3">
                            <div className="flex items-baseline justify-between">
                              <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
                                yours {p.ai_score}
                                {p.window?.leader_score !== null &&
                                p.window?.leader_score !== undefined
                                  ? ` · leader ${p.window.leader_score}`
                                  : ""}
                              </span>
                              <Link
                                href={`/college/proposals/${p.id}`}
                                className="mono text-[10.5px] uppercase tracking-[0.1em] text-navy hover:underline"
                              >
                                verdict →
                              </Link>
                            </div>
                            <Meter
                              value={p.ai_score}
                              className="mt-2"
                              height={7}
                              colour={
                                p.ai_score < VIABILITY_FLOOR
                                  ? "var(--color-alert)"
                                  : p.is_leading
                                    ? "var(--color-teal)"
                                    : "var(--color-navy)"
                              }
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            {/* ---- nobody has taken these on ------------------------------ */}
            <Panel
              title="Nobody has taken these on"
              lede="No window has opened on them. Your submission would start the clock — being first does not win, but it does mean you set the pace."
              right={
                <ButtonLink href="/college/problems" variant="secondary" size="sm" icon="list">
                  All problems
                </ButtonLink>
              }
            >
              {problems.error ? (
                <ErrorNote message={problems.error} code={problems.code} onRetry={problems.reload} />
              ) : unclaimed.length === 0 ? (
                <Empty
                  icon="check"
                  title="Every verified problem has a window open"
                  why="That is a good state for the district: nothing verified is sitting unclaimed. You can still submit into any running window."
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {unclaimed
                    .slice()
                    .sort((a, b) => b.priority - a.priority)
                    .slice(0, 6)
                    .map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/college/problems/${p.ref}`}
                          className="up-s up-hit flex h-full flex-col p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="mono text-[10px] uppercase tracking-[0.1em] text-navy">
                              {p.ref}
                            </span>
                            <span className="mono text-[16px] font-semibold leading-none text-ink">
                              {p.priority}
                            </span>
                          </div>
                          <div className="mt-2 text-[14px] font-bold leading-snug text-navy-dark">
                            {p.title}
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <BandChip band={p.band ?? bandOf(p.priority)} />
                            <Tag>{p.district ?? "—"}</Tag>
                            <Tag>{num(p.people_est)} people</Tag>
                          </div>
                          <span className="mono mt-auto pt-3 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                            verified {p.verified_at ? relative(p.verified_at) : "—"}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>

            {/* ---- who is waiting on you ---------------------------------- */}
            <Panel
              title="Conversations"
              lede="One thread per challenge with the organisation funding it."
              right={
                <ButtonLink href="/messages" variant="secondary" size="sm" icon="chat">
                  Open messages
                </ButtonLink>
              }
              depth="in"
            >
              {threads.error ? (
                <ErrorNote message={threads.error} code={threads.code} onRetry={threads.reload} />
              ) : (threads.data?.threads ?? []).length === 0 ? (
                <p className="text-[13px] leading-relaxed text-body">
                  No threads yet. One opens when a company or NGO pledges against a need on a
                  challenge you are working on.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {(threads.data?.threads ?? []).slice(0, 4).map((t) => (
                    <li key={t.id}>
                      <Link
                        href="/messages"
                        className="up-s up-hit flex items-center justify-between gap-3 p-3.5"
                      >
                        <div className="min-w-0">
                          <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                            {t.challenge.ref} · {t.contributor?.name ?? "—"}
                          </div>
                          <div className="mt-1 truncate text-[13.5px] font-semibold text-ink">
                            {t.challenge.title}
                          </div>
                        </div>
                        <div className="flex flex-none items-center gap-2">
                          {t.unread_count > 0 && (
                            <span className="mono rounded-full bg-navy px-2 py-0.5 text-[9.5px] font-semibold text-white">
                              {t.unread_count}
                            </span>
                          )}
                          <span className="text-navy">
                            <Icon name="chevRight" size={15} />
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {!organisation && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-alert-ink">
                  <Icon name="alert" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  This account is not linked to a college organisation, so it cannot submit a
                  proposal — the server refuses it rather than accepting a submission with no owner.
                  An administrator has to attach the account to an organisation first.
                </p>
              </Card>
            )}
          </>
        )}
      </Main>
    </>
  );
}
