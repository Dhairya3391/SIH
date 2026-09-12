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
import { VERDICT_LABEL, bandOf, hours, humanise, num, relative } from "@/lib/format";
import type { VerifyQueueItem } from "@/types/database";

/**
 * The verification queue.
 *
 * Ordered by what is blocking, not by what arrived last: an unverified report
 * with a high score holds up everything downstream, because no college can
 * propose against a problem nobody has confirmed exists.
 *
 * The AI corroboration verdict is shown on every row, and it is never
 * presented as a decision — a row that says "supports" still needs a person.
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
        lede="Each of these is a claim with evidence attached. Your job is to weigh the evidence and decide — the AI checks sit beside the citizen's own words, and they never decide for you."
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
                label="Outside proof found"
                value={num(counts.supports)}
                sub="Weather, news or web supports the claim"
                tone={counts.supports > 0 ? "teal" : undefined}
              />
              <Stat
                label="Never checked"
                value={num(counts.unchecked)}
                sub="No corroboration has been run yet"
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
                  ["supports", `Supported (${counts.supports})`],
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
                    ? "Every report in this district has been verified or rejected. New reports appear here within a minute of being filed."
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
              title="How verification changes things"
              lede="The confidence ladder is what colleges and funders read, so each rung has to mean something specific."
              depth="in"
            >
              <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-body">
                <li>
                  <strong className="text-ink">Confirm</strong> needs at least one source and a
                  note. It moves the problem to field verified and unblocks the proposal stage.
                </li>
                <li>
                  <strong className="text-ink">Reject</strong> needs a reason, which the reporter
                  can see. A rejected report is not deleted — the record of it, and of why, stays.
                </li>
                <li>
                  <strong className="text-ink">Corroborate</strong> asks the model to search
                  weather archives, news and the open web. It can only reach{" "}
                  <em>externally corroborated</em>, never field verified.
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
              {VERDICT_LABEL[verdict ?? ""] ?? humanise(verdict ?? "")}
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
