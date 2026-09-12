"use client";

import React, { useMemo, useState } from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Panel, Stat } from "@/components/ui/Surface";
import { ButtonLink, Toggle } from "@/components/ui/Button";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { ChallengeRow } from "@/components/domain/ChallengeRow";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useAuth } from "@/lib/auth";
import { CATEGORY_LABEL, STATUS_LABEL, bandOf, humanise, num } from "@/lib/format";

/**
 * Every problem on the register, searchable.
 *
 * This is the reference list rather than a work queue — the coordinator's
 * triage and the verifier's queue both rank for a purpose. Here you can find a
 * specific problem by name, reference or place, which is what you need when
 * someone rings up asking about one.
 */
export default function ChallengesPage() {
  return (
    <RouteGuard>
      <AllChallenges />
    </RouteGuard>
  );
}

type Sort = "priority" | "recent" | "reports";

function AllChallenges() {
  const { role } = useAuth();
  const res = useResource(() => apiClient.fetchChallenges({ limit: 300 }), []);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<Sort>("priority");

  // Memoised so an unresolved fetch does not hand every useMemo below a
  // brand-new empty array on each render.
  const all = useMemo(() => res.data?.challenges ?? [], [res.data]);

  const districts = useMemo(
    () => [...new Set(all.map((c) => c.district).filter(Boolean) as string[])].sort(),
    [all],
  );
  const statuses = useMemo(
    () => [...new Set(all.map((c) => c.status).filter(Boolean))],
    [all],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = all
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
  }, [all, q, district, status, sort]);

  const people = useMemo(
    () => rows.reduce((sum, c) => sum + (c.people_est ?? 0), 0),
    [rows],
  );

  return (
    <>
      <PageHead
        eyebrow="Register"
        title="All challenges"
        lede="The full register, searchable by reference, title, place or hazard. Not a work queue — for that, use triage or the verification queue, which rank for a reason."
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
              className="field max-w-[190px]"
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
            {role === "admin" && (
              <div className="in-s mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-alert-ink">
                    <Icon name="shield" size={16} />
                  </span>
                  <div>
                    <span className="text-[13px] font-bold text-ink">Administrator Mode</span>
                    <p className="text-[12.5px] text-body">
                      You can permanently delete any problem or inspect whole-life audit trails from the Command Centre.
                    </p>
                  </div>
                </div>
                <ButtonLink href="/admin#manage-problems" variant="danger" size="sm" icon="trash">
                  Manage &amp; delete problems
                </ButtonLink>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="On the register"
                value={num(res.data?.total ?? all.length)}
                sub={`${num(all.length)} loaded`}
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
                sub="Represented in the loaded set"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
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

            {rows.length === 0 ? (
              <Empty
                icon="search"
                title="Nothing matches"
                why={
                  q
                    ? `No challenge on the register mentions "${q}" in its reference, title, place or hazard tags. Try a shorter search, or clear the district and status filters.`
                    : "The filters exclude everything. Clear one to widen the list."
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {rows.slice(0, 80).map((c) => (
                  <ChallengeRow
                    key={c.id}
                    href={`/challenge/${c.ref}`}
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
                  />
                ))}
                {rows.length > 80 && (
                  <p className="mono text-center text-[10.5px] uppercase tracking-[0.1em] text-mute">
                    showing 80 of {num(rows.length)} matches · narrow the search to see the rest
                  </p>
                )}
              </div>
            )}

            <Panel
              title="Categories in the loaded set"
              lede="What the district is actually dealing with, by volume."
              depth="in"
            >
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  all.reduce<Record<string, number>>((acc, c) => {
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
