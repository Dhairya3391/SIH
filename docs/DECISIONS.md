# Decisions

Short record so nobody re-argues these at hour 14.

## 1. The backend in `backend/` is the source of truth

It has the intake pipeline, the Challenge Compiler with its rule-based
fallback, dedup, priority, matching, readiness, lifecycle, the ledger, RLS and
the migrations. The frontend's `app/api/*` routes are a demo stand-in from
hour 1 and will be deleted once the backend is deployed.

Deleted as duplicates:

- `backend/src/lib/fallback.ts` - superseded by `backend/lib/ai/fallback.ts`
- `backend/supabase/seed/*`, `backend/scripts/seed.ts` - superseded by
  `backend/lib/seed/*` and `backend/scripts/seed-demo.ts`
- `backend/supabase/migrations/001_initial_schema.sql` - superseded by the eight
  four-digit migrations

## 2. One origin, not two

The frontend does **not** use `NEXT_PUBLIC_API_URL` or `credentials: "include"`.
Instead `frontend/next.config.ts` rewrites `/api/*` to `BACKEND_ORIGIN`, so the
browser only ever talks to the frontend's own origin.

Why: the session is a Supabase cookie and RLS is evaluated against the signed-in
user. Across two domains that cookie is third-party, which Safari blocks today
and Chrome is phasing out. A judge's browser would silently fall back to an
anonymous session. Same-origin also removes CORS entirely.

`CORS_ALLOWED_ORIGINS` in the backend stays as a fallback for direct calls.

- `BACKEND_ORIGIN` unset -> the frontend's demo routes answer (seeded data).
- `BACKEND_ORIGIN` set -> the real backend answers. No page changes needed:
  `frontend/lib/api.ts` normalises both `{ success, data }` and `{ ok, data }`
  envelopes and both field namings.

## 3. Still needed to switch the demo onto the real backend

1. `SUPABASE_DB_URL` in `backend/.env.local` (database password from Supabase >
   Settings > Database > Connection string).
2. `npm run db:reset` from the repo root - runs the eight migrations and seeds.
   This drops what the hour-1 schema created.
3. Deploy `backend/` as its own Vercel project (Root Directory `backend`).
4. Set `BACKEND_ORIGIN` on the frontend project to that deployment URL.
