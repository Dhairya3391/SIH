import { ok, fail, route, readJson, rateLimit } from "@/lib/http";
import { z } from "zod";
import { requireActor, type Actor } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const postSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something first.")
    .max(4000, "Keep it under 4000 characters."),
});

/**
 * Messages in one thread.
 *
 * Participants and admin only, checked on the server rather than relied upon
 * from the UI: the whole point of a private thread is that the check is not
 * cosmetic.
 */
async function loadThread(id: string) {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("threads")
    .select("id, challenge_id, college_org_id, contributor_org_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

function isParty(actor: Actor, thread: { college_org_id: string; contributor_org_id: string }) {
  if (actor.role === "admin") return true;
  return actor.orgId === thread.college_org_id || actor.orgId === thread.contributor_org_id;
}

/** GET /api/threads/[id]/messages - the conversation, oldest first. */
export const GET = route(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireActor();
  const { id } = await ctx.params;
  const thread = await loadThread(id);
  if (!thread) return fail(404, "No such thread.", "not_found");
  const party = isParty(actor, thread as never);
  // Coordinators read for oversight; only a party may send (checked on POST).
  if (!party && actor.role !== "coordinator") {
    return fail(403, "You are not a party to this conversation.", "not_a_party");
  }

  const supabase = supabaseAdmin();
  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, author_id, author_org_id, body, created_at, read_at")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const authorIds = [...new Set((messages ?? []).map((m) => m.author_id).filter(Boolean))] as string[];
  const orgIds = [
    ...new Set([thread.college_org_id as string, thread.contributor_org_id as string]),
  ];

  const [{ data: users }, { data: orgs }, { data: challenge }] = await Promise.all([
    authorIds.length > 0
      ? supabase.from("users").select("id, full_name, role").in("id", authorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; role: string }[] }),
    supabase.from("organizations").select("id, name, type").in("id", orgIds),
    supabase
      .from("challenges")
      .select("id, ref, title")
      .eq("id", thread.challenge_id as string)
      .maybeSingle(),
  ]);

  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));
  const orgById = new Map((orgs ?? []).map((o) => [o.id as string, o]));

  // Reading the thread marks the other side's messages read. Doing it here
  // rather than in a separate call means an unread badge cannot get stuck.
  // Observers (coordinators) must not touch read state: their reading is not
  // anyone's "seen".
  const unreadFromThem = (messages ?? []).filter(
    (m) => m.author_org_id !== actor.orgId && !m.read_at,
  );
  if (party && unreadFromThem.length > 0) {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        unreadFromThem.map((m) => m.id as string),
      );
  }

  return ok({
    thread: {
      id: thread.id,
      challenge: challenge ?? null,
      college: orgById.get(thread.college_org_id as string) ?? null,
      contributor: orgById.get(thread.contributor_org_id as string) ?? null,
      my_side:
        actor.orgId === thread.college_org_id
          ? "college"
          : actor.orgId === thread.contributor_org_id
            ? "contributor"
            : "observer",
    },
    messages: (messages ?? []).map((m) => {
      const u = m.author_id ? userById.get(m.author_id as string) : null;
      const o = m.author_org_id ? orgById.get(m.author_org_id as string) : null;
      return {
        id: m.id as string,
        body: m.body as string,
        created_at: m.created_at as string,
        author_name: u?.full_name ?? "Unknown",
        author_role: u?.role ?? "citizen",
        author_org: o?.name ?? null,
        is_self: Boolean(actor.orgId) && m.author_org_id === actor.orgId,
      };
    }),
    count: messages?.length ?? 0,
  });
});

/** POST /api/threads/[id]/messages - say something. */
export const POST = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireActor();
  const { id } = await ctx.params;
  const thread = await loadThread(id);
  if (!thread) return fail(404, "No such thread.", "not_found");
  if (!isParty(actor, thread as never)) {
    return fail(403, "You are not a party to this conversation.", "not_a_party");
  }
  if (!actor.orgId && actor.role !== "admin") {
    return fail(403, "This account has no organisation, so it cannot post.", "no_org");
  }

  // This is the one surface where an authenticated user types free text at
  // volume, so it gets its own limit.
  if (!rateLimit(`msg:${actor.id}`, 30, 60_000)) {
    return fail(429, "Too many messages in the last minute. Please slow down.", "rate_limit");
  }

  const { body } = await readJson(request, postSchema);
  const supabase = supabaseAdmin();

  const { data: created, error } = await supabase
    .from("messages")
    .insert({
      thread_id: id,
      author_id: actor.id,
      author_org_id: actor.orgId,
      body,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;

  await supabase
    .from("threads")
    .update({ last_message_at: created.created_at })
    .eq("id", id);

  // Tell the other side. Without this a question can sit unseen for days and
  // the contributor concludes the platform does not work.
  const otherOrg =
    actor.orgId === thread.college_org_id
      ? (thread.contributor_org_id as string)
      : (thread.college_org_id as string);
  const { data: recipients } = await supabase
    .from("users")
    .select("id")
    .eq("org_id", otherOrg);
  for (const r of recipients ?? []) {
    await supabase.from("notifications").insert({
      user_id: r.id,
      channel: "app",
      template: "thread_message",
      payload: { thread_id: id, challenge_id: thread.challenge_id, preview: body.slice(0, 120) },
    });
  }

  return ok(
    { message_id: created.id, created_at: created.created_at, notified: recipients?.length ?? 0 },
    { status: 201 },
  );
});
