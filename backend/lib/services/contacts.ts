import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Who to contact at an organisation.
 *
 * A company deciding whether to send steel needs a person at the college, not
 * just a department name. The organisation's own contact_email wins; when it
 * has none, the first account attached to the organisation is used, with that
 * account's sign-in email. Only ever shown to signed-in partners on the same
 * challenge, never on a public screen.
 */

export interface OrgContact {
  id: string;
  name: string;
  type: string;
  district: string | null;
  contact_email: string | null;
  contact_person: string | null;
}

export async function orgContacts(
  supabase: SupabaseClient,
  orgIds: Array<string | null | undefined>,
): Promise<Map<string, OrgContact>> {
  const ids = [...new Set(orgIds.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, OrgContact>();
  if (ids.length === 0) return out;

  const [{ data: orgs }, { data: members }] = await Promise.all([
    supabase.from("organizations").select("id, name, type, district, contact_email").in("id", ids),
    supabase
      .from("users")
      .select("id, full_name, org_id, role, created_at")
      .in("org_id", ids)
      .order("created_at", { ascending: true }),
  ]);

  const firstMember = new Map<string, { id: string; full_name: string | null }>();
  for (const m of members ?? []) {
    const key = m.org_id as string;
    if (!firstMember.has(key)) {
      firstMember.set(key, { id: m.id as string, full_name: (m.full_name as string) ?? null });
    }
  }

  const admin = supabaseAdmin();
  for (const o of orgs ?? []) {
    const member = firstMember.get(o.id as string) ?? null;
    let email = (o.contact_email as string | null) ?? null;
    if (!email && member) {
      const { data } = await admin.auth.admin.getUserById(member.id);
      email = data?.user?.email ?? null;
    }
    out.set(o.id as string, {
      id: o.id as string,
      name: o.name as string,
      type: o.type as string,
      district: (o.district as string | null) ?? null,
      contact_email: email,
      contact_person: member?.full_name ?? null,
    });
  }
  return out;
}
