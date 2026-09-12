"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackLink, Main, PageHead } from "@/components/shell/PageHead";
import { Card, Meter, Panel, Stat, Well } from "@/components/ui/Surface";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip, StatusChip, Tag } from "@/components/ui/Chip";
import { Caveat, Empty, ErrorNote, Skeleton } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import * as apiClient from "@/lib/api";
import { useResource } from "@/lib/useResource";
import {
  PLEDGE_STATE_LABEL,
  STAGE_STATUS_LABEL,
  dateOnly,
  dateTime,
  gap,
  humanise,
  num,
  quantity,
  relative,
  rupees,
} from "@/lib/format";
import type { ExecutionStage, ProjectDetail, ProjectNeed, ProjectPledge } from "@/types/database";

/**
 * A project after the award, from one screen.
 *
 * For the college that won it, this is the workspace: publish the funding and
 * materials the project needs (pre-filled from its own proposal), confirm each
 * contribution as it arrives, move the delivery stages drawn from its
 * document, and post progress with photos. For a company or NGO it is the same
 * page read-only: what is still needed, who is giving what, how far the work
 * has got, and how to reach the college.
 */
export function ProjectWorkspace({
  reference,
  backHref,
  backLabel,
}: {
  reference: string;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const res = useResource(() => apiClient.fetchProject(reference), [reference], {
    enabled: Boolean(reference),
  });
  const [fresh, setFresh] = useState<ProjectDetail | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const p = fresh ?? res.data;

  function refresh() {
    setFresh(null);
    res.reload();
  }

  async function messageCollege() {
    if (!p) return;
    if (p.viewer.my_thread_id) {
      router.push(`/messages?thread=${p.viewer.my_thread_id}`);
      return;
    }
    setOpening(true);
    try {
      const t = await apiClient.openThread({ challenge_id: p.challenge.id });
      router.push(`/messages?thread=${t.thread_id}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The conversation could not be opened.");
    } finally {
      setOpening(false);
    }
  }

  if (res.loading && !res.settled && !fresh) {
    return (
      <>
        <BackLink href={backHref} label={backLabel} />
        <Main className="pt-6">
          <Skeleton height={120} rounded={18} />
          <Skeleton height={320} rounded={18} />
        </Main>
      </>
    );
  }

  if (!p) {
    return (
      <>
        <BackLink href={backHref} label={backLabel} />
        <Main className="pt-6">
          <ErrorNote
            message={res.error ?? `No project is filed under ${reference}.`}
            code={res.code}
            onRetry={res.reload}
          />
        </Main>
      </>
    );
  }

  const c = p.challenge;
  const isCollege = p.viewer.is_college;
  const materials = p.needs.filter((n) => n.kind !== "money");
  const awaitingReceipt = p.needs.flatMap((n) => n.pledges).filter((x) => x.can_receive && x.state === "dispatched").length;
  const finished = ["DEPLOYED", "IMPACT_VERIFIED"].includes(c.status);

  return (
    <>
      <BackLink href={backHref} label={backLabel} trail={c.ref} />

      <PageHead
        eyebrow={`${c.ref} · ${[c.block, c.district].filter(Boolean).join(", ") || "district unknown"}`}
        title={c.title}
        lede={c.problem ?? undefined}
        right={
          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={c.status} />
              {p.college && <Tag icon={<Icon name="grad" size={11} />}>{p.college.name}</Tag>}
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/challenge/${c.ref}`} variant="secondary" size="sm" icon="eye">
                The brief
              </ButtonLink>
              {p.proposal.document_url && (
                <a href={p.proposal.document_url} target="_blank" rel="noopener noreferrer" className="btn-2 btn-sm">
                  <Icon name="file" size={14} />
                  Proposal PDF
                </a>
              )}
              {!isCollege && p.college && (
                <Button variant="primary" size="sm" icon="chat" busy={opening} onClick={messageCollege}>
                  Message the college
                </Button>
              )}
            </div>
          </div>
        }
      />

      <Main>
        {notice && (
          <div className="in-s flex items-start justify-between gap-3 p-3.5" role="status">
            <p className="text-[13px] leading-relaxed text-body">{notice}</p>
            <button type="button" className="text-mute" aria-label="Dismiss" onClick={() => setNotice(null)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        {isCollege && !p.requirements_published && (
          <Card depth="in" className="flex items-start gap-3 p-5">
            <span className="mt-0.5 text-alert-ink">
              <Icon name="alert" size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-navy-dark">Next: publish what this project needs</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-body">
                Until you do, no company or NGO can contribute. The form below is pre-filled from the
                budget and bill of materials in your proposal — check it, adjust it, and publish.
              </p>
            </div>
          </Card>
        )}

        {isCollege && awaitingReceipt > 0 && (
          <Card depth="in" className="flex items-start gap-3 p-4">
            <span className="mt-px text-high-ink">
              <Icon name="box" size={16} />
            </span>
            <p className="text-[13px] leading-relaxed text-body">
              <strong className="text-ink">
                {awaitingReceipt} contribution{awaitingReceipt === 1 ? " has" : "s have"} been sent to you.
              </strong>{" "}
              Confirm each one when it arrives — the contributor sees the date you confirm.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat
            label="Proposal score"
            value={p.proposal.score === null ? "—" : `${p.proposal.score}`}
            sub={p.proposal.scored_by === "rules" ? "Rule-based rubric" : "AI reviewer"}
          />
          <Stat
            label="Funding"
            value={p.funding.needed > 0 ? rupees(p.funding.pledged) : "—"}
            sub={p.funding.needed > 0 ? `pledged of ${rupees(p.funding.needed)} · ${rupees(p.funding.received)} received` : "No money requested"}
            tone={p.funding.needed > 0 && p.funding.pledged >= p.funding.needed ? "teal" : undefined}
          />
          <Stat
            label="Materials"
            value={materials.length ? `${p.materials.fully_pledged}/${p.materials.lines}` : "—"}
            sub={materials.length ? `lines covered · ${p.materials.fully_received} received` : "None listed"}
            tone={materials.length > 0 && p.materials.fully_pledged === p.materials.lines ? "teal" : undefined}
          />
          <Stat
            label="Stages done"
            value={p.stages_total ? `${p.stages_done}/${p.stages_total}` : "—"}
            sub={p.progress_pct === null ? "No plan yet" : `${p.progress_pct}% of the plan`}
            tone={finished ? "teal" : undefined}
          />
          <Stat
            label="Last update"
            value={p.cadence.days_since_last_update === null ? "none" : `${num(Math.round(p.cadence.days_since_last_update))}d`}
            sub={
              p.cadence.average_gap_days === null
                ? `${num(p.cadence.updates)} update(s) so far`
                : `every ${p.cadence.average_gap_days} days on average`
            }
            tone={(p.cadence.days_since_last_update ?? 0) >= 7 && !finished ? "alert" : undefined}
          />
        </div>

        {!isCollege && p.college && (
          <Panel title="The college delivering this" depth="in">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[15px] font-bold text-ink">{p.college.name}</div>
                <div className="mono mt-1 text-[11px] text-body">
                  {[p.college.contact_person, p.college.district].filter(Boolean).join(" · ")}
                </div>
                {p.college.contact_email && (
                  <a href={`mailto:${p.college.contact_email}`} className="mono mt-1 block text-[11.5px] text-navy hover:underline">
                    {p.college.contact_email}
                  </a>
                )}
              </div>
              <Button variant="secondary" size="sm" icon="chat" busy={opening} onClick={messageCollege}>
                {p.viewer.my_thread_id ? "Open your conversation" : "Ask a question"}
              </Button>
            </div>
          </Panel>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="flex flex-col gap-5">
            <Panel
              title="What the project needs"
              lede={
                p.requirements_published
                  ? "Each line can be covered in parts. Money is contributed by NGOs, materials by companies."
                  : isCollege
                    ? "Nothing is published yet."
                    : "The college has not published its requirements yet."
              }
            >
              {isCollege && (!p.requirements_published || !finished) && (
                <RequirementsEditor
                  project={p}
                  reference={c.ref}
                  compact={p.requirements_published}
                  onSaved={(next) => {
                    setFresh(next);
                    setNotice("Requirements published. Companies and NGOs have been told.");
                  }}
                />
              )}

              {p.needs.length === 0 ? (
                !isCollege && (
                  <Empty
                    icon="box"
                    title="No requirements yet"
                    why="Once the college publishes the money and materials it needs, they appear here and on the needs board."
                  />
                )
              ) : (
                <ul className={`flex flex-col gap-3 ${isCollege ? "mt-5" : ""}`}>
                  {p.needs.map((n) => (
                    <NeedBlock
                      key={n.id}
                      need={n}
                      reference={c.ref}
                      isCollege={isCollege}
                      onChanged={refresh}
                      onRemoved={(next) => setFresh(next)}
                    />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Progress updates"
              lede="Posted by the college as the work goes. The time between updates is what the system owner watches."
            >
              {isCollege && !["IMPACT_VERIFIED"].includes(c.status) && (
                <UpdateComposer project={p} reference={c.ref} onPosted={(next) => setFresh(next)} />
              )}
              {p.updates.length === 0 ? (
                <p className={`text-[13px] leading-relaxed text-body ${isCollege ? "mt-4" : ""}`}>
                  No progress update has been posted yet.
                </p>
              ) : (
                <ol className={`flex flex-col ${isCollege ? "mt-5" : ""}`}>
                  {p.updates.map((u, i) => {
                    const older = p.updates[i + 1];
                    const gapHours = older
                      ? (new Date(u.created_at).getTime() - new Date(older.created_at).getTime()) / 3_600_000
                      : null;
                    const stage = p.stages.find((s) => s.id === u.stage_id);
                    return (
                      <li key={u.id} className={`py-3.5 ${i > 0 ? "hairline" : ""}`}>
                        <div className="mono flex flex-wrap items-center gap-x-2 text-[9.5px] uppercase tracking-[0.08em] text-mute">
                          <span>{dateTime(u.created_at)} IST</span>
                          {u.author && (
                            <>
                              <span>·</span>
                              <span>{u.author}</span>
                            </>
                          )}
                          {stage && (
                            <>
                              <span>·</span>
                              <span>stage {stage.seq}</span>
                            </>
                          )}
                          <span className={(gapHours ?? 0) > 168 ? "font-semibold text-alert-ink" : ""}>
                            · {gapHours === null ? "first update" : gap(gapHours).replace("later", "after the previous")}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">{u.note}</p>
                        {u.photos.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {u.photos.map((ph) => (
                              <a key={ph.path} href={ph.url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={ph.url} alt="Progress photo" className="h-[72px] w-[100px] rounded-lg object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>
          </div>

          <aside className="flex flex-col gap-5">
            <Panel
              title="Delivery stages"
              lede={
                p.stages.length
                  ? "Drawn from the winning proposal. Starting, finishing or blocking a stage posts an update too."
                  : undefined
              }
            >
              {p.stages.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-body">
                  No stages were generated for this project.
                </p>
              ) : (
                <ol className="flex flex-col gap-2.5">
                  {p.stages.map((s) => (
                    <StageItem
                      key={s.id}
                      stage={s}
                      reference={c.ref}
                      editable={isCollege && !finished}
                      onSaved={(next) => setFresh(next)}
                    />
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="Timeline" depth="in">
              <dl className="flex flex-col">
                <Row label="Reported" value={dateOnly(c.created_at)} />
                <Row label="Verified" value={c.verified_at ? dateOnly(c.verified_at) : "—"} />
                <Row label="Awarded" value={c.awarded_at ? dateOnly(c.awarded_at) : "—"} />
                <Row label="Work complete" value={c.deployed_at ? dateOnly(c.deployed_at) : "—"} />
                <Row
                  label="Longest gap between updates"
                  value={p.cadence.longest_gap_days === null ? "—" : `${p.cadence.longest_gap_days} days`}
                />
              </dl>
            </Panel>

            {isCollege && p.threads.length > 0 && (
              <Panel title="Conversations with contributors" depth="in">
                <ul className="flex flex-col gap-2">
                  {p.threads.map((t) => (
                    <li key={t.id}>
                      <Link href={`/messages?thread=${t.id}`} className="up-s up-hit flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-ink">{t.contributor?.name ?? "Contributor"}</div>
                          <div className="mono mt-0.5 text-[10px] text-mute">
                            {t.contributor?.contact_email ?? ""}
                            {t.last_message_at ? ` · ${relative(t.last_message_at)}` : ""}
                          </div>
                        </div>
                        <Icon name="chevRight" size={14} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {p.proposal.summary && (
              <Panel title="What the reviewer said about the plan" depth="in">
                <p className="text-[13px] leading-relaxed text-body">{p.proposal.summary}</p>
              </Panel>
            )}
          </aside>
        </div>
      </Main>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="hairline flex items-baseline justify-between gap-3 py-2 first:border-t-0">
      <dt className="mono text-[10px] uppercase tracking-[0.1em] text-mute">{label}</dt>
      <dd className="mono text-right text-[11.5px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

type MaterialRow = { item: string; qty: string; unit: string };

function RequirementsEditor({
  project,
  reference,
  compact,
  onSaved,
}: {
  project: ProjectDetail;
  reference: string;
  compact: boolean;
  onSaved: (next: ProjectDetail) => void;
}) {
  const suggested = project.suggested_requirements;
  const [open, setOpen] = useState(!compact);
  const [funding, setFunding] = useState(
    compact ? "" : suggested.funding_amount ? String(Math.round(suggested.funding_amount)) : "",
  );
  const [rows, setRows] = useState<MaterialRow[]>(
    compact || suggested.materials.length === 0
      ? [{ item: "", qty: "", unit: "units" }]
      : suggested.materials.map((m) => ({ item: m.item, qty: String(m.qty), unit: m.unit })),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanRows = rows
    .map((r) => ({ item: r.item.trim(), qty: Number(r.qty), unit: r.unit.trim() || "units" }))
    .filter((r) => r.item && r.qty > 0);
  const amount = Number(funding);
  const valid = (Number.isFinite(amount) && amount > 0) || cleanRows.length > 0;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiClient.publishRequirements(reference, {
        funding_amount: amount > 0 ? amount : null,
        materials: cleanRows,
        note: note.trim() || undefined,
      });
      onSaved(next);
      if (compact) {
        setOpen(false);
        setFunding("");
        setRows([{ item: "", qty: "", unit: "units" }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The requirements were not published.");
    } finally {
      setBusy(false);
    }
  }

  if (compact && !open) {
    return (
      <Button variant="secondary" size="sm" icon="plus" onClick={() => setOpen(true)}>
        Add another requirement
      </Button>
    );
  }

  return (
    <div className="in p-4 sm:p-5">
      {!compact && (suggested.funding_amount || suggested.materials.length > 0) && (
        <p className="mb-3 text-[12.5px] leading-relaxed text-body">
          Pre-filled from your proposal document. Nothing is published until you press publish.
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
          Funding needed, in rupees (for NGOs)
        </span>
        <input
          className="field max-w-[260px]"
          type="number"
          min={0}
          inputMode="numeric"
          value={funding}
          onChange={(e) => setFunding(e.target.value)}
          placeholder="200000"
        />
        {amount > 0 && <span className="mono text-[11px] text-navy">{rupees(amount)}</span>}
      </label>

      <div className="mt-4">
        <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
          Materials needed (for companies)
        </span>
        <div className="mt-2 flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_90px_100px_36px] gap-2">
              <input
                className="field"
                value={r.item}
                placeholder="Galvanised steel"
                aria-label="Material"
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))}
              />
              <input
                className="field"
                type="number"
                min={0}
                step="any"
                value={r.qty}
                placeholder="10"
                aria-label="Quantity"
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
              />
              <input
                className="field"
                value={r.unit}
                placeholder="kg"
                aria-label="Unit"
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}
              />
              <button
                type="button"
                aria-label="Remove this material"
                className="up-s up-hit grid h-full place-items-center rounded-xl text-mute"
                onClick={() => setRows((prev) => (prev.length === 1 ? [{ item: "", qty: "", unit: "units" }] : prev.filter((_, j) => j !== i)))}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-2 btn-sm mt-2"
          onClick={() => setRows((prev) => [...prev, { item: "", qty: "", unit: "units" }])}
        >
          <Icon name="plus" size={13} />
          Add a material
        </button>
      </div>

      <label className="mt-4 flex flex-col gap-2">
        <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-mute">
          A note for contributors — optional
        </span>
        <textarea
          className="field min-h-[64px]"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Steel must be galvanised; delivery to the BIT Mesra workshop, Ranchi."
        />
      </label>

      {error && <p className="mt-3 text-[12.5px] leading-relaxed text-alert-ink">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button variant="primary" icon="check" busy={busy} disabled={!valid} onClick={save}>
          {compact ? "Add these lines" : "Publish requirements"}
        </Button>
        {compact && (
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function NeedBlock({
  need,
  reference,
  isCollege,
  onChanged,
  onRemoved,
}: {
  need: ProjectNeed;
  reference: string;
  isCollege: boolean;
  onChanged: () => void;
  onRemoved: (next: ProjectDetail) => void;
}) {
  const money = need.kind === "money";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      onRemoved(await apiClient.removeRequirement(reference, need.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That line could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="up-s p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Tag icon={<Icon name={money ? "wallet" : "box"} size={11} />}>{money ? "Funding" : "Material"}</Tag>
            {need.qty_remaining <= 0 ? (
              <Chip tone="teal">Fully pledged</Chip>
            ) : (
              <Chip tone="moderate">{quantity(need.qty_remaining, need.unit, need.kind)} still open</Chip>
            )}
          </div>
          <h4 className="mt-2 text-[15px] font-bold text-navy-dark">{need.item}</h4>
        </div>
        <div className="text-right">
          <div className="mono text-[16px] font-semibold text-ink">{quantity(need.qty_needed, need.unit, need.kind)}</div>
          <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-mute">needed</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <div className="mono flex justify-between text-[10px] uppercase tracking-[0.08em] text-mute">
            <span>pledged</span>
            <span>{need.pct_pledged}%</span>
          </div>
          <Meter value={need.pct_pledged} height={7} className="mt-1" />
        </div>
        <div>
          <div className="mono flex justify-between text-[10px] uppercase tracking-[0.08em] text-mute">
            <span>received</span>
            <span>{need.pct_received}%</span>
          </div>
          <Meter value={need.pct_received} height={7} colour="var(--color-teal)" className="mt-1" />
        </div>
      </div>

      {need.pledges.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {need.pledges.map((pl) => (
            <PledgeLine key={pl.id} pledge={pl} onChanged={onChanged} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12.5px] text-mute">Nobody has pledged against this line yet.</p>
      )}

      {isCollege && need.can_remove && (
        <div className="mt-3">
          <Button variant="secondary" size="sm" icon="trash" busy={busy} onClick={remove}>
            Remove this line
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-[12.5px] text-alert-ink">{error}</p>}
    </li>
  );
}

function PledgeLine({ pledge, onChanged }: { pledge: ProjectPledge; onChanged: () => void }) {
  const [mode, setMode] = useState<"none" | "receive" | "dispatch">("none");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tone = pledge.state === "received" ? "teal" : pledge.state === "dispatched" ? "high" : pledge.state === "withdrawn" ? "alert" : "neutral";

  async function act() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "receive") await apiClient.receivePledge(pledge.id, { receipt_note: text.trim() || undefined });
      if (mode === "dispatch") {
        await apiClient.dispatchPledge(pledge.id, {
          expected_delivery_date: date || undefined,
          note: text.trim() || undefined,
        });
      }
      setMode("none");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="in-s p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[13px] font-semibold text-ink">{pledge.org?.name ?? "An organisation"}</span>
          <span className="mono ml-2 text-[12px] text-navy">{pledge.amount}</span>
        </div>
        <Chip tone={tone}>{PLEDGE_STATE_LABEL[pledge.state] ?? humanise(pledge.state)}</Chip>
      </div>
      <div className="mono mt-1.5 text-[10px] text-mute">
        pledged {dateOnly(pledge.created_at)}
        {pledge.expected_delivery_date ? ` · expected ${dateOnly(pledge.expected_delivery_date)}` : ""}
        {pledge.dispatched_at ? ` · sent ${dateOnly(pledge.dispatched_at)}` : ""}
        {pledge.received_at ? ` · received ${dateOnly(pledge.received_at)}` : ""}
      </div>
      {pledge.note && <p className="mt-1.5 text-[12px] leading-relaxed text-body">{pledge.note}</p>}
      {pledge.receipt_note && (
        <p className="mt-1 text-[12px] leading-relaxed text-teal-ink">College noted: {pledge.receipt_note}</p>
      )}
      {pledge.org?.contact_email && (
        <p className="mono mt-1 text-[10px] text-mute">
          {[pledge.org.contact_person, pledge.org.contact_email].filter(Boolean).join(" · ")}
        </p>
      )}

      {mode === "none" && (pledge.can_receive || pledge.can_dispatch || pledge.thread_id) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pledge.can_receive && (
            <Button variant="primary" size="sm" icon="check" onClick={() => setMode("receive")}>
              Confirm received
            </Button>
          )}
          {pledge.can_dispatch && (
            <Button variant="primary" size="sm" icon="upload" onClick={() => setMode("dispatch")}>
              Mark sent
            </Button>
          )}
          {pledge.thread_id && (
            <ButtonLink href={`/messages?thread=${pledge.thread_id}`} variant="secondary" size="sm" icon="chat">
              Conversation
            </ButtonLink>
          )}
        </div>
      )}

      {mode !== "none" && (
        <div className="mt-2 flex flex-col gap-2">
          {mode === "dispatch" && (
            <input className="field max-w-[200px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Expected delivery date" />
          )}
          <input
            className="field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === "receive" ? "Received in full at the workshop, good condition." : "Dispatched by truck from Ranchi."}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" icon="check" busy={busy} onClick={act}>
              {mode === "receive" ? "Confirm it arrived" : "Confirm it was sent"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMode("none")}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-alert-ink">{error}</p>}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Stages and updates
// ---------------------------------------------------------------------------

function StageItem({
  stage,
  reference,
  editable,
  onSaved,
}: {
  stage: ExecutionStage;
  reference: string;
  editable: boolean;
  onSaved: (next: ProjectDetail) => void;
}) {
  const [target, setTarget] = useState<"in_progress" | "done" | "blocked" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tone = stage.status === "done" ? "teal" : stage.status === "blocked" ? "alert" : stage.status === "in_progress" ? "moderate" : "neutral";

  async function save() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await apiClient.updateStage(reference, stage.id, { status: target, note: note.trim() || undefined }));
      setTarget(null);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The stage was not updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`${stage.status === "done" ? "press" : "up-s"} p-3.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mono mt-0.5 flex-none text-[11px] font-semibold text-mute">{String(stage.seq).padStart(2, "0")}</span>
          <div className="min-w-0">
            <h4 className="text-[13.5px] font-bold leading-snug text-navy-dark">{stage.title}</h4>
            {stage.definition_of_done && (
              <p className="mt-1 text-[12px] leading-relaxed text-body">
                <span className="mono text-[9px] uppercase tracking-[0.1em] text-mute">done when </span>
                {stage.definition_of_done}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <Chip tone={tone}>{STAGE_STATUS_LABEL[stage.status] ?? humanise(stage.status)}</Chip>
          <span className="mono text-[9.5px] text-mute">{stage.expected_days}d planned</span>
        </div>
      </div>
      {(stage.started_at || stage.completed_at) && (
        <p className="mono mt-1.5 text-[9.5px] uppercase tracking-[0.08em] text-mute">
          {stage.started_at ? `started ${dateOnly(stage.started_at)}` : ""}
          {stage.completed_at ? ` · done ${dateOnly(stage.completed_at)}` : ""}
        </p>
      )}

      {editable && stage.status !== "done" && !target && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {stage.status !== "in_progress" && (
            <Button variant="secondary" size="sm" icon="play" onClick={() => setTarget("in_progress")}>
              Start
            </Button>
          )}
          <Button variant="primary" size="sm" icon="check" onClick={() => setTarget("done")}>
            Mark done
          </Button>
          {stage.status !== "blocked" && (
            <Button variant="secondary" size="sm" icon="pause" onClick={() => setTarget("blocked")}>
              Blocked
            </Button>
          )}
        </div>
      )}

      {target && (
        <div className="mt-2.5 flex flex-col gap-2">
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={target === "blocked" ? "Waiting for the steel to arrive." : "What was done — contributors see this."}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" busy={busy} onClick={save}>
              Save: {STAGE_STATUS_LABEL[target]}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setTarget(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-alert-ink">{error}</p>}
    </li>
  );
}

function UpdateComposer({
  project,
  reference,
  onPosted,
}: {
  project: ProjectDetail;
  reference: string;
  onPosted: (next: ProjectDetail) => void;
}) {
  const [note, setNote] = useState("");
  const [stageId, setStageId] = useState("");
  const [photos, setPhotos] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of Array.from(files).slice(0, 10 - photos.length)) {
        const stored = await apiClient.uploadPhoto(f, "progress", project.challenge.id);
        setPhotos((prev) => [...prev, { path: stored.path, url: stored.url }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function post() {
    setBusy(true);
    setError(null);
    try {
      onPosted(
        await apiClient.postProgressUpdate(reference, {
          note: note.trim(),
          stage_id: stageId || null,
          photo_paths: photos.map((p) => p.path),
        }),
      );
      setNote("");
      setStageId("");
      setPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The update was not posted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="in p-4">
      <textarea
        className="field min-h-[80px]"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Site survey finished at Karra Toli: shelter location agreed with the gram sabha."
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {project.stages.length > 0 && (
          <select className="field max-w-[260px]" value={stageId} onChange={(e) => setStageId(e.target.value)} aria-label="Stage">
            <option value="">Not about one stage</option>
            {project.stages.map((s) => (
              <option key={s.id} value={s.id}>
                Stage {s.seq}: {s.title}
              </option>
            ))}
          </select>
        )}
        <label className="btn-2 btn-sm cursor-pointer">
          <Icon name="camera" size={13} />
          {uploading ? "Uploading…" : "Add photos"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <Button variant="primary" size="sm" icon="send" busy={busy} disabled={note.trim().length < 5 || uploading} onClick={post}>
          Post update
        </Button>
      </div>
      {photos.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {photos.map((ph) => (
            <button
              key={ph.path}
              type="button"
              title="Remove"
              onClick={() => setPhotos((prev) => prev.filter((x) => x.path !== ph.path))}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt="To attach" className="h-[56px] w-[80px] rounded-lg object-cover" />
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-[12.5px] text-alert-ink">{error}</p>}
      <div className="mt-3">
        <Caveat icon="info">Contributors are notified of every update. Photo location data is stripped.</Caveat>
      </div>
    </div>
  );
}

export function ProjectCaveat() {
  return (
    <Well small>
      <p className="text-[12px] leading-relaxed text-body">
        Progress is the college&rsquo;s own stage record, not a percentage anyone invented.
      </p>
    </Well>
  );
}
