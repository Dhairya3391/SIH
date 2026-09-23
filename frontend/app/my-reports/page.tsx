"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat, Well } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { BandChip, Chip, ConfidenceChip, StatusChip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useAuth } from "@/lib/auth";
import { listLocalReports, type LocalReport } from "@/lib/localReports";
import { CHANNEL_LABEL, bandOf, dateTime, num, relative, truncate } from "@/lib/format";
import type { MyReport } from "@/types/database";

/**
 * What this person filed, and what happened to it.
 *
 * Two sources, kept visibly separate rather than blended: the account's own
 * reports from the server, and whatever this browser filed anonymously. The
 * second list says out loud that it is device-local, because a citizen who
 * clears their browser and finds the list gone deserves to have been warned
 * rather than to conclude the report was thrown away.
 */
export default function MyReportsPage() {
  return (
    <RouteGuard allowAnonymous>
      <MyReportsConsole />
    </RouteGuard>
  );
}

function MyReportsConsole() {
  const { isAuthenticated } = useAuth();
  const mine = useResource(
    () => (isAuthenticated ? apiClient.fetchMyReports() : Promise.resolve({ reports: [], count: 0 })),
    [isAuthenticated],
  );
  const [local, setLocal] = useState<LocalReport[]>([]);

  // Read once, after the commit. localStorage is a browser store, not React
  // state, so the read is deferred to a task rather than run synchronously
  // inside the effect body.
  useEffect(() => {
    const id = setTimeout(() => setLocal(listLocalReports()), 0);
    return () => clearTimeout(id);
  }, []);

  const reports = mine.data?.reports ?? [];
  const serverIds = new Set(reports.map((r) => r.id));
  const localOnly = local.filter((l) => !serverIds.has(l.report_id));

  const inProgress = reports.filter(
    (r) => r.challenge && !["DEPLOYED", "IMPACT_VERIFIED"].includes(String(r.challenge.status)),
  ).length;
  const done = reports.filter(
    (r) => r.challenge && ["DEPLOYED", "IMPACT_VERIFIED"].includes(String(r.challenge.status)),
  ).length;
  const verified = reports.filter((r) => r.challenge?.verified_at).length;

  return (
    <>
      <PageHead
        eyebrow="My reports"
        title="What you have told us"
        lede="Every report you filed, and what the district did with it. A report that merged into a bigger problem is not a report that was ignored — it is the reason that problem outranks others."
        right={
          <ButtonLink href="/report" variant="primary" icon="mic">
            Report something
          </ButtonLink>
        }
      />

      <Main>
        {mine.loading && !mine.settled ? (
          <SkeletonRows rows={3} height={120} />
        ) : mine.error ? (
          <>
            <ErrorNote message={mine.error} code={mine.code} onRetry={mine.reload} />
            {localOnly.length > 0 && <LocalList rows={localOnly} />}
          </>
        ) : !isAuthenticated ? (
          <>
            <div className="in flex items-start gap-3 p-5 sm:p-6">
              <span className="mt-1 text-moderate">
                <Icon name="info" size={18} />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-navy-dark">
                  Sign in to see the reports filed from your account
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-body">
                  A report filed without an account can still be followed through the
                  reference number you were given.
                </p>
                <div className="mt-4">
                  <ButtonLink href="/login" variant="secondary" size="sm" icon="login">
                    Sign in
                  </ButtonLink>
                </div>
              </div>
            </div>
            {localOnly.length > 0 && <LocalList rows={localOnly} />}
          </>
        ) : reports.length === 0 && localOnly.length === 0 ? (
          <Empty
            icon="mic"
            title="You have not filed anything yet"
            why="When you report a problem it appears here with its reference number, and you can follow it through verification, a college's proposal, and the work being done."
            action={
              <ButtonLink href="/report" variant="primary" icon="mic">
                Report a problem
              </ButtonLink>
            }
          />
        ) : (
          <>
            {reports.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat
                    label="Reports filed"
                    value={num(reports.length)}
                    sub="From this account"
                  />
                  <Stat
                    label="Being worked on"
                    value={num(inProgress)}
                    sub="Compiled, verified or in a pilot"
                  />
                  <Stat
                    label="Verified"
                    value={num(verified)}
                    sub="A verifier confirmed the problem"
                    tone="teal"
                  />
                  <Stat
                    label="Delivered"
                    value={num(done)}
                    sub={done === 0 ? "Nothing finished yet" : "Deployed or impact verified"}
                    tone={done > 0 ? "teal" : undefined}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  {reports.map((r) => (
                    <ReportRow key={r.id} report={r} />
                  ))}
                </div>
              </>
            )}

            {localOnly.length > 0 && <LocalList rows={localOnly} />}
          </>
        )}
      </Main>
    </>
  );
}

function ReportRow({ report }: { report: MyReport }) {
  const c = report.challenge;
  const said = report.original_text ?? report.translated_text ?? null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-[0.1em] text-mute">
            <span>{dateTime(report.created_at)} IST</span>
            <span>·</span>
            <span>via {CHANNEL_LABEL[report.channel] ?? report.channel}</span>
            {report.has_audio && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="mic" size={11} /> voice
                </span>
              </>
            )}
            {report.photo_count > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="camera" size={11} /> {report.photo_count}
                </span>
              </>
            )}
          </div>

          {said && (
            <Well small className="mt-3">
              <p className="text-[13.5px] leading-relaxed text-ink">{truncate(said, 260)}</p>
              {report.translated_text &&
                report.original_text &&
                report.translated_text !== report.original_text && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-body">
                    <span className="mono text-[10px] uppercase tracking-[0.1em] text-mute">
                      read as{" "}
                    </span>
                    {truncate(report.translated_text, 200)}
                  </p>
                )}
            </Well>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(report.village || report.district) && (
              <Tag icon={<Icon name="pin" size={11} />}>
                {[report.village, report.district].filter(Boolean).join(", ")}
              </Tag>
            )}
            {report.people_est ? <Tag>{num(report.people_est)} people</Tag> : null}
            {report.vulnerable.map((v) => (
              <Tag key={v}>{v}</Tag>
            ))}
          </div>
        </div>

        <div className="flex flex-none flex-col items-start gap-2 sm:items-end">
          {!c ? (
            <Chip tone="neutral" title="The compiler has not linked this to a problem yet">
              Being read
            </Chip>
          ) : (
            <>
              <BandChip band={bandOf(c.priority)} />
              <StatusChip status={c.status} />
              <ConfidenceChip confidence={c.confidence} />
            </>
          )}
        </div>
      </div>

      {c ? (
        <Link
          href={`/challenge/${c.ref}`}
          className="up-s up-hit mt-4 flex items-center justify-between gap-3 p-4"
        >
          <div className="min-w-0">
            <div className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
              {c.ref} · {c.report_count === 1 ? "only your report" : `${num(c.report_count)} reports`}
              {report.dedup_similarity !== null
                ? ` · matched at ${Math.round(report.dedup_similarity * 100)}%`
                : ""}
            </div>
            <div className="mt-1 truncate text-[14.5px] font-bold text-navy-dark">{c.title}</div>
            <div className="mono mt-1 text-[10.5px] text-mute">
              priority {c.priority}/100 · last moved {relative(c.updated_at)}
            </div>
          </div>
          <span className="flex-none text-navy">
            <Icon name="chevRight" size={16} />
          </span>
        </Link>
      ) : (
        <div className="in mt-4 p-4">
          <p className="text-[12.5px] leading-relaxed text-body">
            This report has been stored but not yet attached to a problem. That happens when the
            compiler is still running, or when it was held for a person to decide whether it is
            the same as something already open.
          </p>
        </div>
      )}
    </Card>
  );
}

function LocalList({ rows }: { rows: LocalReport[] }) {
  return (
    <Panel
      title="Filed from this device without signing in"
      lede="Kept in this browser only. The reference numbers are the durable copy — clearing site data removes this list, not the reports."
      depth="in"
    >
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <Link
            key={r.report_id}
            href={`/challenge/${r.challenge_ref}`}
            className="up-s up-hit flex items-center justify-between gap-3 p-4"
          >
            <div className="min-w-0">
              <div className="mono text-[10.5px] uppercase tracking-[0.1em] text-mute">
                {r.challenge_ref} · {dateTime(r.filed_at)} · {r.decision}
                {[r.village, r.district].filter(Boolean).length > 0
                  ? ` · ${[r.village, r.district].filter(Boolean).join(", ")}`
                  : ""}
              </div>
              <div className="mt-1 truncate text-[13.5px] font-semibold text-ink">
                {truncate(r.text, 120)}
              </div>
            </div>
            <div className="flex flex-none items-center gap-2">
              {r.priority !== null && <BandChip band={bandOf(r.priority)} />}
              <span className="text-navy">
                <Icon name="chevRight" size={15} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
