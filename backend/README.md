# backend/ — Data, logic, AI, SMS

Supabase (Postgres + Auth + RLS + Storage + Realtime + pgvector + PostGIS).
Self-hostable on gov cloud → data-sovereignty answer. Frontend builds against a
typed mock service from H2 so UI never waits on DB.

## Folder guide

- `supabase/migrations/` — schema migrations. Must include `region_id` + `reports.client_id` from migration #1. Tables: regions, users, organizations, org_capabilities, resources, reports, challenges, verifications, matches, assignments, solutions, resource_needs, pledges, milestones, evidence_files, impact_records, ledger (hash-chained), crisis_events, notifications.
- `supabase/seed/` — Scenario A (31 Gumla lightning + 2 proposals 48 vs 84 + evidence-stage pilot), Scenario B (Sahebganj flood: 4 needs + 2 SMS seeds + ledger entry), 150 JH bg reports, 15 Rajkot reports, 10 univs, 8 fictional companies, 5 NGOs, 40 resources, 20 solved. Everything labeled simulated.
- `src/lib/` — portable logic (imported by API routes):
  - `llm.ts` — single LLM wrapper (Haiku 4.5 extract / Sonnet 5 draft; Gemini fallback). Swap provider here in 5 min.
  - `fallback.ts` — rule-based classifier + capability mapping (golden path runs on this, zero AI calls).
  - `formulas.ts` — priority / confidence / dedup (cos≥0.85 + ≤2km + ≤30d) / match (40/20/15/15/10) / readiness. Code decides, AI suggests.
  - `sms.ts` — coded-SMS parser (`JS1 K7F2 W5 lat,lng P200 VCE "…"`) + plain-SMS → Compiler + reply sender.
  - `lifecycle.ts` — state machine incl. crisis fast path `OPEN→TEAM_FORMED→DEPLOYED`, 14-day claim release.
  - `ledger.ts` — hash-chain writes (timeline + audit in one table).
- `scripts/` — `seed.ts`, `demo-reset`, accuracy harness (40 hand-labeled reports → category accuracy + dedup precision for slides).

## API routes (Next.js `frontend/app/api/`, logic here)

`POST /reports (idempotent client_id)` · `POST /sms/inbound` · `GET /reports/:id/trace` ·
`GET /regions` · `GET /challenges?…` · `GET /challenges/:id` · `POST …/approve|validate|adopt|solutions|pledges|updates|evidence|deploy|confirm` ·
`POST /solutions/:id/review|approve-pilot` · `GET …/nearby|matches|report.pdf` ·
`GET /organizations/:id` · `GET /dashboard/metrics` · `POST /crisis/start {drill:true}` · `POST /demo/reset`

## Rules

- RLS enforces roles (citizens can't see PII/exact coords; only assigned responders + coordinators see exact; public map fuzz ~500 m, strip photo EXIF, hash SMS numbers). Test with direct API calls, not just hidden buttons.
- AI never dispatches/rejects/writes safety advice (verbatim NDMA/IMD + "Call 112" only). Every AI output labeled "AI-assisted… coordinator validation required."
- `POST /api/demo/reset` must restore seed in one command. Cache AI answers for demo inputs.
