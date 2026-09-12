"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Meter, Stat } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { Chip, StatusChip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { num, relative } from "@/lib/format";
import type { ProjectSummary } from "@/types/database";

/**
 * The problems this college won, and what each one is waiting on.
 *
 * Ordered by what needs the college: requirements not yet published, then
 * contributions that arrived and need confirming, then projects that have gone
 * quiet on progress.
 */
export default function CollegeProjectsPage() {
  return (
    <RouteGuard>
      <Projects />
    </RouteGuard>
  );
}

function Projects() {
  const res = useResource(() => apiClient.fetchCollegeProjects(), []);
  const projects = useMemo(() => res.data?.projects ?? [], [res.data]);

  const counts = useMemo(
    () => ({
      unpublished: projects.filter((p) => !p.requirements_published).length,
      toConfirm: projects.reduce((s, p) => s + p.contributions_awaiting_receipt, 0),
      quiet: projects.filter(
        (p) => !["DEPLOYED", "IMPACT_VERIFIED"].includes(p.status) && (p.days_since_update ?? 99) >= 7,
      ).length,
      done: projects.filter((p) => ["DEPLOYED", "IMPACT_VERIFIED"].includes(p.status)).length,
    }),
    [projects],
  );

  const ordered = useMemo(
    () =>
      projects.slice().sort((a, b) => {
        const weight = (p: ProjectSummary) =>
          !p.requirements_published ? 0 : p.contributions_awaiting_receipt > 0 ? 1 : ["DEPLOYED", "IMPACT_VERIFIED"].includes(p.status) ? 3 : 2;
        return weight(a) - weight(b) || b.priority - a.priority;
      }),
    [projects],
  );

  return (
    <>
      <PageHead
        eyebrow="College"
        title="Projects you won"
        lede="Publish what each project needs, confirm contributions as they arrive, move the delivery stages and post progress. Companies, NGOs and the system owner read the same record."
        right={
          <ButtonLink href="/college/problems" variant="secondary" icon="list">
            Open problems
          </ButtonLink>
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={3} height={150} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : projects.length === 0 ? (
          <Empty
            icon="box"
            title="No project won yet"
            why="A problem becomes your project when its proposal window closes with your proposal leading. It then appears here, pre-filled with the budget and materials from your document, ready to publish."
            action={
              <ButtonLink href="/college/problems" variant="primary" icon="list">
                Find a problem
              </ButtonLink>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Requirements to publish"
                value={num(counts.unpublished)}
                sub="Nobody can contribute until you do"
                tone={counts.unpublished > 0 ? "alert" : undefined}
              />
              <Stat
                label="Contributions to confirm"
                value={num(counts.toConfirm)}
                sub="Sent to you, not yet confirmed"
                tone={counts.toConfirm > 0 ? "alert" : undefined}
              />
              <Stat
                label="Quiet for a week"
                value={num(counts.quiet)}
                sub="No progress update in 7 days"
                tone={counts.quiet > 0 ? "alert" : undefined}
              />
              <Stat label="Completed" value={num(counts.done)} sub="Every stage done" tone={counts.done > 0 ? "teal" : undefined} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {ordered.map((p) => (
                <Link key={p.id} href={`/college/projects/${p.ref}`} className="up up-hit flex flex-col p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                        {p.ref} · {p.district ?? "—"} · awarded {p.awarded_at ? relative(p.awarded_at) : "—"}
                      </div>
                      <h3 className="mt-1.5 text-[16px] font-bold leading-snug text-navy-dark">{p.title}</h3>
                    </div>
                    <StatusChip status={p.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!p.requirements_published ? (
                      <Chip tone="alert">Publish requirements</Chip>
                    ) : (
                      <Chip tone={p.pct_pledged === 100 ? "teal" : "moderate"}>{p.pct_pledged ?? 0}% pledged</Chip>
                    )}
                    {p.contributions_awaiting_receipt > 0 && (
                      <Chip tone="high">{p.contributions_awaiting_receipt} to confirm</Chip>
                    )}
                    {p.score !== null && <Tag>score {p.score}</Tag>}
                  </div>

                  {p.stages_total > 0 && (
                    <div className="mt-4">
                      <div className="mono flex justify-between text-[10px] uppercase tracking-[0.1em] text-mute">
                        <span>
                          {p.stages_done} of {p.stages_total} stages
                        </span>
                        <span>
                          {p.last_update_at ? `last update ${relative(p.last_update_at)}` : "no update yet"}
                        </span>
                      </div>
                      <Meter value={p.stages_done} max={p.stages_total} height={8} className="mt-2" colour="var(--color-teal)" />
                    </div>
                  )}

                  <span className="mono mt-auto flex items-center gap-1 pt-4 text-[10.5px] uppercase tracking-[0.1em] text-navy">
                    Open the workspace <Icon name="chevRight" size={12} />
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </Main>
    </>
  );
}
