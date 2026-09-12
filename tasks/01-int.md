# 1. INT — Pipeline & Data (unblocks everyone, move fast)

## Time blocks

- **9:20–9:35** — `npx create-next-app@latest jharsetu --ts --tailwind --app`,
  push to GitHub, import to Vercel, deploy empty app. Post live URL in group.
- **9:35–9:55** — Seed script: insert **10 challenges + 25 reports** across
  Gumla, Ranchi, Sahebganj, Dhanbad, Palamu. Mix disaster, water, education, health.
  (Get the 10 sentences from AI; shape must match BE's two tables.)
- **9:55–10:10** — Keep `main` green. Every merge deploys.
  You are the only one who touches deploy settings.

## Done when

Live URL shows seeded data to anyone on their phone.

## Line at 10:30

> "It's deployed and live right now, not on a laptop."

## Don't

Set up SMS, domains, or env secrets beyond Supabase keys.

## Lives in repo

- App scaffold → `frontend/`
- Seed SQL/TS → `backend/supabase/seed/`, `backend/scripts/`
