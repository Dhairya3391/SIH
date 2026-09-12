# JharSetu backend API

For the frontend. The backend runs as its own app on **port 3001**, so every
call is cross-origin.

```js
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/challenges`, {
  credentials: "include",   // required: the session is a cookie
})
```

`credentials: "include"` is not optional. Row-level security is evaluated
against the signed-in user, so a call without the cookie is an anonymous call
and will see redacted data or be refused.

Allowed origins default to `http://localhost:3000` and `http://127.0.0.1:3000`.
Add the deployed frontend URL to `CORS_ALLOWED_ORIGINS` in `backend/.env.local`.

## Response shape

Every route answers in one of two shapes. There are no exceptions, so a single
helper can unwrap them all.

```jsonc
{ "ok": true,  "data": { } }
{ "ok": false, "error": { "message": "...", "code": "...", "details": null } }
```

`error.message` is written for a person and is safe to put on screen. For
example a refused closure returns every unmet requirement in one sentence,
rather than failing on one at a time.

Status codes worth handling: `401` not signed in, `403` wrong role,
`422` the action is legal but its preconditions are not met, `429` rate limited.

## Signing in

Six seeded accounts, one per role, and no password is typed on stage.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/demo-login` | `{ role }` | `citizen`, `volunteer`, `coordinator`, `university`, `industry`, `admin` |
| GET | `/api/auth/demo-login` | | who am I right now |

These are real Supabase sessions, not a pretend role flag. That matters: switch
to `university` and the reporter's phone number really is gone and the location
really is fuzzed, because Postgres is enforcing it.

## Reporting

| Method | Path | Notes |
|---|---|---|
| POST | `/api/reports` | JSON, or multipart with a `payload` field plus an `audio` file |
| GET | `/api/reports/:id/trace` | the pipeline trace panel, with real timings |
| POST | `/api/sms/inbound` | the gateway phone posts here, guarded by a shared secret |

`client_id` is required and is the idempotency key. Generate it on the device
and reuse it on every retry, so an offline queue that retries five times files
one report. The response tells you what happened:

```jsonc
{
  "report_id": "...",
  "challenge_id": "...",
  "challenge_ref": "C-104",
  "decision": "merge",          // merge | review | new
  "dedup_reason": "Similarity 0.91 and 0.4 km from C-104.",
  "possible_duplicates": [],    // populated when decision is "review"
  "priority": 82,
  "confidence": "community_corroborated",
  "trace": [{ "step": "compile", "label": "...", "ms": 1840, "usedAi": true }],
  "degraded": false,            // true when any AI step fell back
  "already_received": false
}
```

Anonymous reports are allowed. Someone reporting an unsafe school should not
have to create an account first.

## Challenges

| Method | Path | Notes |
|---|---|---|
| GET | `/api/challenges` | filters: `region_id`, `district`, `category`, `status`, `band`, `mode`, `org_id`, `q`, `limit`, `offset` |
| GET | `/api/challenges/:id` | everything the detail screen needs, in one call |
| GET | `/api/challenges/:id/solutions` | solutions only — prefer the detail endpoint unless you need solutions in isolation |
| GET | `/api/challenges/:id/actions` | what this user may legally do next |
| GET | `/api/challenges/:id/nearby` | registry resources within `radius_km` |
| GET | `/api/challenges/:id/matches` | recommended partners, each with reasons |
| GET | `/api/challenges/:id/gap` | the live Resource Swarm bar |
| GET | `/api/challenges/:id/timeline` | read from the hash-chained ledger |
| GET | `/api/challenges/:id/similar` | the do-not-duplicate library |

The list response carries `redacted: true` for anyone who is not a coordinator
or admin. Those rows carry `geom_fuzzed` instead of exact coordinates. Show the
label; it is a feature, not a limitation.

`band` is the map legend: `critical` 75 and above, `high` 50 to 74,
`moderate` 25 to 49, `long_term` below 25. Every row already carries its `band`.

`/api/challenges/:id/actions` is what drives the single next-action button. Each
entry has `ready` and, when it is not ready, `problems` listing exactly what is
missing.

## Moving a challenge along

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/api/challenges/:id/approve` | coordinator | approves the brief and opens it in one call |
| POST | `/api/challenges/:id/validate` | any signed-in | `field`, `still_exists`, `improved`, `inaccurate`, `more_affected`, `unsuitable` |
| POST | `/api/challenges/:id/adopt` | partner | verified organisations only |
| POST | `/api/challenges/:id/team` | coordinator, university | the skill-gap team plan |
| POST | `/api/challenges/:id/solutions` | partner | returns `prefilled_ratings` for the reviewer |
| POST | `/api/solutions/:id/review` | coordinator | the seven readiness factors, each 1 to 5 |
| POST | `/api/solutions/:id/approve-pilot` | coordinator | creates the needs and fires capability alerts |
| POST | `/api/challenges/:id/pledges` | partner | a partial pledge against one need |
| POST | `/api/challenges/:id/updates` | assigned | progress notes and milestone changes |
| POST | `/api/challenges/:id/evidence` | volunteer, assigned | before, during, after, closure |
| POST | `/api/challenges/:id/deploy` | coordinator | evidence-based closure |
| POST | `/api/challenges/:id/confirm` | the reporter | the community has the final say |
| POST | `/api/challenges/:id/transition` | varies | the crisis fast path, and closing as not actionable |

Approving returns the full `score_breakdown`, so the coordinator screen can show
the working rather than a bare number.

Closure returns `422` with every unmet requirement when evidence, a beneficiary
count or a verifier sign-off is missing. Render `error.message` directly.

## Crisis Mode

| Method | Path | Notes |
|---|---|---|
| GET | `/api/crisis/start?region_id=` | active crises, for the red banner |
| POST | `/api/crisis/start` | a real alert, or `drill: true` |
| GET | `/api/crisis/:id/room` | the needs board, gaps, nearby resources, SMS reports, tech squad |
| POST | `/api/crisis/:id/end` | closes it and drafts the preparedness follow-ups |

The response carries `is_drill` and a ready-made `banner` string. A drill must be
labelled as a drill everywhere it appears.

## Dashboards and the ledger

| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard/metrics?region_id=` | the two headline KPIs first |
| GET | `/api/map/silent-zones?region_id=` | high hazard, real population, almost no reports |
| GET | `/api/organizations/:id` | profile, resources, track record, `can_act` |
| GET | `/api/regions` | the region switch |
| GET | `/api/ledger/verify` | recomputes every hash in the chain |
| GET | `/api/health` | what is wired up on this deployment |
| POST | `/api/demo/reset` | needs the `x-jharsetu-secret` header |

`metrics.simulated` is true while every row is seeded. Say so on the screen.

## Live updates

The gap bars, the coordinator queue and the map update on stage without anyone
refreshing, because the portals subscribe to Postgres changes directly rather
than polling this API. Subscribe from the browser with the Supabase anon key:

```js
supabase
  .channel("challenges")
  .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, handler)
  .subscribe();
```

Enable Realtime for `challenges`, `pledges`, `resource_needs` and `notifications`
in the Supabase dashboard, under Database then Replication.

## Things worth knowing

- **`degraded: true`** means an AI step fell back to deterministic code. The
  brief is still there and the shape is identical. Worth surfacing quietly.
- **`ai_uncertainties`** on a challenge is what the model was unsure about. It
  belongs on screen, word for word, under "AI is unsure about".
- **`ai_disclaimer`** comes back on the challenge detail. Show it verbatim.
- **Every seeded row carries `is_simulated`.** Nothing should display a made-up
  number without saying that is what it is.

---

## End-to-end flow endpoints (added 2026-09-13)

All return `{ ok, data }` / `{ ok: false, error }`. Auth: Supabase cookie or `Authorization: Bearer`.

| Step | Method & path | Who |
|---|---|---|
| AI check (auto after intake; manual rerun) | `POST /api/challenges/:id/corroborate` | verifier, coordinator, admin |
| Verifier queue (+ `recently_verified_by_ai`) | `GET /api/verify/queue` | verifier, volunteer, coordinator, admin |
| Confirm with sources / photos | `POST /api/verify/:id/confirm` `{source_urls[], photo_paths[], note}` | same |
| Reject | `POST /api/verify/:id/reject` | same |
| Private photo upload | `POST /api/uploads` multipart `file, purpose (verification\|progress), challenge_id` | by purpose |
| Open a stored file (signed redirect) | `GET /api/files/<path>` | access-checked |
| College problem list | `GET /api/college/problems` | university, admin |
| Submit proposal | `POST /api/college/proposals` multipart `challenge_id, document (PDF)` or JSON `extracted_text` | university |
| Proposal PDF | `GET /api/college/proposals/:id/document` | college, admin |
| College projects | `GET /api/college/projects`, `GET /api/college/projects/:ref` | university; companies/NGOs/admin read-only |
| Publish requirements | `POST /api/college/projects/:ref/requirements` `{funding_amount, materials[{item,qty,unit}], note}` | winning college |
| Remove a line | `DELETE /api/college/projects/:ref/requirements/:needId` | winning college (no pledges on it) |
| Stage status | `POST /api/college/projects/:ref/stages/:stageId` `{status, note, photo_paths}` | winning college |
| Progress update | `POST /api/college/projects/:ref/updates` `{note, stage_id?, photo_paths}` | winning college |
| Needs board | `GET /api/needs?group=materials\|funding\|all&district=` | all signed in |
| Pledge (partial allowed, capped at what is open) | `POST /api/challenges/:id/pledges` `{need_id, qty, note?, expected_delivery_date?, org_id? (admin)}` | industry, ngo, admin |
| Mark sent / received / withdraw | `POST /api/pledges/:id/dispatch` · `/receive` · `/withdraw` | pledger · college · pledger |
| My contributions + tracked projects | `GET /api/contributions/mine` | industry, ngo |
| Ask the college | `POST /api/threads` `{challenge_id}`, `GET/POST /api/threads/:id/messages` | contributor, college |
| Admin metrics | `GET /api/admin/metrics` | admin |
| Full record with gaps | `GET /api/admin/challenges/:ref/history` | admin |
| Open windows / award now | `GET /api/admin/windows`, `POST /api/admin/windows/:id/award` | admin, coordinator |
| Assistant | `POST /api/admin/assistant` `{question, challenge_ref?}` | admin |
