"use client";

import React, { useMemo, useState } from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat } from "@/components/ui/Surface";
import { Toggle } from "@/components/ui/Button";
import { Chip, Tag } from "@/components/ui/Chip";
import { Empty, ErrorNote, SkeletonRows, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { ChallengeRow } from "@/components/domain/ChallengeRow";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useNow } from "@/lib/useNow";
import { VERDICT_LABEL, bandOf, hours, humanise, num, relative, truncate } from "@/lib/format";
import type { AiVerifiedItem, VerifyQueueItem } from "@/types/database";

/**
 * The verification desk.
 *
 * When a report arrives the AI looks for independent proof on its own. What
 * it verifies goes straight to colleges; what it cannot is here, ordered by
 * what is blocking - an unverified report with a high score holds up
 * everything downstream, because no college can propose against a problem
 * nobody has confirmed exists.
 *
 * The problems the AI verified are listed below the queue for audit: a
 * verifier can still reject one that does not stand.
 */
export default function VerifyPage() {
  return (
    <RouteGuard>
      <VerifyQueue />
    </RouteGuard>
  );
}

type Lens = "all" | "supports" | "inconclusive" | "unchecked";

function VerifyQueue() {
  const [district, setDistrict] = useState<string>("");
  const [lens, setLens] = useState<Lens>("all");
  const now = useNow();

  const res = useResource(
    () => apiClient.fetchVerifyQueue({ district: district || undefined, limit: 60 }),
    [district],
  );

  // Memoised so an unresolved fetch does not hand every useMemo below a
  // brand-new empty array on each render.
  const queue = useMemo(() => res.data?.queue ?? [], [res.data]);
  const aiVerified = useMemo(() => res.data?.recently_verified_by_ai ?? [], [res.data]);

  const districts = useMemo(
    () => [...new Set(queue.map((q) => q.district).filter(Boolean) as string[])].sort(),
    [queue],
  );

  const counts = useMemo(() => {
    const supports = queue.filter((q) => q.external?.verdict === "supports").length;
    const contradicts = queue.filter((q) => q.external?.verdict === "contradicts").length;
    const unchecked = queue.filter((q) => !q.external?.checked).length;
    const oldest =
      now === null
        ? null
        : queue.reduce<number | null>((worst, q) => {
            const age = (now - new Date(q.created_at).getTime()) / 3_600_000;
            return worst === null || age > worst ? age : worst;
          }, null);
    return { supports, contradicts, unchecked, oldest };
  }, [queue, now]);

  const shown = useMemo(() => {
    const rows =
      lens === "all"
        ? queue
        : lens === "unchecked"
          ? queue.filter((q) => !q.external?.checked)
          : queue.filter((q) => q.external?.verdict === lens);
    // Highest score first: the queue is a work order, not a feed.
    return rows.slice().sort((a, b) => b.priority - a.priority);
  }, [queue, lens]);

  return (
    <>
      <PageHead
        eyebrow="Verifier"
        title="What needs a person to look at it"
        lede="The AI has already searched weather records, news and the web for these and could not confirm them on its own. Weigh what it found beside the citizen's words, then confirm with sources or photos — or reject with a reason the reporter will read."
        right={
          <div className="flex items-center gap-2.5">
            <select
              className="field max-w-[210px]"
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
          </div>
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <>
            <SkeletonStats />
            <SkeletonRows rows={5} height={120} />
          </>
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Waiting on you"
                value={num(queue.length)}
                sub={district ? `In ${district}` : "Across Jharkhand"}
              />
              <Stat
                label="Verified by AI"
                value={num(aiVerified.length)}
                sub="In the last 14 days, from cited sources"
                tone={aiVerified.length > 0 ? "teal" : undefined}
              />
              <Stat
                label="Never checked"
                value={num(counts.unchecked)}
                sub="Not disaster-type, or the check has not run"
                tone={counts.unchecked > 0 ? "alert" : undefined}
              />
              <Stat
                label="Oldest in queue"
                value={hours(counts.oldest)}
                sub={
                  now === null
                    ? "Measuring"
                    : counts.oldest === null
                      ? "Nothing waiting"
                      : "Since the first report came in"
                }
                tone={(counts.oldest ?? 0) > 48 ? "alert" : undefined}
              />
            </div>

            {counts.contradicts > 0 && (
              <Card depth="in" className="flex items-start gap-3 p-4">
                <span className="mt-px text-alert-ink">
                  <Icon name="alert" size={16} />
                </span>
                <p className="text-[13px] leading-relaxed text-body">
                  <strong className="text-ink">
                    {counts.contradicts} report{counts.contradicts === 1 ? "" : "s"} contradicted by
                    an outside source.
                  </strong>{" "}
                  Contradicted does not mean false — a weather record can miss a local
                  cloudburst. It means the disagreement has to be resolved by a person before the
                  problem goes any further.
                </p>
              </Card>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", `Everything (${queue.length})`],
                  ["supports", `Some support (${counts.supports})`],
                  ["inconclusive", "Inconclusive"],
                  ["unchecked", `Unchecked (${counts.unchecked})`],
                ] as [Lens, string][]
              ).map(([key, label]) => (
                <Toggle key={key} active={lens === key} onClick={() => setLens(key)}>
                  {label}
                </Toggle>
              ))}
            </div>

            {shown.length === 0 ? (
              <Empty
                icon="check"
                title={queue.length === 0 ? "The queue is empty" : "Nothing matches that filter"}
                why={
                  queue.length === 0
                    ? "Every report has been verified — by the AI or a person — or rejected. New reports that the AI cannot confirm appear here within a minute of being filed."
                    : "Every report is here, just not under this lens. Switch back to Everything to see the full queue."
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {shown.map((item) => (
                  <QueueRow key={item.id} item={item} />
                ))}
              </div>
            )}

            <Panel
              title="Verified by the AI in the last two weeks"
              lede="These found independent, cited proof and opened to colleges without waiting for a person. Open any that look wrong — you can still reject one until a college is awarded the work."
            >
              {aiVerified.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-body">
                  Nothing was verified automatically in the last fortnight. Either no disaster-type
                  reports arrived, or the outside records did not confirm them — in which case they
                  are in the queue above.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {aiVerified.map((item) => (
                    <AiRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="How verification works"
              lede="The confidence ladder is what colleges and funders read, so each rung has to mean something specific."
              depth="in"
            >
              <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-body">
                <li>
                  <strong className="text-ink">The AI checks first.</strong> For a disaster-type
                  report it searches the weather at that place and time, the news and the web. A
                  supporting verdict with cited sources verifies it immediately.
                </li>
                <li>
                  <strong className="text-ink">Confirm</strong> needs a note and at least one
                  source or photo. The problem becomes field verified and opens to colleges.
                </li>
                <li>
                  <strong className="text-ink">Reject</strong> needs a reason, which the reporter
                  is sent. A rejected report is not deleted — the record of it, and of why, stays.
                </li>
              </ul>
            </Panel>
          </>
        )}
      </Main>
    </>
  );
}

function QueueRow({ item }: { item: VerifyQueueItem }) {
  const verdict = item.external?.verdict;
  const checked = Boolean(item.external?.checked);

  return (
    <ChallengeRow
      href={`/verify/${item.id}`}
      reference={item.ref}
      title={item.title}
      district={item.district}
      block={item.block}
      category={item.category}
      priority={item.priority}
      band={bandOf(item.priority)}
      people={item.people_est}
      reports={item.report_count}
      reporters={item.reporter_count}
      confidence={item.confidence}
      hazards={item.hazard_tags}
      right={
        <>
          {checked ? (
            <Chip
              tone={
                verdict === "supports" ? "teal" : verdict === "contradicts" ? "alert" : "high"
              }
            >
              AI: {VERDICT_LABEL[verdict ?? ""] ?? humanise(verdict ?? "")}
            </Chip>
          ) : (
            <Chip tone="neutral">Not checked</Chip>
          )}
          {checked && (item.external?.citation_count ?? 0) > 0 && (
            <Tag>{item.external!.citation_count} citations</Tag>
          )}
          <span className="mono text-[10px] uppercase tracking-[0.08em] text-mute">
            filed {relative(item.created_at)}
          </span>
        </>
      }
      note={
        item.why_critical ? (
          <p className="text-[12.5px] leading-relaxed text-body">{item.why_critical}</p>
        ) : null
      }
    />
  );
}

function AiRow({ item }: { item: AiVerifiedItem }) {
  return (
    <ChallengeRow
      href={`/verify/${item.id}`}
      reference={item.ref}
      title={item.title}
      district={item.district}
      block={item.block}
      category={item.category}
      priority={item.priority}
      band={bandOf(item.priority)}
      people={item.people_est}
      reports={item.report_count}
      reporters={item.reporter_count}
      confidence={item.confidence}
      status={item.status}
      hazards={item.hazard_tags}
      right={
        <>
          <Chip tone="teal">AI verified</Chip>
          <Tag>
            {item.ai_verification.sources.length} source
            {item.ai_verification.sources.length === 1 ? "" : "s"}
          </Tag>
          <span className="mono text-[10px] uppercase tracking-[0.08em] text-mute">
            {relative(item.ai_verification.at)}
          </span>
        </>
      }
      note={
        item.ai_verification.note ? (
          <p className="text-[12.5px] leading-relaxed text-body">
            {truncate(item.ai_verification.note, 240)}
          </p>
        ) : null
      }
    />
  );
}
