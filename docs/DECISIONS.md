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

---

## 6. Solutions endpoint: FE reads from the detail response (2026-09-12)

`GET /api/challenges/:id/solutions` was POST-only (HTTP 405 on GET).

**Decision**: the canonical path for the frontend is `GET /api/challenges/:id`
(the full detail endpoint — one round trip, everything the page needs). A
dedicated `GET /api/challenges/:id/solutions` handler now also exists for cases
where only solutions are needed (e.g. the solutions panel rendered on its own).

Both endpoints return the same shape: `{ solutions: [...] }`. docs/API.md lists
both. There is no third data path.

---

## 7. Matches table: used as a write-through cache (2026-09-12)

The `matches` table had 0 rows after the initial seed.

**Decision**: keep the table. It is a write-through cache: when
`GET /api/challenges/:id/matches?refresh=true` (or the first unaided call)
invokes `computeMatches`, the results are upserted into `matches` on conflict
`(challenge_id, org_id)`. Subsequent calls hit the table directly and return
instantly. The coordinator's queue shows the cached score and reasons — the ones
actually shown on screen — rather than recomputing every refresh.

The seed does **not** pre-populate this table. The first call to the matches
endpoint populates it. This is intentional: matches are recomputed against the
live database state, not the state at seed time.

If the database is reset, the table is truncated alongside every other table.

---

## 8. NGO is its own role (2026-09-13)

Companies give materials, NGOs give money, and they see different boards by
default. **Decision**: a separate `ngo` role (migration `0013_ngo_role.sql`)
rather than an `industry` account flagged as an NGO. Until the migration is run
the NGO demo login fails and an admin can pledge on an NGO's behalf (`org_id`).

## 9. Proposal competition window kept, with "award now" (2026-09-13)

The first proposal on a verified problem opens a 2-14 day window (by severity);
the highest-scoring **viable** proposal wins when it closes. If none is viable
the window reopens and the colleges revise using the reviewer's reasons. Admins
and coordinators can close a window early: `POST /api/admin/windows/:id/award`.
A proposal the reviewer marks `not_viable` is rejected to the college with its
required changes. With no AI key, the published rubric rules score instead.

## 10. Dedup without semantic embeddings (2026-09-13)

With no embedding key the local hashing vectoriser scores two differently
worded reports of the same flood around 0.4, so the 0.85/0.75 bars never fired
and nothing was ever combined. **Decision**: when the embedding is local, the
compiled category and GPS distance decide - same category within 1 km in 7 days
merges, within 2 km goes to review. Semantic embeddings keep the original bars.

## 11. Every progress update belongs to a stage (2026-09-13)

`progress_updates.stage_id` is NOT NULL. A general update with no stage is
filed against the stage in progress, else the next one not done, else the last.

## 12. Live end-to-end test (2026-09-13)

`backend/scripts/e2e-flow.ts` walks report -> AI check -> verifier -> PDF
proposal -> award -> requirements -> 5 kg + 5 kg and money pledges -> sent /
received -> messages -> stage + update -> admin record, metrics, assistant ->
public tracking, with role-wall checks. Rows are titled `[E2E TEST]`;
`--cleanup` deletes them and their files. Ledger rows stay (append-only).

## 13. We now train our own models (2026-09-22) — reverses "APIs only"

An earlier objections-handling answer in `context.pdf`'s deck material said
"use APIs and embeddings, measure accuracy on a small labelled set — don't
train our own ML models." **That line is superseded.** Faculty evaluation for
SIH requires original trained work, so we train models on top of — not instead
of — the existing rule-based/API fallback chain. `AI_ENABLED=false` must keep
working exactly as before; a trained model is one more tier in that chain, not
a replacement for it.

Approved, in build order:

1. **Report classifier** (category + hazard + severity) — fine-tuned
   MuRIL/IndicBERT/xlm-roberta, or a TF-IDF + logistic-regression baseline if
   time is short. Trained on the 40 hand-labeled reports + seed data + public
   disaster-tweet corpora (HumAID/CrisisNLP). Slots in alongside the keyword
   rules in `backend/lib/ai/fallback.ts` — report its accuracy against the
   rules and against the LLM on the same held-out set.
2. **Dedup embeddings** — contrastive-fine-tuned multilingual MiniLM
   (`paraphrase-multilingual-MiniLM-L12-v2`), slotting in alongside the hashing
   vectoriser in `backend/lib/ai/local-embed.ts`. Report dedup precision/recall
   at the 0.85 and 0.75 thresholds from Decision 10 above.
3. Stretch, only after 1–2 are done and measured: vulnerability-tag
   extraction, a silent-zone report-expectation model, an evidence-photo
   plausibility check.

Unchanged: still no disaster prediction, still no general chatbot, still
AI-assisted-recommendation-only (human approves, AI never rejects), still must
degrade cleanly with AI keys removed. See `AGENTS.md` §17a for the full note.
`context.pdf` itself still has the old line — it's a compiled export with no
editable source in this repo, so fix it at whatever tool produced it.
