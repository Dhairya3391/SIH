# frontend/ — Citizen PWA + all portals

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui. Installable PWA.
One repo serves UI + API routes (deploys to Vercel).

## Screens (owner: FE + UI)

1. Landing — "See a need. Form a team. Close the loop." + 3 live numbers
2. Report a need — voice/photo/GPS/text + people/urgency/vulnerability, <1 min, works with no photo/location; offline → "Send by SMS"
3. Challenge detail (MAIN DEMO) — brief, confidence, priority breakdown, nearby, matches+reasons, proposals+readiness, gap bar, timeline, evidence, trace panel, `via SMS` badge
4. Coordinator dashboard — "Needs immediate action" strip, ranked queue, map/list toggle, KPIs, region switch
5. Organisation profile — expertise, resources, past work, verified badge
6. Collaboration workspace — board (Ideas→Under review→Prototype→Field test→Deployed), pledges, files, evidence (+ co-pilot panel if built)
7. Crisis room — red band, red districts, needs+gaps, nearby, SMS feed, tech-squad roster
8. Impact/analytics — ledger entries, funnel, 2 headline KPIs, district/institution breakdowns

## Folder guide

- `app/` — App Router routes + `api/` handlers (thin; logic lives in `backend/`)
- `components/` — shadcn/ui wrappers + domain components (gap bar, priority chip, trace panel)
- `lib/` — supabase client, api client, offline queue (IndexedDB), sms-link builder, map utils
- `public/` — icons, manifest, district GeoJSON (datameet: Jharkhand + Rajkot), hazard overlays

## Conventions

- Design tokens in `agent.md` §9 (Teal actions, red/amber urgency, green verified only; Mukta + Plex Mono; 48px targets; color never alone).
- Every screen: one primary next-action button; loading/empty/error states required.
- Hindi + English strings on all citizen screens. No disaster jargon for citizens.
- List view must work if map tiles fail. Text-only view for low bandwidth.
