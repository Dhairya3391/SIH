# tasks/ — 9:20–10:30 sprint (first working slice)

Target for 10:30: **live URL, real Postgres rows, phone submit → queue shows it,
styled like a product, story that matches the product.** Six people, six cards,
one timer. Lead announces 9:50, 10:10, 10:25.

| # | Role | File | Owns | Presents at 10:30 |
|---|------|------|------|-------------------|
| 1 | INT — pipeline & data | `01-int.md` | Next.js scaffold, Vercel deploy, seed, main green | "It's deployed and live right now, not on a laptop." |
| 2 | BE — database & API | `02-be.md` | Supabase 2-table SQL, POST /api/reports, GET /api/challenges | "Real Postgres, real rows. Here's the record that was just created." |
| 3 | AI — compiler & words | `03-ai.md` | `lib/compile.ts` rule-based, 10 seed sentences | "It's rule-based right now. Real AI plugs in behind the same function by hour 12." |
| 4 | FE — report & queue | `04-fe.md` | `/report` + `/queue` pages, wired to real API | Drives demo. "No form-filling, no English, and it's on a phone." |
| 5 | UI — product look | `05-ui.md` | Tokens, chip, card, top bar, ops-console queue | "Colour always carries a word too, because red and green look the same to many people." |
| 6 | Lead — story & time | `06-lead.md` | 5 slides, 3-min script, rehearsals, screenshots | Hook + close. |

Rules: INT unblocks everyone → move fast. AI's `compile()` is the only
cross-blocking task (due 9:35). FE uses mock array until BE route is live.
No auth/RLS, no LLM calls, no map/charts/landing, no SMS/domains before 10:30.
Test everything on the **deployed URL, never localhost**.
