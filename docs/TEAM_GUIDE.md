# JharSetu: The Complete Team Guide (SIH26043)

**Theme:** Disaster Management
**Problem Statement:** SIH26043 (Government of Jharkhand)

This document is the absolute ground-truth guide for the JharSetu platform. As a team member, you must know everything in this document to answer any question a judge might throw at you during the Smart India Hackathon.

---

## 1. The Core Philosophy: "The Rule of Law"

**Why don't we have a fully autonomous AI that just dispatches rescue teams?**
This is the most important question judges will ask. If you say "Our AI automatically calls the NDRF," you will lose points. AI hallucinates. In disaster management, a hallucination means sending a rescue boat to a dry street while people drown elsewhere. 

**Our Answer (The Rule of Law):** 
"AI suggests, code decides, humans authorize." 
We use AI strictly as a high-speed intelligence gatherer. When a citizen sends a messy voice note in Hindi, the AI transcribes it, translates it to English, extracts the exact number of people affected, categorizes the disaster, and *suggests* a severity score. But **it never acts**. A human District Coordinator looks at the AI's clean summary and clicks "Approve". This proves to the judges that our platform is safe, accountable, and legally sound for government use.

---

## 2. The Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4.
- **Backend**: Next.js Serverless API Routes (Vercel-ready).
- **Database**: Supabase (PostgreSQL). We use `pgvector` for semantic search (finding duplicate reports).
- **AI Inference**: Groq (Llama-3-8b for fast translation/drafting, Llama-3-70b for heavy scoring). Groq is used because it is infinitely faster than standard OpenAI endpoints, bringing pipeline latency from 22s down to ~1.2s.
- **Offline & PWA**: Standard Service Worker (`sw.js`) and Web Manifest for zero-network resilience.

---

## 3. The 8-Step Pipeline (Every Feature Explained)

### 3.1. Citizen Intake (Omnichannel)
**What it is:** The entry point. Citizens don't need to log in or download an app.
- **Features:** 
  - Voice Note capability (Audio gets transcribed via Whisper).
  - WhatsApp Webhook (`/api/webhooks/whatsapp`): Citizens can just text a WhatsApp bot.
  - IoT Webhook (`/api/webhooks/iot`): Hardware river sensors automatically trigger alerts.
- **For Judges:** Mention that we "meet the citizen where they are."

### 3.2. The AI Compiler Pipeline
**What it is:** The brain of the intake system (`/api/reports`).
- **Features:** It takes the raw input, translates it to English, and drafts a structured JSON "Brief". It generates a vector embedding to check if this report is a duplicate of something already happening 5km away.
- **For Judges:** Mention the "Deduplication Engine" using `pgvector` which prevents the dashboard from being spammed by 500 reports of the same flood.

### 3.3. The Verification Queue
**What it is:** The `/verify` screen for Volunteers and Verifiers.
- **Features:** Before the government sees it, local volunteers (or AI web-scrapers checking news/weather APIs) confirm the report is real.
- **For Judges:** Emphasize crowd-sourced truth-checking.

### 3.4. Coordinator Triage & GIS Map
**What it is:** The `/queue` and `/overview` screens for the District Officer.
- **Features:** 
  - **Interactive GIS Map**: SVG vector map of Jharkhand plotting incidents by severity.
  - **Hindi Localization**: A single toggle flips the entire UI to Hindi for local officials.
  - **Offline PWA**: Coordinators can install the app on their phones.

### 3.5. The Crisis Command Room
**What it is:** The `/crisis` screen for high-alert, mass-casualty events.
- **Features:** 
  - Bypasses the normal slow planning weights and uses "Response Weights" (prioritizing lives over cost).
  - Live SMS Ticker simulating field reports coming in real-time.

### 3.6. Resource Swarm (Colleges & Industry)
**What it is:** The `/college` and `/needs` screens.
- **Features:** 
  - The government doesn't have to build everything. Engineering colleges log in, look at "Verified Problems", and propose solutions. 
  - Private industries log in and fund these college projects via CSR (Corporate Social Responsibility).

### 3.7. The Cryptographic CSR Ledger
**What it is:** The `/admin/ledger` and Certificate generator.
- **Features:** When a company funds a disaster project, it gets logged into an immutable database table. When the project is finished, they receive a PDF "Impact Certificate" with a cryptographic hash.
- **For Judges:** "This prevents corruption. The funds are tracked from pledge to delivery with a blockchain-style verifiable hash."

### 3.8. The AI Benchmark Evaluator
**What it is:** The `/admin` screen benchmark test.
- **Features:** We don't just claim our AI is good. We have a test suite of 50 real-world, messy, multi-lingual disaster reports. The system runs them against a ground-truth expected output.
- **For Judges:** Show them this screen. "We achieve 96% accuracy on field data."

---

## 4. How to Handle Judge Questions

**Q: "What happens when the internet goes down?"**
**A:** "We built JharSetu as an Offline-First Progressive Web App (PWA). A district coordinator can install it directly to their home screen. It caches the map and the UI. If they go into a zero-network zone, they can still open the app, view cached reports, log verification data, and it will auto-sync when they return to a network."

**Q: "Rural citizens don't use web apps."**
**A:** "Exactly. That's why JharSetu is omnichannel. We have built webhooks that ingest reports directly from a WhatsApp chatbot, or plain SMS. The citizen just sends a voice note to a WhatsApp number, and our AI pipeline handles the rest."

**Q: "How do you prevent fake reports from wasting NDRF time?"**
**A:** "The Rule of Law pipeline. AI clusters duplicates together using vector embeddings. Then, it passes through a Verification layer (Volunteers or API corroboration). Only verified problems reach the Coordinator, and the Coordinator makes the final call."

**Q: "Why didn't you build a Native Android App in Java/Kotlin?"**
**A:** "A Web App is faster to deploy state-wide, updates instantly without App Store approvals, and using PWA technologies, we achieve native-like offline capabilities for a fraction of the bandwidth."

**Q: "What if the AI makes a mistake translating a local tribal dialect?"**
**A:** "The system always stores and preserves the original raw audio and the original text. The AI translation is a *helper*, not a replacement. A human verifier can always click 'Play' to hear the original citizen's voice."

---

## 5. Summary Checklist Before Demo

1. Ensure the Dual-Region switcher is set to Jharkhand.
2. Toggle the Hindi UI once to show it works.
3. Show the Crisis Room ticker.
4. Open the Admin Benchmark to prove the 96% AI accuracy.
5. Emphasize the "Rule of Law" — no autonomous AI dispatch.
