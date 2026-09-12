# AGENT.md — JharSetu (SIH26043) Future Reference

> Read this first before writing any code, answering questions, or planning.
> Source of truth: `context.pdf` v4 final (Team Computer Smashers playbook).
> Project: **JharSetu** — "Communities raise it. Campuses solve it. Industry scales it."
> Landing headline: "See a need. Form a team. Close the loop."
> Closing line: "Every university becomes the R&D department of its district."

## 1. What we're building

Platform for **Govt. of Jharkhand, SIH26043 (Disaster Management theme, 24h build, 100 marks)**.
Not a complaint portal. A **challenge exchange**: villager voice note → verified, funded, staffed, tracked project with evidence.

Loop: `Report → Compile → Verify → Prioritise → Match → Propose → Pilot → Pledge (Resource Swarm) → Deliver with evidence → Impact verified`

Two modes:
- **Peace Mode**: long-term challenges (education, health, farming, preparedness). Default.
- **Crisis Mode**: triggered by real IMD/CAP alert or mock drill. Red band + red districts + crisis room (needs, gaps, nearby resources, SMS reports, tech-squad call-up).

Region-first for Jharkhand (24 districts), with live **region switch to Rajkot** (college round). Every seeded number labeled "Simulated scenario".

## 2. Three pitch ideas (repeat everywhere)

1. **Challenge Compiler** — Hindi/English voice/photo/text/SMS → structured brief + confidence + "AI is unsure about…" + human approval.
2. **Matching + Resource Swarm** — list what's already nearby first (PostGIS radius), then recommend university + company + NGO with reasons. Multiple partial pledges, live gap bar.
3. **Impact Ledger** — closes only with photos + beneficiary count + volunteer check + community sign-off. Hash-chained record. Auto CSR/accreditation PDFs.

Demo beats: **Readiness Score 48 vs 84** (cheap deployable wins), **Crisis drill + live SMS**, **Silent zones** (high risk + no reports = digital divide).

## 3. Roles (6) + demo switcher

`citizen | field volunteer/NGO | coordinator (district officer/faculty) | university | industry/company | admin`
- One-click role switcher, no passwords on stage.
- Citizen: report <1min, track status, confirm fix.
- Volunteer/NGO: field verify with photo, list resources.
- Coordinator: approve briefs, rate readiness, approve pilots, close with evidence, start drill.
- University: adopt, team-build, propose, pilot.
- Company: pledge part, get CSR PDF.
- Admin: verify orgs, manage regions, edit weights (logged).

## 4. Stack (locked, don't re-debate)

- Frontend: **Next.js App Router + TS + Tailwind + shadcn/ui**, installable PWA.
- Backend/data: **Supabase** (Postgres + Auth + RLS + Storage + Realtime + pgvector + PostGIS). Self-hostable → data-sovereignty answer.
- LLM: `llm.ts` single wrapper. Claude Haiku 4.5 (extract) + Sonnet 5 (draft) via tool-use structured JSON. Fallback: Gemini free tier. **Always have rule-based fallback** (keyword classifier + tag matching + cached outputs). Golden path must run with AI key removed.
- STT: Whisper large-v3 via Groq. Roadmap: Bhashini/Sarvam for Santali/Mundari/Ho.
- Embeddings: translate to English first, then embed → pgvector.
- Maps/charts: Leaflet + OSM + leaflet.heat + datameet district GeoJSON (Jharkhand + Rajkot) + Recharts. Always provide list-view fallback.
- SMS/PDF/offline: spare Android + SMS-gateway app → `POST /api/sms/inbound`; `@react-pdf/renderer`; service worker + IndexedDB outbox. Prototype SMS only; production = licensed provider + TRAI DLT.
- Alt stack if team prefers: React+Vite + Node/Express + MongoDB Atlas. Use what you know.

Architecture: Channels (PWA, SMS gateway, volunteer, IMD/drill) → one Intake API → Compiler queued job (STT→translate→extract→embed/dedup→score→draft) → Supabase → Portals subscribe via Realtime. Domain services: Matching+Swarm, Lifecycle, Crisis engine, Ledger+PDFs.

## 5. Data model (must include from H1-H2)

`regions(id,name,center,zoom,boundary,languages[])` — add `region_id` everywhere day 1.
`users(id,role,org_id,region_id,language,district,skills[],reputation)`
`organizations(id,region_id,type[univ|company|ngo|govt|volunteers],name,district,lat,lng,response_radius_km,csr_focus[],csr_budget,verified,embedding)`
`org_capabilities, resources(id,org_id,type,quantity,geom,availability)`
`reports(id,client_id,region_id,channel[web|sms|volunteer],phone_hash?,original_text,lang,audio_url,photo_urls[],geom,people_est,urgency,vulnerable[],translated_text,extracted jsonb,embedding,cluster_id,consent,created_at)`
`challenges(id,region_id,title,brief jsonb,category,dm_phase,district,geom,people_est,severity,priority,score_breakdown,confidence,status,report_count,capabilities[],mode,crisis_id?)`
`verifications, matches(challenge_id,org_id,score,reasons,status), assignments, solutions(id,challenge_id,team_id,title,approach,cost_estimate,deploy_days,risks,ratings,readiness,status), resource_needs, pledges(need_id,org_id,qty,kind[money|equipment|people|expertise],status), milestones, evidence_files(phase[before|after|closure]), impact_records(people_served,time_to_match_min,time_to_resolution_min,remaining_need,verified_by), ledger(id,entity,entity_id,action,actor,payload,prev_hash,hash,at), crisis_events(id,region_id,hazard,source,is_drill,districts[],severity,started,ended), notifications`

Categories (8 fixed): disaster/safety, water, health, education, agriculture, roads/infra, energy/connectivity, environment + hazard tags + dm_phase (mitigation/preparedness/response/recovery).

## 6. API routes

```
POST /api/reports (idempotent on client_id)
POST /api/sms/inbound
GET /api/reports/:id/trace
GET /api/regions, GET /api/challenges?region,district,category,band,status, GET /api/challenges/:id
POST /api/challenges/:id/approve | /validate | /adopt | /pledges | /updates | /evidence | /deploy | /confirm
GET /api/challenges/:id/nearby | /matches | /report.pdf
POST /api/challenges/:id/solutions, POST /api/solutions/:id/review | /approve-pilot
GET /api/organizations/:id, GET /api/dashboard/metrics
POST /api/crisis/start {drill:true}|real webhook, POST /api/demo/reset
```

## 7. The five formulas (code decides, AI suggests)

- **Priority 0-100**: 25*severity(1-5, AI proposes, coordinator overrides) +15 urgency +15 people(log) +15 vulnerability(children/elderly/disability/pregnancy/medical/isolation/no-signal) +10 hazard(GIS) +10 resource_gap(% unpledged) +5 recurrence +5 community(unique reporters log, CAPPED). Bands: ≥75 critical, 50-74 high, 25-49 moderate, <25 long-term.
- **Confidence** (is it real?): unverified → community corroborated (≥3 independent) → field verified (photo) → coordinator approved → resolved with evidence. Inaccurate flag drops a level. Plain SMS starts bottom. Never hide low confidence.
- **Dedup**: same cluster if cosine≥0.85 AND ≤2km AND ≤30d. 0.75-0.85 = possible, coordinator decides.
- **Match 0-100**: 40 capability fit (embedding) +20 availability +15 proximity (in radius) +15 resource fit +10 partner-type (univ track record, company CSR+district, NGO local+response). Resource-first: list registry items in radius before proposing builds. Coordinator can override.
- **Readiness 0-100**: 20 technical +15 cost +15 time +15 local resources +15 safety +10 community +10 scalability (each 1-5 rated by coordinator/mentor; cost/time/resources pre-filled). Admin-editable weights, logged.

## 8. Lifecycle + rules

`REPORTED → REFINED (AI draft) → VERIFIED (human approve) → OPEN → TEAM_FORMED → SOLUTION_PROPOSED → PILOT → DEPLOYED → IMPACT_VERIFIED`
Fast path crisis: `OPEN → TEAM_FORMED → DEPLOYED` (evidence still required).
Sides: `DUPLICATE, NEEDS_FOLLOW_UP, CLOSED_NOT_ACTIONABLE` (human only + reason + reporter told). AI never rejects. Auto-release claims after 14d no progress. DEPLOYED requires note + photo/doc + beneficiary count + volunteer/coordinator check. IMPACT_VERIFIED = community sign-off.

AI rules: every AI output labeled "AI-assisted recommendation. Final validation required from authorised coordinator." Show why/data/uncertainty/verifier/next action. AI never dispatches, never rejects, never writes safety/medical advice (only verbatim NDMA/IMD cards + "Call 112").

Security: enforce with Supabase RLS (not just hidden buttons). Public map fuzz ~500m, strip photo EXIF publicly, hash SMS numbers, consent + anonymous option, DPDP 2023 minimise, zod + upload limits + rate limit (per SMS#). Orgs can't adopt/pledge until verified.

## 9. Screens (8) + design tokens

Landing, Report-a-need, **Challenge detail (main demo)**, Coordinator dashboard, Org profile, Workspace board (Ideas→Under review→Prototype→Field test→Deployed), Crisis room, Impact/analytics.
One primary next-action button per screen. Report works with no photo/location.

Colors: Ink #102027, Ground #F4F6F5, Line #CCD1C7, Teal #2E7180 (actions), Critical #D94F45/text #A8332A, High #E07B2E/text #9A4A12, Moderate #E5A83B/text #8A5A00, Long-term #3867A6, Resolved #3E8064/text #2F6B52. Never color-alone (icon+word). Red/orange/amber=urgency only, teal=action, green=verified/resolved only. Crisis = red top band. Fonts: Mukta (Latin+Devanagari, ≥16px, 1.6 lh, 48px targets) + IBM Plex Mono (IDs/coords/timings).

## 10. Connectivity ladder + SMS

Internet → normal upload (text+location first). No internet + signal + critical (sev 4-5 or vulnerable) → coded SMS via `sms:` link (one tap). Basic phone → plain Hindi SMS. Missed call/IVR = roadmap. No signal → IndexedDB queue + retry + idempotent client_id.

Coded SMS (≤160ch): `JS1 K7F2 W5 25.2481,87.6412 P200 VCE "pani nahi 2 din"` = v1 + reportID + cat+sev + GPS + people + vulnerable[C/E/D/P/M] + few words. Reply: "JharSetu: report K7F2 received. For life-threatening emergencies, call 112." Full sync later merges via ID. GPS only receives (incl. NavIC) — can't transmit; used to embed location in SMS. Tower location + auto-SMS = native-app roadmap (browser can't).

## 11. Build tiers — strict order

MUST (golden path first): auth+switcher, report, Compiler+fallback, dedup, confidence+priority+approve, org/resource registry+nearby, matching+team builder, proposals+readiness+pilot, swarm pledges+gap bar, lifecycle+closure, impact record, map/list/dashboard, notifications, seed+`/demo/reset`+cached AI.
WOW in order: 1 Crisis Mode, 2 SMS, 3 Region switch, 4 Silent zones+hazards, 5 community checks+ledger+PDFs, 6 trace panel (`Transcribe→Translate→Extract→Dedup→Score→Draft` with real timings), 7 offline queue, 8 do-not-duplicate library, 9 solution co-pilot (only if all above done).
PITCH ONLY (never build): Bhashini tribal langs, missed call/IVR/USSD/WhatsApp/Telegram, native app, report helper/ask-data, alert relay, weather/satellite, DigiLocker/APAAR, state relief portal integration.
NEVER: rescue dispatch (112's job), disaster prediction, blockchain (hash-chain instead), payments, general chatbot, native apps in 24h, fake metrics/live feeds, screens off golden path.

## 12. Demo (8 steps, 4:35) + seed

1 Report (Hindi voice, Gumla lightning, airplane-mode optional) 0:30 — "No form. No English. Works without network."
2 Compile (joins 31-report cluster, confidence↑, unsure shown) 0:30 — "31 voices, one problem."
3 Approve (priority 82 breakdown + why-critical) 0:30 — "AI prepares, human decides."
4 Match (siren stock Ranchi + halls, BIT Mesra/ECE demo + fictional NGO/steel CSR, team 2 ECE+1 CSE+1 civil+mentor) 0:30 — "What's already nearby."
5 Propose (48 vs 84, pilot siren relay, 8+4 pledges gap closes) 0:45 — "Cheap next month beats clever next year."
6 Prove (seeded pilot evidence, volunteer check, Hindi notify, Somra confirms, ledger + CSR PDF) 0:35 — "Closes with evidence."
7 See (KPIs, funnel, silent zones, switch to Rajkot 10s) 0:30 — "Silence isn't safety."
8 Drill (mock IMD heavy-rain Sahebganj, red room, live SMS with data/WiFi off → exact pin + via-SMS badge, env-lab accepts, call-up buzzes) 0:45.

Seed: 31 Gumla lightning + 2 proposals (sensor-AI 48, siren+shelter 84) + 1 evidence-stage pilot; Sahebganj flood (1250 people, 4 needs: water/200, medicine-route/350, connectivity, shelter + 2 SMS seeds + ledger entry 200 served/42min/9h); 150 JH bg reports + 15 Rajkot (waterlogging/heat/water/fire-prevention — never use 2024 game-zone fire) + 10 univ (IIT-ISM/BIT/NIT/CUJ/BAU/Ranchi/RIMS — label "demo data, potential partner", fictional company/NGO names) + 40 resources + 20 solved. Non-negotiables: reset script, cached AI, backup SMS, screen recording, hotspot, 2 people can demo solo, rehearse slow-net/AI-down/interrupt.

## 13. Execution checkpoints

H0-1 lock scope, H1-2 design contract (schema+region_id+client_id, API, mock service, tokens, SMS format), H2-6 foundation (H6: report on deployed site in feed, auto-deploy), H6-12 core (H9: full path on fallback no-AI, H12: real AI, incognito run), H12-18 close loop + WOW order (H18 FREEZE), H18-20 test on prod URL, H20-22 deck+backup video+Q&A drill, H22-24 timed rehearsals + submit + rest presenter. Lead has scope veto. Standup q3h. Stuck >30m → say so.

## 14. Scoring (100) + KPIs

Problem 10 (7-of-7 slide, Somra, lightning 2400 deaths 2014-24), Innovation 15 (comparison, 48v84, gap bar, drill), Tech 25 (trace timings, arch, accuracy on 40 hand-labeled, live SMS pin, kill-switch AI), UX 10 (phone flow, 1-click approve), Feasibility/impact/scale 15 (Rajkot switch, roadmap, CSR PDF), Security 5 (role-switch hides PII), Presentation 15 (skip landing, 30s under), Teamwork 5 (roles, commits, board).
Headline KPIs: time report→team formed, % reaching pilot/deployment, + univ-industry collaborations. Speed/quality/outcome funnel. Say seeded = simulated, pilot will measure. Never claim cost-saved.

## 15. Jharkhand fluency + policy (for Q&A/slides)

Lightning top killer (>2400/10y, farmers); relief portal pilot Dhanbad/Bokaro (we complement, not replace); tribal langs Santali/Mundari/Ho/Kurukh/Nagpuri/Khortha + basic phones → voice+SMS+Bhashini roadmap; Jharia fires + IIT-ISM Dhanbad (nearest-capable example); Sahebganj Ganga floods, Palamu/Garhwa drought/heat, elephant conflict. Policies: PM 10-pt Agenda Pt6 univ network, Sendai 4 priorities, NEP 2020 experiential, UBA/NSS/Aapda Mitra verifiers, CSR Sec135/SchVII (disaster explicit), DPDP 2023. Authorities: NDMA→JSDMA→district. Phases: mitigation/preparedness/response/recovery. Greeting: "Johar!"

## 16. Q&A one-liners

Grievance/SIH diff: continuous citizen sourcing + pilot to verified impact. 112 diff: we do hours-months knowledge/equipment/funding, never dispatch. Why AI: seconds vs days for compile/dedup/match, human decides. Chatbot: no general bot (dangerous); 3 focused assistants, only co-pilot in proto. Adoption: CSR/ESG PDFs + NAAC/NIRF + credits + talent pipeline. Spam: confidence ladder + flags + dedup + EXIF + rate limits + human gate. AI wrong/down: unsure shown + editable + measured %; fallback keyword/rules, priority/workflow are code. Offline/GPS/SMS: ladder above; GPS receives only; SMS low-bandwidth store-forward (Haiti 4636 precedent); WhatsApp needs internet. No smartphone: plain SMS + volunteer assist + silent-zone surveys. Crisis overlap: under district authority, complement relief portal. Drill: real pre-monsoon rehearsal. Drones: mapping only; delivery needs BVLOS approvals → preparedness challenge. Matching: 40/20/15/15/10 + reasons + override. After proposal: readiness→mentor→pilot→evidence→sign-off. Bias: pop 5%, vuln 15%, public weights, logged. Scale: region setting + stateless API + queued AI + self-host gov cloud. Why Jharkhand from Rajkot: sponsor = Jharkhand (switch to Rajkot live). Beyond disasters: same loop for edu/health/agri. Pay: state owns as infra; CSR programmes + grants + white-label + analytics. PII: fuzz/strip/hash + RLS. IP: open by default, agree at match. Abandon: 14d release + reputation + milestone funds. After hack: 1 district × 1 monsoon pilot, measure KPIs.

## 17. Working agreements for agents

- Golden path before extras. Working before pretty. Pretty before new. Freeze = no new features, only fixes.
- Never claim unbuilt as built — use "roadmap".
- Every slide number needs source or own measurement.
- Small PRs, merge q2-3h, one owner/task, don't edit others' files unasked.
- Check `context.pdf` decisions log before reopening: JharSetu name (not ResQGrid/AegisGrid), lightning main (not flood/drone delivery), SMS over Telegram, no chatbot, Rajkot switch (not Jharkhand-only).
