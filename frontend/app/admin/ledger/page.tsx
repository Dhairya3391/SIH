"use client";

import React from "react";
import { RouteGuard } from "@/components/shell/RouteGuard";
import { Main, PageHead } from "@/components/shell/PageHead";
import { Card, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ErrorNote, SkeletonStats } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { num } from "@/lib/format";

/**
 * The impact ledger.
 *
 * Every consequential action appends a row whose hash includes the previous
 * row's hash. This page walks the whole chain and recomputes it, which is the
 * honest version of the transparency claim: it gives tamper evidence without
 * the cost of a blockchain and without pretending to be one.
 */
export default function LedgerPage() {
  return (
    <RouteGuard>
      <Ledger />
    </RouteGuard>
  );
}

function Ledger() {
  const res = useResource(() => apiClient.verifyLedger(), []);
  const d = res.data;

  return (
    <>
      <PageHead
        eyebrow="System owner"
        title="Impact ledger"
        lede="Every consequential action appends a row, and every row's hash includes the one before it. Recomputing the chain proves nothing has been edited after the fact — including by an administrator."
        right={
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="primary"
              icon="refresh"
              busy={res.loading && res.settled}
              onClick={res.reload}
            >
              Re-verify the chain
            </Button>
            <ButtonLink href="/admin" variant="secondary" icon="back">
              Command centre
            </ButtonLink>
          </div>
        }
      />

      <Main>
        {res.loading && !res.settled ? (
          <SkeletonStats count={2} />
        ) : res.error ? (
          <ErrorNote message={res.error} code={res.code} onRetry={res.reload} />
        ) : !d ? null : (
          <>
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span
                    className={`up-s grid h-14 w-14 flex-none place-items-center ${
                      d.ok ? "text-teal-ink" : "text-alert-ink"
                    }`}
                  >
                    <Icon name={d.ok ? "check" : "alert"} size={24} />
                  </span>
                  <div>
                    <h2 className="text-[22px] font-extrabold text-navy-dark">
                      {d.ok ? "The chain is intact" : "The chain is broken"}
                    </h2>
                    <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-body">
                      {d.explanation}
                    </p>
                  </div>
                </div>
                <Chip tone={d.ok ? "teal" : "alert"}>
                  {d.ok ? "Verified" : "Tamper detected"}
                </Chip>
              </div>

              {d.broken_at && (
                <Well className="mt-5">
                  <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-alert-ink">
                    first entry that does not recompute
                  </div>
                  <p className="mono mt-1.5 break-all text-[13px] text-ink">{d.broken_at}</p>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-body">
                    Everything after this entry is suspect, because each hash is computed from the
                    one before it. This is the point to investigate, not the whole ledger.
                  </p>
                </Well>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Entries checked"
                value={num(d.entries_checked)}
                sub="Recomputed from the genesis row forward"
              />
              <Stat
                label="Result"
                value={d.ok ? "Intact" : "Broken"}
                sub={d.ok ? "Every hash matches" : "A hash mismatch was found"}
                tone={d.ok ? "teal" : "alert"}
              />
              <Stat
                label="Append-only"
                value="Enforced"
                sub="A Postgres trigger blocks UPDATE and DELETE"
              />
              <Stat
                label="Blockchain"
                value="No"
                sub="A hash chain in Postgres, and we say so"
              />
            </div>

            <Panel
              title="What this does and does not prove"
              lede="Worth being precise about, because 'blockchain-backed' is the easiest claim in this space to overstate."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="up-s p-4">
                  <div className="mono flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-ink">
                    <Icon name="check" size={12} />
                    It does prove
                  </div>
                  <ul className="mt-2.5 flex flex-col gap-2 text-[12.5px] leading-relaxed text-body">
                    <li>No row was edited after it was written — an edit breaks its own hash.</li>
                    <li>No row was deleted from the middle — the chain would not join up.</li>
                    <li>
                      The order of events is fixed, so the gap between two steps cannot be
                      rewritten to look better.
                    </li>
                  </ul>
                </div>
                <div className="in-s p-4">
                  <div className="mono flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                    <Icon name="info" size={12} />
                    It does not prove
                  </div>
                  <ul className="mt-2.5 flex flex-col gap-2 text-[12.5px] leading-relaxed text-body">
                    <li>
                      That what was written was true. A ledger records that a verifier confirmed
                      something, not that they were right.
                    </li>
                    <li>
                      Distributed consensus. There is one database, and the state runs it — which
                      is appropriate here and honest to say.
                    </li>
                    <li>
                      That the whole chain could not be replaced wholesale by someone with
                      superuser access to the database.
                    </li>
                  </ul>
                </div>
              </div>
            </Panel>
          </>
        )}
      </Main>
    </>
  );
}
