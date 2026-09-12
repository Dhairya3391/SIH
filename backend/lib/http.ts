import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { HttpError } from "@/lib/supabase/server";

/**
 * One response shape for every route, so the frontend never has to guess.
 *
 *   success: { ok: true,  data: ... }
 *   failure: { ok: false, error: { message, code, details? } }
 *
 * Errors carry a message written for a person, because several of them end up
 * on screen: "Closure needs a beneficiary count" is more useful to a
 * coordinator than a 422.
 */

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { message: string; code: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(
  status: number,
  message: string,
  code = "error",
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json({ ok: false as const, error: { message, code, details } }, { status });
}

/**
 * Wraps a route handler so no thrown error ever escapes as an HTML stack trace.
 * Supabase errors are translated, because an RLS refusal reads as an empty
 * result or a 42501 and both should say "you are not allowed to do that".
 */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return fail(error.status, error.message, "http_error", error.details);
      }
      if (error instanceof ZodError) {
        return fail(400, "Some fields are missing or invalid.", "validation", error.issues);
      }
      if (isPostgrestError(error)) {
        if (error.code === "42501" || error.code === "PGRST301") {
          return fail(403, "Your role is not allowed to do that.", "forbidden");
        }
        if (error.code === "23505") {
          return fail(409, "That already exists.", "conflict", error.details);
        }
        return fail(400, error.message, `pg_${error.code ?? "unknown"}`, error.details);
      }
      console.error("[jharsetu] unhandled route error", error);
      return fail(500, "Something went wrong on our side.", "internal");
    }
  };
}

function isPostgrestError(e: unknown): e is { code?: string; message: string; details?: unknown } {
  return Boolean(e && typeof e === "object" && "message" in e && "code" in e);
}

/** Parses and validates a JSON body. */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body.");
  }
  return schema.parse(body);
}

/** Parses and validates query-string parameters. */
export function readQuery<T>(request: Request, schema: ZodType<T>): T {
  const url = new URL(request.url);
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    raw[key] = values.length > 1 ? values : values[0];
  }
  return schema.parse(raw);
}

/**
 * Very small in-memory rate limiter, per key.
 *
 * Honest about what it is: it lives in one server process, so it is a speed
 * bump for a hackathon prototype, not a real defence. At production scale this
 * moves to Postgres or a gateway. It is here because the SMS path must be
 * rate-limited per number, and that rule should exist in code, not only on a
 * slide.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

/** Phone numbers are stored hashed, for rate limiting and repeat detection only. */
export async function hashPhone(phone: string): Promise<string> {
  const salt = process.env.SMS_INBOUND_SECRET ?? "jharsetu";
  const data = new TextEncoder().encode(`${salt}:${phone.replace(/\D/g, "")}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
