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

---

## 4. Reads go through the service-role client (2026-09-12)

**Symptom.** Submitting a report on the live site returned `is_fallback: false`
and the row really landed in Postgres — but the queue never changed. The queue
always showed exactly the ten seeded challenges.

**Cause.** Row-level security is on for `challenges` / `reports` in the hour-1
schema and there is no `SELECT` policy for the `anon` role. Proof:

```
anon    GET /rest/v1/challenges?id=eq.CH-GUM-001  ->  []
service GET /rest/v1/challenges?id=eq.CH-GUM-001  ->  [{"report_count":32}]
```

Every helper in `frontend/lib/supabase.ts` treats "no rows" as "database not
available" and silently returns `SEED_CHALLENGES`. So the UI was reading the
in-repo seed file while the writes were going to Postgres.

**Fix.** All reads now go through `supabaseAdmin ?? supabase`, the same
server-only service-role client the write path uses, and read errors are
logged instead of swallowed. This is safe because `SUPABASE_SERVICE_ROLE_KEY`
has no `NEXT_PUBLIC_` prefix and `lib/supabase.ts` is imported only from
`app/api/*` — the key is never sent to the browser.

**If you ever need to read from the browser directly**, add read policies
instead of shipping the key:

```sql
alter table challenges enable row level security;
create policy "public read" on challenges for select to anon using (true);
create policy "public read" on reports    for select to anon using (true);
```

## 5. GitHub -> Vercel auto-deploy (still needs a human)

`vercel git connect https://github.com/Dhairya3391/SIH` fails with
*"Make sure there aren't any typos and that you have access to the
repository"*. The Vercel account that owns the project (`icecreambs15-5606`,
team *Kahan's projects*) cannot see the repo, because the Vercel GitHub App
is not installed on `Dhairya3391/SIH`.

To finish it, in the browser:

1. https://vercel.com/kahans-projects-7eb033b5/jharsetu/settings/git ->
   **Connect Git Repository** -> GitHub -> `Dhairya3391/SIH`.
   If the repo is not listed, click *Adjust GitHub App Permissions* and grant
   access to it (the repo owner may have to approve).
2. Same settings page -> **Root Directory** -> set it to `frontend`.
   This is mandatory: CLI deploys are run from `frontend/`, but a Git deploy
   builds from the repo root, where there is no `package.json`.
3. Production Branch: `main`.

Until that is done, ship with:

```
cd frontend && npx vercel --prod --yes
npx vercel alias set <the-new-url> jharsetu-lilac.vercel.app
```

The alias step is required — `jharsetu-lilac.vercel.app` is not the project's
default production domain.
