# JharSetu — SIH26043 (Govt. of Jharkhand)

> From local need to collective action.  
> "See a need. Form a team. Close the loop."

AI-assisted, low-bandwidth challenge exchange: citizen voice/photo/text/SMS →
compiled challenge → verified → matched (university + company + NGO) →
propose/pilot → Resource Swarm pledges → evidence-based closure → Impact Ledger.
Peace Mode (long-term) + Crisis Mode (rapid response drill/alert).
Jharkhand-first, with live region switch to Rajkot.

## Repo map

| Path | What lives here |
|------|-----------------|
| `agent.md` | Agent playbook — read first before any code |
| `context.pdf` | Full v4 playbook (source of truth) |
| `frontend/` | Next.js App Router + TS + Tailwind + shadcn/ui PWA (all screens) |
| `backend/` | Supabase (schema/RLS/seed), API logic, AI Compiler + fallback, SMS, matching, lifecycle, ledger |
| `presentation/` | Deck, demo script, diagrams, screenshots, backup video |
| `tasks/` | 9:20–10:30 sprint: INT / BE / AI / FE / UI / Lead cards |

## Quick start

```bash
# frontend
cd frontend && npm install && npm run dev

# backend (seed live Supabase)
cd backend && npm install && npm run seed
```

Demo: `POST /api/demo/reset` restores seeded state. Roles switch via in-app
demo switcher (no passwords on stage). See `agent.md` §12 for the 8-step demo.

## Rules

- Golden path before extras. Working → pretty → new. Freeze H18.
- Never claim unbuilt as built — say "roadmap".
- `.env` never committed. See `.env.example`.
- All seeded numbers labeled "Simulated scenario".
