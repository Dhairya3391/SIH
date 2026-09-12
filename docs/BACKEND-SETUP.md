# Backend setup

Everything the backend needs, and what you have to supply.

## What I need from you

Nothing in the code is blocked on these, but the backend cannot talk to a real
database until the first one is filled in.

### Required

| What | Where to get it | Goes in |
|---|---|---|
| Supabase project URL | Project Settings, API | `NEXT_PUBLIC_SUPABASE_URL` |
| Supabase anon key | Project Settings, API | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Supabase service role key | Project Settings, API | `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase database URL | Project Settings, Database, Connection string, URI | `SUPABASE_DB_URL` |

Create the project in the **ap-south-1 (Mumbai)** region. Substitute your own
database password where the connection string says `[YOUR-PASSWORD]`.

The service role key bypasses row-level security. It stays in
`backend/.env.local` and on the host, never in the browser bundle and never in
git.

### Strongly recommended

| What | Why | Goes in |
|---|---|---|
| Anthropic API key | The Challenge Compiler. Without it every brief comes from the rule-based compiler. | `ANTHROPIC_API_KEY` |
| Groq API key | Speech to text, Whisper large-v3. Without it voice notes save but do not transcribe. | `GROQ_API_KEY` |
| Gemini API key | Embeddings, free tier. Without it the local hashing vectoriser is used. | `GEMINI_API_KEY` |
| A demo password | Turns on the six-account role switcher. Any string. | `DEMO_PASSWORD` |
| Two secrets | Guard the SMS webhook and the demo reset. Any strings. | `SMS_INBOUND_SECRET`, `DEMO_RESET_SECRET` |

The platform runs with none of the AI keys. That is not a fallback bolted on
afterwards; the flow was built on the rule-based path first, which is what makes
switching the AI off in front of a judge safe.

### Later, for the SMS demo

A spare Android phone with an SMS-capable SIM, on the venue Wi-Fi, running an
SMS gateway app such as SMS Gateway for Android. Point it at
`https://your-backend/api/sms/inbound` and put the same shared secret in the
`x-jharsetu-secret` header. Its number becomes "the JharSetu number".

## Getting it running

```bash
cd backend
npm install
cp .env.example .env.local
```

Fill in `.env.local`, then:

```bash
npm run db:push
```

That applies the eight migrations in order: extensions, enums, tables, indexes,
functions, row-level security, default weights, and the demo reset helper.
It skips the team's earlier `001_initial_schema.sql`, which describes the same
tables and would collide.

```bash
npm run db:seed
```

Both scenarios, the background data and the Rajkot region, in a few seconds. No
AI calls and no network beyond Supabase, so a reset can never be blocked by a
slow model.

```bash
npm run dev
```

The backend listens on **port 3001**. The frontend stays on 3000.

Check it came up:

```bash
curl http://localhost:3001/api/health
```

## Verifying the whole loop

```bash
npm run smoke
```

This is the judge's journey from the playbook as a script: a report submits and
compiles, an idempotent resubmission files once, a report with no photo and no
location still submits, a citizen is refused the approve endpoint, a coordinator
approves and gets the score breakdown, partners come back with reasons, closure
is refused without evidence, a partner sees redacted rows while a coordinator
does not, the ledger verifies, a coded SMS lands with an exact pin, and a mock
drill switches districts.

It writes real rows, so run `npm run db:reset` afterwards.

## Turning the AI off

```bash
AI_ENABLED=false npm run dev
```

Every brief then comes from the keyword classifier and the rule-based capability
mapping, clustering uses the local vectoriser, and the response carries
`degraded: true`. The golden path still runs end to end. This is what to do if a
judge asks what happens when the AI service goes down.

## What each command does

| Command | What happens |
|---|---|
| `npm run db:push` | applies any migration not yet applied |
| `npm run db:push -- --reset` | drops the public schema first, then applies all of them |
| `npm run db:seed` | adds the seed data |
| `npm run db:seed -- --wipe` | clears the data first |
| `npm run db:reset` | both, in order. This is the one to run between rehearsals |
| `npm run smoke` | the judge's journey against localhost, or a URL you pass |
| `npm run typecheck` | TypeScript, no emit |

## Where things live

```
backend/
  app/api/**        35 route handlers
  lib/domain/**     the five formulas and the state machine, in plain code
  lib/ai/**         Compiler, embeddings, speech to text, rule-based fallback
  lib/services/**   intake, matching, swarm, lifecycle, crisis, ledger, notify
  lib/seed/**       both scenarios and the background data
  supabase/migrations/000*.sql
  scripts/          db-push, seed-demo, smoke
```

`backend/src/` and `backend/scripts/seed.ts` are the team's earlier skeleton,
left untouched.

## Before the deployment goes public

- `DEMO_PASSWORD` and `DEMO_RESET_SECRET` unset disable the role switcher and
  the reset endpoint entirely, which is the safe default for anything public.
- Add the deployed frontend URL to `CORS_ALLOWED_ORIGINS`.
- Cookies cross a real domain boundary as cross-site, so the session cookie
  needs `SameSite=None; Secure` if the two apps end up on different domains.
  On the same domain, or on localhost, this does not arise.
- Enable Realtime on `challenges`, `pledges`, `resource_needs` and
  `notifications` so the gap bars and the queue update live.
