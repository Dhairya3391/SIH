import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Two jobs, both of which exist because the backend is its own app.
 *
 * 1. Refresh the Supabase session cookie. Without this a Server Component
 *    cannot write the refreshed cookie back and the session quietly expires
 *    mid-demo.
 *
 * 2. Cross-origin headers. The UI runs on port 3000 and this API on 3001, so
 *    every browser call is cross-origin and carries a session cookie. That
 *    rules out a wildcard: `Access-Control-Allow-Origin` has to name the exact
 *    origin whenever credentials are allowed.
 *
 * This does no authorisation of its own. That is row-level security's job, in
 * Postgres, where hiding a button cannot substitute for it.
 */

/** Dev origins are allowed by default; production origins come from the env. */
const DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function allowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
}

function applyCors(response: NextResponse, origin: string | null): NextResponse {
  if (!origin) return response;
  if (!allowedOrigins().includes(origin)) return response;

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "content-type, authorization, x-jharsetu-secret, x-demo-reset-secret, demo-reset-secret, demo_reset_secret",
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  // The allowed origin varies per request, so caches must key on it.
  response.headers.set("Vary", "Origin");
  return response;
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Preflight never needs a session, so answer it before touching Supabase.
  if (request.method === "OPTIONS") {
    return applyCors(new NextResponse(null, { status: 204 }), origin);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  await supabase.auth.getUser();
  return applyCors(response, origin);
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
