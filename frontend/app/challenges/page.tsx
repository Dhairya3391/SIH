"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Panel, Stat } from "@/components/ui/Surface";
import { Button, ButtonLink, Toggle } from "@/components/ui/Button";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { ChallengeRow } from "@/components/domain/ChallengeRow";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useAuth } from "@/lib/auth";
import type { Challenge } from "@/types/database";
import { ACTIVE_STATUSES, CATEGORY_LABEL, STATUS_LABEL, bandOf, humanise, num } from "@/lib/format";

/**
 * Every problem on the register, searchable.
 *
 * This is the reference list rather than a work queue — the coordinator's
 * triage and the verifier's queue both rank for a purpose. It opens on the
 * problems still in play: once a problem is awarded and funded it leaves this
 * list, and is tracked from the project pages instead. "Awarded & closed" and
 * "Everything" bring it back.
 */
export default function ChallengesPage() {
  return (
    <RouteGuard>
      <AllChallenges />
    </RouteGuard>
  );
}

type Sort = "priority" | "recent" | "reports";
type Scope = "active" | "delivery" | "all";

function AllChallenges() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const res = useResource(() => apiClient.fetchChallenges({ limit: 500 }), []);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<Sort>("priority");
  const [scope, setScope] = useState<Scope>("active");

  const [localChallenges, setLocalChallenges] = useState<Challenge[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (res.data?.challenges && !localChallenges) {
      setLocalChallenges(res.data.challenges);
    }
  }, [res.data?.challenges, localChallenges]);

  const all = useMemo(() => localChallenges ?? res.data?.challenges ?? [], [localChallenges, res.data]);

  // Deleting is an administrator's act, checked again on the server.
  async function handleDelete(id: string, ref: string) {
    setDeletingId(id);
    setActionMsg(null);
    try {
      await apiClient.deleteChallenge(id);
      setLocalChallenges((prev) => (prev ?? all).filter((c) => c.id !== id));
      setDeleteTarget(null);
      setActionMsg(`Problem ${ref} was permanently removed.`);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Failed to delete problem.");
    } finally {
      setDeletingId(null);
    }
  }

  const inScope = useMemo(
    () =>
      all.filter((c) =>
        scope === "all"
          ? true
          : scope === "active"
            ? ACTIVE_STATUSES.includes(c.status)
            : !ACTIVE_STATUSES.includes(c.status),
      ),
    [all, scope],
  );

  const districts = useMemo(
    () => [...new Set(inScope.map((c) => c.district).filter(Boolean) as string[])].sort(),
    [inScope],
  );
  const statuses = useMemo(
    () => [...new Set(inScope.map((c) => c.status).filter(Boolean))],
    [inScope],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = inScope
      .filter((c) =>
        needle
          ? [c.ref, c.title, c.district, c.block, c.category, ...(c.hazard_tags ?? [])]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle))
          : true,
      )
      .filter((c) => (district ? c.district === district : true))
      .filter((c) => (status ? c.status === status : true));

    return filtered.slice().sort((a, b) => {
      if (sort === "recent")
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sort === "reports") return b.report_count - a.report_count;
      return b.priority - a.priority;
    });
  }, [inScope, q, district, status, sort]);

  const people = useMemo(
    () => rows.reduce((sum, c) => sum + (c.people_est ?? 0), 0),
    [rows],
  );

  const activeCount = all.filter((c) => ACTIVE_STATUSES.includes(c.status)).length;

  return (
    <>
      <PageHead
        eyebrow="Register"
        title="All challenges"
        lede="Searchable by reference, title, place or hazard. Opens on the problems still in play; awarded and closed problems have left the list and are tracked on their project pages."
        right={
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="relative">
              <span className="sr-only">Search challenges</span>
              <input
                className="field min-w-[220px] pl-10"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="C-100, Gumla, lightning…"
              />
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute">
                <Icon name="search" size={15} />
              </span>
            </label>
            <select
              className="field max-w-[170px]"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              aria-label="Filter by district"
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className="field max-w-[210px]"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">Any status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s] ?? humanise(s)}
                </option>
              ))}
            </select>
            {isAdmin && (
              <ButtonLink href="/admin" variant="secondary" icon="gauge">
                Admin console
              </ButtonLink>
            )}
          </div>
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats count={3} />
            <SkeletonRows rows={6} height={120} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Still in play"
                value={num(activeCount)}
                sub={`of ${num(res.data?.total ?? all.length)} on the register`}
              />
              <Stat label="Matching" value={num(rows.length)} sub="With your filters applied" />
              <Stat
                label="People behind them"
                value={num(people)}
                sub="Summed across the matching rows"
              />
              <Stat
                label="Districts"
                value={num(districts.length)}
                sub="Represented in this view"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["active", "Still in play"],
                    ["delivery", "Awarded & closed"],
                    ["all", "Everything"],
                  ] as [Scope, string][]
                ).map(([key, label]) => (
                  <Toggle
                    key={key}
                    active={scope === key}
                    onClick={() => {
                      setScope(key);
                      setStatus("");
                    }}
                  >
                    {label}
                  </Toggle>
                ))}
                <span className="mx-1 hidden h-6 w-px bg-[var(--color-line,#CCD1C7)] sm:inline-block" />
                {(
                  [
                    ["priority", "Highest score"],
                    ["recent", "Most recently moved"],
                    ["reports", "Most reported"],
                  ] as [Sort, string][]
                ).map(([key, label]) => (
                  <Toggle key={key} active={sort === key} onClick={() => setSort(key)}>
                    {label}
                  </Toggle>
                ))}
              </div>
              {res.data?.redacted && (
                <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                  some fields hidden from your role
                </span>
              )}
            </div>

            {actionMsg && (
              <div className="in-s flex items-center justify-between p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-moderate">
                    <Icon name="check" size={15} />
                  </span>
                  <span className="text-[13px] font-medium text-ink">{actionMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionMsg(null)}
                  className="text-mute hover:text-ink"
                  aria-label="Dismiss message"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}

            {rows.length === 0 ? (
              <Empty
                icon="search"
                title="Nothing matches"
                why={
                  q
                    ? `No challenge in this view mentions "${q}" in its reference, title, place or hazard tags. Try a shorter search, switch to Everything, or clear the district and status filters.`
                    : "The filters exclude everything in this view. Clear one, or switch to Everything."
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {rows.slice(0, 80).map((c) => {
                  const isDeleting = deletingId === c.id;
                  const isTarget = deleteTarget === c.id;

                  return (
                    <ChallengeRow
                      key={c.id}
                      href={ACTIVE_STATUSES.includes(c.status) ? `/challenge/${c.ref}` : `/challenge/${c.ref}`}
                      reference={c.ref}
                      title={c.title}
                      district={c.district}
                      block={c.block}
                      category={c.category}
                      priority={c.priority}
                      band={c.band ?? bandOf(c.priority)}
                      people={c.people_est}
                      reports={c.report_count}
                      reporters={c.reporter_count}
                      confidence={c.confidence}
                      status={c.status}
                      hazards={c.hazard_tags}
                      updatedAt={c.updated_at}
                      right={
                        !isAdmin ? undefined : !isTarget ? (
                          <Button
                            variant="danger"
                            size="sm"
                            icon="trash"
                            onClick={() => setDeleteTarget(c.id)}
                          >
                            Delete
                          </Button>
                        ) : (
                          <div className="in-s flex flex-wrap items-center gap-1.5 rounded-xl p-1.5">
                            <span className="px-1 text-[11px] font-bold text-alert-ink">
                              Permanently delete?
                            </span>
                            <Button
                              variant="danger"
                              size="sm"
                              busy={isDeleting}
                              onClick={() => handleDelete(c.id, c.ref)}
                            >
                              Yes, delete
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => setDeleteTarget(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        )
                      }
                    />
                  );
                })}
                {rows.length > 80 && (
                  <p className="mono text-center text-[10.5px] uppercase tracking-[0.1em] text-mute">
                    showing 80 of {num(rows.length)} matches · narrow the search to see the rest
                  </p>
                )}
              </div>
            )}

            <Panel
              title="Categories in this view"
              lede="What the district is actually dealing with, by volume."
              depth="in"
            >
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  inScope.reduce<Record<string, number>>((acc, c) => {
                    acc[c.category] = (acc[c.category] ?? 0) + 1;
                    return acc;
                  }, {}),
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <span
                      key={cat}
                      className="up-s mono inline-flex items-center gap-2 px-3 py-2 text-[11px] text-body"
                    >
                      {CATEGORY_LABEL[cat] ?? humanise(cat)}
                      <span className="font-semibold text-navy">{num(count)}</span>
                    </span>
                  ))}
              </div>
            </Panel>
          </>
        )}
      </Main>
    </>
  );
}
