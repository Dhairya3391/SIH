import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError, type Actor } from "@/lib/supabase/server";
import { fileUrl } from "@/lib/storage";
import { appendLedger } from "./ledger";
import { notifyOrgs, notifyReporters, notifyRoles } from "./notify";
import { formatAmount } from "./swarm";
import { orgContacts } from "./contacts";

/**
 * A project: a verified problem after a college won it.
 *
 *   1. the college publishes what it needs - money and materials - pre-filled
 *      from its own proposal document
 *   2. companies and NGOs pledge parts of it; the college confirms receipt
 *   3. the college works through the delivery stages drawn from its document,
 *      posting progress updates as it goes
 *   4. the last stage done marks the work complete and asks the reporters to
 *      confirm the fix
 *
 * Every step is written to the ledger with its date, which is what lets the
 * admin console show the gap between one progress update and the next.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveChallengeId(supabase: SupabaseClient, idOrRef: string): Promise<string> {
  const isUuid = UUID.test(idOrRef);
  const { data } = await supabase
    .from("challenges")
    .select("id")
    .eq(isUuid ? "id" : "ref", isUuid ? idOrRef : idOrRef.toUpperCase())
    .maybeSingle();
  if (!data) throw new HttpError(404, "No such challenge.");
  return data.id as string;
}

async function winner(supabase: SupabaseClient, challengeId: string) {
  const { data } = await supabase
    .from("proposals")
    .select(
      "id, org_id, author_id, version, ai_score, ai_verdict, ai_rubric, ai_model, funding_required, currency, duration_days, document_name, document_path, submitted_at, scored_at",
    )
    .eq("challenge_id", challengeId)
    .eq("state", "winner")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** The winning college, or an admin. Anyone else is refused with a reason. */
async function requireCollege(supabase: SupabaseClient, actor: Actor, challengeId: string) {
  const proposal = await winner(supabase, challengeId);
  if (!proposal) throw new HttpError(409, "This problem has not been awarded to a college yet.");
  if (actor.role !== "admin" && actor.orgId !== proposal.org_id) {
    throw new HttpError(403, "Only the college that won this problem can do that.");
  }
  return proposal;
}

async function contributorOrgIds(supabase: SupabaseClient, challengeId: string): Promise<string[]> {
  const { data: needs } = await supabase.from("resource_needs").select("id").eq("challenge_id", challengeId);
  const ids = (needs ?? []).map((n) => n.id as string);
  if (!ids.length) return [];
  const { data: pledges } = await supabase
    .from("pledges")
    .select("org_id, state, status")
    .in("need_id", ids);
  return [
    ...new Set(
      (pledges ?? [])
        .filter((p) => ((p.state as string) ?? (p.status as string)) !== "withdrawn")
        .map((p) => p.org_id as string),
    ),
  ];
}

const days = (from: string | null | undefined, to: string | number = Date.now()) =>
  from ? Math.round(((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) * 10) / 10 : null;

/** Everything a project page needs, for the college, a contributor or the admin. */
export async function loadProject(supabase: SupabaseClient, challengeId: string, viewer: Actor | null) {
  const { data: challenge } = await supabase
    .from("challenges")
    .select(
      "id, ref, title, district, block, category, status, priority, severity, people_est, confidence, brief, created_at, verified_at, team_formed_at, deployed_at, closed_at, region_id",
    )
    .eq("id", challengeId)
    .maybeSingle();
  if (!challenge) throw new HttpError(404, "No such challenge.");

  const proposal = await winner(supabase, challengeId);
  if (!proposal) throw new HttpError(409, "This problem has not been awarded to a college yet.");

  const [{ data: window }, { data: stages }, { data: needs }, { data: updates }, { data: threads }] =
    await Promise.all([
      supabase.from("proposal_windows").select("*").eq("challenge_id", challengeId).maybeSingle(),
      supabase.from("progress_stages").select("*").eq("challenge_id", challengeId).order("seq"),
      supabase
        .from("resource_needs")
        .select("id, item, qty_needed, unit, kind, capability, created_at")
        .eq("challenge_id", challengeId)
        .order("created_at"),
      supabase
        .from("progress_updates")
        .select("id, stage_id, author_id, note, photo_paths, created_at")
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: false }),
      supabase
        .from("threads")
        .select("id, college_org_id, contributor_org_id, last_message_at")
        .eq("challenge_id", challengeId),
    ]);

  const needIds = (needs ?? []).map((n) => n.id as string);
  const { data: pledges } = needIds.length
    ? await supabase
        .from("pledges")
        .select(
          "id, need_id, org_id, qty, kind, state, status, note, expected_delivery_date, dispatched_at, received_at, receipt_note, created_at",
        )
        .in("need_id", needIds)
        .order("created_at")
    : { data: [] as Record<string, unknown>[] };

  const contacts = await orgContacts(supabase, [
    proposal.org_id as string,
    ...(pledges ?? []).map((p) => p.org_id as string),
  ]);

  const authorIds = [...new Set((updates ?? []).map((u) => u.author_id).filter(Boolean))] as string[];
  const { data: authors } = authorIds.length
    ? await supabase.from("users").select("id, full_name").in("id", authorIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const authorName = new Map((authors ?? []).map((a) => [a.id as string, (a.full_name as string) ?? null]));

  const isCollege = Boolean(viewer && (viewer.orgId === proposal.org_id || viewer.role === "admin"));
  const stateOf = (p: Record<string, unknown>) => ((p.state as string) ?? (p.status as string) ?? "offered").toString();

  const needRows = (needs ?? []).map((n) => {
    const mine = (pledges ?? []).filter((p) => p.need_id === n.id && stateOf(p) !== "withdrawn");
    const pledged = mine.reduce((s, p) => s + Number(p.qty), 0);
    const received = mine.filter((p) => stateOf(p) === "received").reduce((s, p) => s + Number(p.qty), 0);
    const needed = Number(n.qty_needed);
    return {
      id: n.id as string,
      item: n.item as string,
      unit: n.unit as string,
      kind: n.kind as string,
      qty_needed: needed,
      qty_pledged: pledged,
      qty_received: received,
      qty_remaining: Math.max(needed - pledged, 0),
      pct_pledged: needed > 0 ? Math.min(100, Math.round((pledged / needed) * 100)) : 100,
      pct_received: needed > 0 ? Math.min(100, Math.round((received / needed) * 100)) : 100,
      created_at: n.created_at as string,
      can_remove: isCollege && mine.length === 0,
      pledges: (pledges ?? [])
        .filter((p) => p.need_id === n.id)
        .map((p) => {
          const state = stateOf(p);
          const org = contacts.get(p.org_id as string);
          return {
            id: p.id as string,
            org: org ?? null,
            qty: Number(p.qty),
            amount: formatAmount(Number(p.qty), n.unit as string, n.kind as string),
            state,
            note: (p.note as string) ?? null,
            expected_delivery_date: (p.expected_delivery_date as string) ?? null,
            created_at: p.created_at as string,
            dispatched_at: (p.dispatched_at as string) ?? null,
            received_at: (p.received_at as string) ?? null,
            receipt_note: (p.receipt_note as string) ?? null,
            can_receive: isCollege && state !== "received" && state !== "withdrawn",
            can_dispatch: Boolean(viewer && viewer.orgId === p.org_id) && (state === "offered" || state === "committed"),
            thread_id:
              (threads ?? []).find((t) => t.contributor_org_id === p.org_id)?.id ?? null,
          };
        }),
    };
  });

  const money = needRows.filter((n) => n.kind === "money");
  const materials = needRows.filter((n) => n.kind !== "money");
  const stageRows = stages ?? [];
  const done = stageRows.filter((s) => s.status === "done").length;

  // The cadence of progress updates: the admin console's "time between updates".
  const ascending = [...(updates ?? [])].sort(
    (a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime(),
  );
  const gaps = ascending.slice(1).map((u, i) => days(ascending[i].created_at as string, u.created_at as string) ?? 0);
  const lastUpdate = ascending.at(-1)?.created_at as string | undefined;

  const rubric = (proposal.ai_rubric ?? {}) as {
    summary?: string;
    source?: string;
    extraction?: { funding_required?: number | null; duration_days?: number | null; materials?: Array<{ item: string; qty: number | null; unit: string | null }> };
  };

  const collegeContact = contacts.get(proposal.org_id as string) ?? null;

  return {
    challenge: {
      id: challenge.id as string,
      ref: challenge.ref as string,
      title: challenge.title as string,
      district: (challenge.district as string) ?? null,
      block: (challenge.block as string) ?? null,
      category: challenge.category as string,
      status: challenge.status as string,
      priority: challenge.priority as number,
      severity: challenge.severity as number,
      people_est: challenge.people_est as number,
      confidence: challenge.confidence as string,
      problem: ((challenge.brief ?? {}) as { problem?: string }).problem ?? null,
      created_at: challenge.created_at as string,
      verified_at: (challenge.verified_at as string) ?? null,
      awarded_at: (window?.closed_at as string) ?? (challenge.team_formed_at as string) ?? null,
      deployed_at: (challenge.deployed_at as string) ?? null,
      closed_at: (challenge.closed_at as string) ?? null,
    },
    college: collegeContact,
    proposal: {
      id: proposal.id as string,
      version: proposal.version as number,
      score: (proposal.ai_score as number) ?? null,
      verdict: (proposal.ai_verdict as string) ?? null,
      scored_by: rubric.source === "rules" ? "rules" : "ai",
      summary: rubric.summary ?? null,
      funding_required: (proposal.funding_required as number) ?? null,
      duration_days: (proposal.duration_days as number) ?? null,
      document_name: (proposal.document_name as string) ?? null,
      document_url:
        proposal.document_path && !String(proposal.document_path).startsWith("pending/")
          ? `/api/college/proposals/${proposal.id}/document`
          : null,
      submitted_at: proposal.submitted_at as string,
    },
    // What the college's own document asked for, to pre-fill the requirements form.
    suggested_requirements: {
      funding_amount: rubric.extraction?.funding_required ?? (proposal.funding_required as number) ?? null,
      materials: (rubric.extraction?.materials ?? [])
        .filter((m) => m.item)
        .map((m) => ({ item: m.item, qty: m.qty ?? 1, unit: m.unit ?? "units" })),
    },
    requirements_published: needRows.length > 0,
    needs: needRows,
    funding: {
      needed: money.reduce((s, n) => s + n.qty_needed, 0),
      pledged: money.reduce((s, n) => s + Math.min(n.qty_pledged, n.qty_needed), 0),
      received: money.reduce((s, n) => s + Math.min(n.qty_received, n.qty_needed), 0),
    },
    materials: {
      lines: materials.length,
      fully_pledged: materials.filter((n) => n.qty_remaining <= 0).length,
      fully_received: materials.filter((n) => n.qty_received >= n.qty_needed).length,
    },
    fully_pledged: needRows.length > 0 && needRows.every((n) => n.qty_remaining <= 0),
    fully_received: needRows.length > 0 && needRows.every((n) => n.qty_received >= n.qty_needed),
    stages: stageRows,
    stages_total: stageRows.length,
    stages_done: done,
    progress_pct: stageRows.length ? Math.round((done / stageRows.length) * 100) : null,
    updates: (updates ?? []).map((u) => ({
      id: u.id as string,
      stage_id: (u.stage_id as string) ?? null,
      note: u.note as string,
      author: u.author_id ? (authorName.get(u.author_id as string) ?? null) : null,
      photos: ((u.photo_paths as string[]) ?? []).map((p) => ({ path: p, url: fileUrl(p) })),
      created_at: u.created_at as string,
    })),
    cadence: {
      updates: ascending.length,
      average_gap_days: gaps.length ? Math.round((gaps.reduce((s, g) => s + g, 0) / gaps.length) * 10) / 10 : null,
      longest_gap_days: gaps.length ? Math.max(...gaps) : null,
      days_since_last_update: days(lastUpdate ?? null),
      days_since_award: days((window?.closed_at as string) ?? null),
    },
    threads: (threads ?? []).map((t) => ({
      id: t.id as string,
      contributor: contacts.get(t.contributor_org_id as string) ?? null,
      last_message_at: (t.last_message_at as string) ?? null,
    })),
    viewer: {
      is_college: isCollege,
      my_thread_id: viewer?.orgId ? ((threads ?? []).find((t) => t.contributor_org_id === viewer.orgId)?.id ?? null) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export interface RequirementsInput {
  funding_amount?: number | null;
  materials: Array<{ item: string; qty: number; unit?: string | null }>;
  note?: string | null;
}

export async function publishRequirements(
  supabase: SupabaseClient,
  actor: Actor,
  challengeId: string,
  body: RequirementsInput,
) {
  const proposal = await requireCollege(supabase, actor, challengeId);
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, region_id, status")
    .eq("id", challengeId)
    .single();
  if (!["SOLUTION_PROPOSED", "PILOT"].includes(challenge!.status as string)) {
    throw new HttpError(409, "Requirements can only be changed while the project is being funded or delivered.");
  }

  const wanted: Array<{ item: string; qty_needed: number; unit: string; kind: "money" | "equipment"; capability: string | null }> = [];
  if (body.funding_amount && body.funding_amount > 0) {
    wanted.push({ item: "Project funding", qty_needed: Math.round(body.funding_amount), unit: "INR", kind: "money", capability: "funding" });
  }
  for (const m of body.materials) {
    const item = m.item.replace(/\s+/g, " ").trim();
    if (!item || !(m.qty > 0)) continue;
    wanted.push({ item, qty_needed: m.qty, unit: (m.unit ?? "").trim() || "units", kind: "equipment", capability: null });
  }
  if (!wanted.length) throw new HttpError(400, "Add a funding amount or at least one material with a quantity.");

  const { data: existing } = await supabase
    .from("resource_needs")
    .select("id, item, kind")
    .eq("challenge_id", challengeId);
  const first = (existing ?? []).length === 0;

  const inserts: typeof wanted = [];
  const updated: string[] = [];
  for (const w of wanted) {
    const match = (existing ?? []).find(
      (e) => (e.item as string).toLowerCase() === w.item.toLowerCase() && (e.kind === "money") === (w.kind === "money"),
    );
    if (!match) {
      inserts.push(w);
      continue;
    }
    // The same line again is an edit, not a second line - allowed only while nobody has pledged against it.
    const { count } = await supabase
      .from("pledges")
      .select("id", { count: "exact", head: true })
      .eq("need_id", match.id)
      .neq("state", "withdrawn");
    if (count) {
      throw new HttpError(
        409,
        `"${w.item}" already has contributions against it, so its quantity cannot be changed here. Add a separate line for anything extra.`,
      );
    }
    await supabase.from("resource_needs").update({ qty_needed: w.qty_needed, unit: w.unit }).eq("id", match.id);
    updated.push(w.item);
  }

  if (inserts.length) {
    const { error } = await supabase
      .from("resource_needs")
      .insert(inserts.map((w) => ({ ...w, challenge_id: challengeId, solution_id: null })));
    if (error) throw error;
  }

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: challengeId,
    action: first ? "requirements_published" : "requirements_updated",
    actor: actor.id,
    actorRole: actor.role,
    regionId: challenge!.region_id as string,
    payload: {
      proposal_id: proposal.id,
      funding_amount: body.funding_amount ?? null,
      added: inserts.map((w) => ({ item: w.item, qty: w.qty_needed, unit: w.unit, kind: w.kind })),
      updated,
      note: body.note ?? null,
    },
  });

  if (first) {
    const { data: win } = await supabase
      .from("proposal_windows")
      .select("closed_at")
      .eq("challenge_id", challengeId)
      .maybeSingle();
    if (win?.closed_at) {
      await supabase.rpc("record_timing", {
        p_challenge: challengeId,
        p_stage: "to_requirements",
        p_started: win.closed_at,
        p_ended: new Date().toISOString(),
      });
    }
  }

  // Companies hear about materials; NGOs hear about funding.
  const { data: collegeOrg } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", proposal.org_id)
    .maybeSingle();
  const college = (collegeOrg?.name as string) ?? "A college";
  const addedMoney = inserts.filter((w) => w.kind === "money");
  const addedMaterials = inserts.filter((w) => w.kind !== "money");
  if (addedMoney.length) {
    await notifyRoles(supabase, {
      roles: ["ngo"],
      template: "requirements_published",
      payload: {
        ref: challenge!.ref,
        challenge_id: challengeId,
        college,
        summary: addedMoney.map((w) => formatAmount(w.qty_needed, w.unit, w.kind)).join(", ") + " in funding",
      },
    });
  }
  if (addedMaterials.length) {
    await notifyRoles(supabase, {
      roles: ["industry"],
      template: "requirements_published",
      payload: {
        ref: challenge!.ref,
        challenge_id: challengeId,
        college,
        summary: addedMaterials.map((w) => `${formatAmount(w.qty_needed, w.unit, w.kind)} of ${w.item}`).join(", "),
      },
    });
  }

  return loadProject(supabase, challengeId, actor);
}

export async function removeRequirement(
  supabase: SupabaseClient,
  actor: Actor,
  challengeId: string,
  needId: string,
) {
  await requireCollege(supabase, actor, challengeId);
  const { data: need } = await supabase
    .from("resource_needs")
    .select("id, item, challenge_id")
    .eq("id", needId)
    .maybeSingle();
  if (!need || need.challenge_id !== challengeId) throw new HttpError(404, "No such requirement on this project.");

  const { count } = await supabase
    .from("pledges")
    .select("id", { count: "exact", head: true })
    .eq("need_id", needId)
    .neq("state", "withdrawn");
  if (count) {
    throw new HttpError(
      409,
      "Contributors have already pledged against this line, so it cannot be removed. Talk to them in Messages first.",
    );
  }

  const { error } = await supabase.from("resource_needs").delete().eq("id", needId);
  if (error) throw error;

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: challengeId,
    action: "requirement_removed",
    actor: actor.id,
    actorRole: actor.role,
    payload: { need_id: needId, item: need.item },
  });

  return loadProject(supabase, challengeId, actor);
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

const STAGE_LABEL: Record<string, string> = {
  pending: "not started",
  in_progress: "in progress",
  done: "done",
  blocked: "blocked",
};

async function recordFirstUpdateTiming(supabase: SupabaseClient, challengeId: string) {
  const { count } = await supabase
    .from("progress_updates")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId);
  if (count !== 1) return;
  const { data: win } = await supabase
    .from("proposal_windows")
    .select("closed_at")
    .eq("challenge_id", challengeId)
    .maybeSingle();
  if (!win?.closed_at) return;
  await supabase.rpc("record_timing", {
    p_challenge: challengeId,
    p_stage: "to_first_update",
    p_started: win.closed_at,
    p_ended: new Date().toISOString(),
  });
}

/** The first sign of work moves an awarded project into delivery. */
async function markWorkStarted(supabase: SupabaseClient, challengeId: string, reason: string) {
  const { data: moved } = await supabase
    .from("challenges")
    .update({ status: "PILOT" })
    .eq("id", challengeId)
    .eq("status", "SOLUTION_PROPOSED")
    .select("id, region_id");
  if (moved?.length) {
    await appendLedger(supabase, {
      entity: "challenge",
      entityId: challengeId,
      action: "work_started",
      regionId: moved[0].region_id as string,
      payload: { reason },
    });
  }
}

export async function updateStage(
  supabase: SupabaseClient,
  actor: Actor,
  challengeId: string,
  stageId: string,
  body: { status: "pending" | "in_progress" | "done" | "blocked"; note?: string | null; photo_paths?: string[] },
) {
  await requireCollege(supabase, actor, challengeId);
  const { data: stage } = await supabase
    .from("progress_stages")
    .select("*")
    .eq("id", stageId)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  if (!stage) throw new HttpError(404, "No such stage on this project.");
  if (stage.status === body.status && !body.note && !body.photo_paths?.length) {
    return loadProject(supabase, challengeId, actor);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("progress_stages")
    .update({
      status: body.status,
      started_at:
        (body.status === "in_progress" || body.status === "done") && !stage.started_at ? now : stage.started_at,
      completed_at: body.status === "done" ? now : null,
    })
    .eq("id", stageId);
  if (error) throw error;

  const note = `Stage ${stage.seq}, "${stage.title}", is ${STAGE_LABEL[body.status]}${body.note ? `: ${body.note.trim()}` : "."}`;
  await supabase.from("progress_updates").insert({
    stage_id: stageId,
    challenge_id: challengeId,
    author_id: actor.id,
    note,
    photo_paths: body.photo_paths ?? [],
  });

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref, region_id, status")
    .eq("id", challengeId)
    .single();

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: challengeId,
    action: "stage_updated",
    actor: actor.id,
    actorRole: actor.role,
    regionId: challenge!.region_id as string,
    payload: {
      stage_id: stageId,
      seq: stage.seq,
      title: stage.title,
      from: stage.status,
      to: body.status,
      note: body.note ?? null,
      photos: body.photo_paths?.length ?? 0,
    },
  });
  await recordFirstUpdateTiming(supabase, challengeId);

  if (body.status === "in_progress" || body.status === "done") {
    await markWorkStarted(supabase, challengeId, `stage ${stage.seq} started`);
  }

  const contributors = await contributorOrgIds(supabase, challengeId);
  const { data: all } = await supabase.from("progress_stages").select("status").eq("challenge_id", challengeId);
  const allDone = (all ?? []).length > 0 && (all ?? []).every((s) => s.status === "done");

  if (allDone && !["DEPLOYED", "IMPACT_VERIFIED"].includes(challenge!.status as string)) {
    await supabase.from("challenges").update({ status: "DEPLOYED", deployed_at: now }).eq("id", challengeId);
    await appendLedger(supabase, {
      entity: "challenge",
      entityId: challengeId,
      action: "work_completed",
      actor: actor.id,
      actorRole: actor.role,
      regionId: challenge!.region_id as string,
      payload: { stages: all?.length ?? 0 },
    });
    await notifyReporters(supabase, challengeId, "work_completed", { ref: challenge!.ref });
    await notifyOrgs(supabase, {
      orgIds: contributors,
      template: "project_update",
      payload: { ref: challenge!.ref, challenge_id: challengeId, note: "every delivery stage is complete." },
    });
  } else {
    await notifyOrgs(supabase, {
      orgIds: contributors,
      template: "project_update",
      payload: { ref: challenge!.ref, challenge_id: challengeId, note: note.slice(0, 140) },
    });
  }

  return loadProject(supabase, challengeId, actor);
}

export async function postProgressUpdate(
  supabase: SupabaseClient,
  actor: Actor,
  challengeId: string,
  body: { note: string; stage_id?: string | null; photo_paths: string[] },
) {
  await requireCollege(supabase, actor, challengeId);
  if (body.stage_id) {
    const { data: stage } = await supabase
      .from("progress_stages")
      .select("id")
      .eq("id", body.stage_id)
      .eq("challenge_id", challengeId)
      .maybeSingle();
    if (!stage) throw new HttpError(404, "That stage is not part of this project.");
  }

  const { data: created, error } = await supabase
    .from("progress_updates")
    .insert({
      stage_id: body.stage_id ?? null,
      challenge_id: challengeId,
      author_id: actor.id,
      note: body.note.trim(),
      photo_paths: body.photo_paths,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { data: challenge } = await supabase
    .from("challenges")
    .select("ref, region_id")
    .eq("id", challengeId)
    .single();

  await appendLedger(supabase, {
    entity: "challenge",
    entityId: challengeId,
    action: "progress_update",
    actor: actor.id,
    actorRole: actor.role,
    regionId: challenge!.region_id as string,
    payload: {
      update_id: created.id,
      stage_id: body.stage_id ?? null,
      note: body.note.trim().slice(0, 500),
      photos: body.photo_paths.length,
    },
  });
  await recordFirstUpdateTiming(supabase, challengeId);
  await markWorkStarted(supabase, challengeId, "first progress update");

  await notifyOrgs(supabase, {
    orgIds: await contributorOrgIds(supabase, challengeId),
    template: "project_update",
    payload: { ref: challenge!.ref, challenge_id: challengeId, note: body.note.trim().slice(0, 140) },
  });

  return loadProject(supabase, challengeId, actor);
}

/** Summaries of every project a college has won, for its projects list. */
export async function listCollegeProjects(supabase: SupabaseClient, orgId: string | null, all = false) {
  let q = supabase
    .from("proposals")
    .select("challenge_id, org_id, ai_score, funding_required, submitted_at")
    .eq("state", "winner");
  if (!all) {
    if (!orgId) return [];
    q = q.eq("org_id", orgId);
  }
  const { data: won } = await q;
  const ids = [...new Set((won ?? []).map((w) => w.challenge_id as string))];
  if (!ids.length) return [];

  const [{ data: challenges }, { data: stages }, { data: needs }, { data: updates }, { data: windows }] =
    await Promise.all([
      supabase
        .from("challenges")
        .select("id, ref, title, district, status, priority, people_est, deployed_at, closed_at")
        .in("id", ids),
      supabase.from("progress_stages").select("challenge_id, status").in("challenge_id", ids),
      supabase.from("resource_needs").select("id, challenge_id, qty_needed, kind").in("challenge_id", ids),
      supabase.from("progress_updates").select("challenge_id, created_at").in("challenge_id", ids),
      supabase.from("proposal_windows").select("challenge_id, closed_at").in("challenge_id", ids),
    ]);

  const needIds = (needs ?? []).map((n) => n.id as string);
  const { data: pledges } = needIds.length
    ? await supabase.from("pledges").select("need_id, qty, state, status").in("need_id", needIds)
    : { data: [] as Record<string, unknown>[] };

  const orgNames = await orgContacts(supabase, (won ?? []).map((w) => w.org_id as string));

  return (challenges ?? []).map((c) => {
    const cid = c.id as string;
    const w = (won ?? []).find((x) => x.challenge_id === cid);
    const s = (stages ?? []).filter((x) => x.challenge_id === cid);
    const n = (needs ?? []).filter((x) => x.challenge_id === cid);
    const p = (pledges ?? []).filter((x) => n.some((nn) => nn.id === x.need_id));
    const live = p.filter((x) => ((x.state as string) ?? (x.status as string)) !== "withdrawn");
    const neededTotal = n.reduce((sum, x) => sum + Number(x.qty_needed), 0);
    const perNeedPledged = n.reduce((sum, x) => {
      const got = live.filter((y) => y.need_id === x.id).reduce((a, y) => a + Number(y.qty), 0);
      return sum + Math.min(got, Number(x.qty_needed));
    }, 0);
    const u = (updates ?? [])
      .filter((x) => x.challenge_id === cid)
      .map((x) => x.created_at as string)
      .sort();
    const lastUpdate = u.at(-1) ?? null;
    return {
      id: cid,
      ref: c.ref as string,
      title: c.title as string,
      district: (c.district as string) ?? null,
      status: c.status as string,
      priority: c.priority as number,
      people_est: c.people_est as number,
      college: orgNames.get(w?.org_id as string) ?? null,
      score: (w?.ai_score as number) ?? null,
      awarded_at: ((windows ?? []).find((x) => x.challenge_id === cid)?.closed_at as string) ?? null,
      requirements_published: n.length > 0,
      pct_pledged: neededTotal > 0 ? Math.round((perNeedPledged / neededTotal) * 100) : null,
      contributions_awaiting_receipt: live.filter((x) => (x.state as string) === "dispatched").length,
      stages_total: s.length,
      stages_done: s.filter((x) => x.status === "done").length,
      last_update_at: lastUpdate,
      days_since_update: days(lastUpdate),
    };
  });
}
