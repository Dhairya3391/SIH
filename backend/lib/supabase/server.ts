import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/domain/types";

/**
 * The request-scoped client. Everything a signed-in person does goes through
 * here, so row-level security applies to their actual role. This is what makes
 * the honest answer to "what if someone calls the API directly?" possible.
 *
 * Auth priority:
 *   1. Supabase SSR cookie (browser sessions via the frontend rewrite)
 *   2. Authorization: Bearer <jwt> header (smoke test and direct API callers)
 *
 * The Bearer fallback is important for the smoke test: @supabase/ssr cookies
 * have SameSite=Lax and the Secure flag, which prevents them from being
 * replayed by a Node.js script calling the deployed API directly.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function supabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const authHeader = headerStore.get("authorization") ?? "";
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware instead.
        }
      },
    },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });

  return client;
}


export interface Actor {
  id: string;
  role: UserRole;
  orgId: string | null;
  regionId: string;
  district: string | null;
  language: string;
  fullName: string | null;
}

/** The signed-in person and their platform role, or null when anonymous. */
export async function currentActor(): Promise<Actor | null> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  const supabase = await supabaseServer();
  const { data: auth, error: authError } = await (token
    ? supabase.auth.getUser(token)
    : supabase.auth.getUser());

  if (authError || !auth?.user) return null;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("users")
    .select("id, role, org_id, region_id, district, language, full_name")
    .eq("id", auth.user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    role: data.role as UserRole,
    orgId: data.org_id,
    regionId: data.region_id,
    district: data.district,
    language: data.language,
    fullName: data.full_name,
  };
}

export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new HttpError(401, "Sign in to do that.");
  return actor;
}

export async function requireRole(...roles: UserRole[]): Promise<Actor> {
  const actor = await requireActor();
  if (!roles.includes(actor.role)) {
    throw new HttpError(403, `This action needs one of: ${roles.join(", ")}. You are a ${actor.role}.`);
  }
  return actor;
}

/** Thrown by route handlers, turned into a JSON response by lib/http.ts. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
