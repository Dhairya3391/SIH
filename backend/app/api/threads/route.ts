import { ok, fail, route, readJson } from "@/lib/http";
import { z } from "zod";
import { requireActor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgContacts } from "@/lib/services/contacts";
import { collegeForChallenge, ensureThread } from "@/lib/services/threads";

/**
 * Message threads between a college and one contributing organisation.
 *
 * A thread is always about ONE challenge and between exactly TWO
 * organisations, which keeps it answerable: a company asking "will the steel
 * fit the mounting you designed?" wants the college that designed it, not a
 * broadcast channel. Nobody else can read it - a CSR budget conversation is
 * not public reading. Each side sees the other's contact details.
 */

const createSchema = z.object({
  challenge_id: z.string().uuid(),
  /** Optional: the college side. Derived from the winning proposal when omitted. */
  college_org_id: z.string().uuid().optional(),
  /** Optional: the contributor side. Defaults to the caller's own org. */
  contributor_org_id: z.string().uuid().optional(),
});

/** GET /api/threads - every thread this organisation is a party to. */
export const GET = route(async () => {
  const actor = await requireActor();
  const supabase = supabaseAdmin();
  // Coordinators see every thread for oversight, as observers: the UI keeps
  // their compose box disabled and the server rejects their sends.
  const overseer = actor.role === "admin" || actor.role === "coordinator";

  let query = supabase
    .from("threads")
    .select("id, challenge_id, college_org_id, contributor_org_id, created_at, last_message_at")
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (!overseer) {
    if (!actor.orgId) return ok({ threads: [], count: 0 });
    query = query.or(`college_org_id.eq.${actor.orgId},contributor_org_id.eq.${actor.orgId}`);
  }

  const { data: threads, error } = await query;
  if (error) throw error;
  if (!threads || threads.length === 0) return ok({ threads: [], count: 0 });

  const challengeIds = [...new Set(threads.map((t) => t.challenge_id as string))];
  const contacts = await orgContacts(
    supabase,
    threads.flatMap((t) => [t.college_org_id as string, t.contributor_org_id as string]),
  );

  const [{ data: challenges }, { data: counts }] = await Promise.all([
    supabase.from("challenges").select("id, ref, title, district, status").in("id", challengeIds),
    supabase
      .from("messages")
      .select("thread_id, created_at, read_at, author_org_id")
      .in("thread_id", threads.map((t) => t.id as string)),
  ]);

  const challengeById = new Map((challenges ?? []).map((c) => [c.id as string, c]));

  const rows = threads.map((t) => {
    const msgs = (counts ?? []).filter((m) => m.thread_id === t.id);
    // Unread means: written by the other side, and not yet marked read.
    const unread = msgs.filter((m) => m.author_org_id !== actor.orgId && !m.read_at).length;
    return {
      id: t.id as string,
      challenge: challengeById.get(t.challenge_id as string) ?? null,
      college: contacts.get(t.college_org_id as string) ?? null,
      contributor: contacts.get(t.contributor_org_id as string) ?? null,
      /** Which side the caller is on, so the UI can label "them" correctly. */
      my_side:
        actor.orgId === t.college_org_id
          ? "college"
          : actor.orgId === t.contributor_org_id
            ? "contributor"
            : "observer",
      message_count: msgs.length,
      unread_count: unread,
      created_at: t.created_at as string,
      last_message_at: t.last_message_at as string | null,
    };
  });

  return ok({ threads: rows, count: rows.length });
});

/**
 * POST /api/threads - open the thread for this challenge, or return it.
 *
 * A company or NGO can ask the college a question before deciding to pledge;
 * a college can open one with an organisation that pledged. Idempotent, so
 * "message the college" twice is still one conversation.
 */
export const POST = route(async (request: Request) => {
  const actor = await requireActor();
  const body = await readJson(request, createSchema);
  const supabase = supabaseAdmin();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, ref")
    .eq("id", body.challenge_id)
    .maybeSingle();
  if (!challenge) return fail(404, "No such challenge.", "not_found");

  const collegeOrg = body.college_org_id ?? (await collegeForChallenge(supabase, challenge.id as string));
  if (!collegeOrg) {
    return fail(
      409,
      "No college has been awarded this problem yet, so there is nobody on the other side of the conversation.",
      "no_college",
    );
  }

  // The caller is one of the two sides. A college messaging a contributor must
  // say which one; a contributor is assumed to be itself.
  let contributorOrg = body.contributor_org_id;
  if (!contributorOrg) {
    if (actor.orgId && actor.orgId !== collegeOrg) {
      contributorOrg = actor.orgId;
    } else {
      return fail(400, "Say which contributing organisation this thread is with.", "contributor_required");
    }
  }
  if (contributorOrg === collegeOrg) {
    return fail(400, "A college cannot open a thread with itself.", "same_org");
  }

  if (actor.role !== "admin" && actor.orgId !== collegeOrg && actor.orgId !== contributorOrg) {
    return fail(403, "You are not a party to this conversation.", "not_a_party");
  }

  const thread = await ensureThread(supabase, {
    challengeId: challenge.id as string,
    collegeOrgId: collegeOrg,
    contributorOrgId: contributorOrg,
  });

  return ok({ thread_id: thread.id, created: thread.created }, { status: thread.created ? 201 : 200 });
});
