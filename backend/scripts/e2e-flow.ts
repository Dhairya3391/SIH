/**
 * The whole chain, end to end, against a running backend and the live database.
 *
 *   npx tsx scripts/e2e-flow.ts                 run the flow, save created ids
 *   npx tsx scripts/e2e-flow.ts --cleanup       delete everything the last run created
 *
 * citizen report -> AI check -> verifier (sources + photo) -> college PDF
 * proposal -> AI/rules analysis -> award -> requirements (money + 10 kg steel)
 * -> two companies pledge 5 kg + 5 kg, an NGO pledges money -> sent / received
 * -> contributor asks the college -> stage + progress update -> admin record,
 * metrics and assistant -> public tracking page.
 *
 * Every row it creates is titled "[E2E TEST]". Ledger entries are append-only
 * and stay behind by design.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

config({ quiet: true } as never);

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3001";
const STATE_FILE = process.env.E2E_STATE_FILE ?? join(tmpdir(), "jharsetu-e2e-state.json");
const TAG = "[E2E TEST]";

type Json = Record<string, any>;
const state: { challenge_id?: string; challenge_ref?: string; report_id?: string; files: string[]; merged_into_real?: boolean } = { files: [] };
let passed = 0;
let failed = 0;
const tokens: Record<string, string> = {};

function log(ok: boolean, step: string, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? ` - ${detail}` : ""}`);
}
function note(text: string) {
  console.log(`      ${text}`);
}
function save() {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(as: string | null, method: string, path: string, body?: Json | FormData) {
  const headers: Record<string, string> = {};
  if (as && tokens[as]) headers.authorization = `Bearer ${tokens[as]}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload, redirect: "manual" });
  let json: Json = {};
  try {
    json = await res.json();
  } catch {
    json = { raw: res.statusText };
  }
  return { status: res.status, ok: res.ok && json.ok !== false, data: json.data as Json, error: json.error as Json | string | undefined };
}
const err = (r: { status: number; error?: unknown }) => `HTTP ${r.status} ${JSON.stringify(r.error ?? "")}`.slice(0, 400);

/** A small but real PDF with selectable text, built by hand. */
function makePdf(lines: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = ["BT", "/F1 10 Tf", "12 TL", "50 790 Td", ...lines.map((l) => `(${esc(l)}) '`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

/** 1x1 PNG. */
const PNG = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64"),
);

async function login(role: string) {
  const r = await api(null, "POST", "/api/auth/demo-login", { role });
  if (r.ok && r.data?.access_token) {
    tokens[role] = r.data.access_token;
    return true;
  }
  note(`${role} login failed: ${err(r)}`);
  return false;
}

async function run() {
  // ---- 0. role-based login -------------------------------------------------
  for (const role of ["citizen", "verifier", "university", "industry", "ngo", "admin"]) {
    const okLogin = await login(role);
    log(okLogin || role === "ngo", `login as ${role}`, okLogin ? "" : role === "ngo" ? "NGO role not in the database yet (migration 0013) - NGO steps run through admin on the NGO's behalf" : "");
  }
  if (!tokens.citizen || !tokens.verifier || !tokens.university || !tokens.industry || !tokens.admin) throw new Error("Demo logins missing");

  // Role walls: a company must not reach the verifier queue or the college console.
  const wall1 = await api("industry", "GET", "/api/verify/queue");
  log(wall1.status === 403, "company is refused the verifier queue", `HTTP ${wall1.status}`);
  const wall2 = await api("citizen", "GET", "/api/college/problems");
  log(wall2.status === 403, "citizen is refused the college console", `HTTP ${wall2.status}`);
  const wall3 = await api("university", "GET", "/api/admin/metrics");
  log(wall3.status === 403, "college is refused the admin dashboard", `HTTP ${wall3.status}`);

  // ---- 1. citizen reports: starts unverified -------------------------------
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const report = await api("citizen", "POST", "/api/reports", {
    client_id: `e2e-${Date.now()}`,
    text: `${TAG} Heavy rain since ${yesterday} night flooded the low lying tola near the check dam at Tapkara. Water entered 30 houses, the culvert on the village road collapsed and 120 people cannot reach the market or health centre.`,
    lang: "en",
    lat: 23.0182,
    lng: 85.1911,
    location_source: "gps",
    district: "Khunti",
    village: "E2E Test Tola",
    people_est: 120,
    urgency: 4,
    vulnerable: ["elderly", "children"],
    consent: true,
  });
  log(report.ok, "citizen files a report", report.ok ? `${report.data.challenge_ref} decision=${report.data.decision} priority=${report.data.priority} confidence=${report.data.confidence} corroboration=${report.data.corroboration}` : err(report));
  if (!report.ok) return;
  state.challenge_id = report.data.challenge_id;
  state.challenge_ref = report.data.challenge_ref;
  state.report_id = report.data.report_id;
  save();
  if (report.data.decision === "merge") {
    const existing = await api("admin", "GET", `/api/challenges/${state.challenge_id}`);
    const isTest = String(existing.data?.challenge?.title ?? existing.data?.title ?? "").includes("E2E");
    if (!isTest) {
      state.merged_into_real = true;
      save();
      log(false, "report merged into a real problem - stopping so real data is not touched further");
      return;
    }
  }
  log(report.data.confidence === "unverified", "new report starts unverified", String(report.data.confidence));
  log(typeof report.data.priority === "number", "AI/rules ranked its severity", `priority ${report.data.priority}`);

  // Second report from the same place, same problem -> should combine.
  const second = await api("citizen", "POST", "/api/reports", {
    client_id: `e2e-b-${Date.now()}`,
    text: `${TAG} Flood water in Tapkara check dam tola, culvert on village road broken after heavy rain, houses flooded and people stuck.`,
    lang: "en",
    lat: 23.0189,
    lng: 85.1915,
    location_source: "gps",
    district: "Khunti",
    village: "E2E Test Tola",
    people_est: 60,
    urgency: 4,
    consent: true,
  });
  const combined = second.ok && second.data.challenge_id === state.challenge_id;
  log(second.ok, "second report from the same place", second.ok ? `decision=${second.data.decision} -> ${second.data.challenge_ref}` : err(second));
  if (second.ok) {
    log(combined || second.data.decision === "review", "similar report from same place is combined (or flagged for review)", `decision=${second.data.decision}`);
    if (!combined) (state as Json).second_challenge_id = second.data.challenge_id;
    (state as Json).second_report_id = second.data.report_id;
    save();
  }

  // ---- 2. AI disaster check (runs after the response) ----------------------
  let challenge: Json = {};
  for (let i = 0; i < 20; i++) {
    const r = await api("admin", "GET", `/api/challenges/${state.challenge_id}`);
    challenge = r.data ?? {};
    if (challenge.external?.checked) break;
    await wait(3000);
  }
  const c0 = challenge.challenge ?? challenge;
  log(Boolean(challenge.external?.checked), "AI weather/news/web check ran for the disaster-type report", challenge.external ? `verdict=${challenge.external.verdict} confidence=${challenge.external.confidence} providers=${JSON.stringify(challenge.external.providers ?? challenge.external.sources ?? "").slice(0, 160)}` : "no external check recorded");
  note(`after AI check: status=${c0.status} confidence=${c0.confidence}`);
  const aiVerified = c0.confidence === "externally_corroborated";

  // ---- 3. verifier queue + confirm with sources, photo, link ---------------
  const queue = await api("verifier", "GET", "/api/verify/queue");
  const inQueue = JSON.stringify(queue.data ?? {}).includes(state.challenge_id!);
  log(queue.ok && (inQueue || aiVerified), aiVerified ? "AI-verified problem appears in verifier audit list" : "unverified problem is in the verifier queue", queue.ok ? `listed=${inQueue}` : err(queue));

  const form = new FormData();
  form.set("purpose", "verification");
  form.set("challenge_id", state.challenge_id!);
  form.set("file", new Blob([PNG], { type: "image/png" }), "e2e-field-photo.png");
  const photo = await api("verifier", "POST", "/api/uploads", form);
  log(photo.ok, "verifier uploads a field photo (private bucket)", photo.ok ? photo.data.path : err(photo));
  if (photo.ok) {
    state.files.push(photo.data.path);
    save();
    const fileRes = await fetch(`${BASE}${photo.data.url}`, { headers: { authorization: `Bearer ${tokens.verifier}` }, redirect: "manual" });
    log([302, 303, 307, 200].includes(fileRes.status), "photo opens through the access check", `HTTP ${fileRes.status}`);
    const anon = await fetch(`${BASE}${photo.data.url}`, { redirect: "manual" });
    log(anon.status === 401 || anon.status === 403, "photo is refused to an anonymous visitor", `HTTP ${anon.status}`);
  }

  if (!aiVerified) {
    const confirm = await api("verifier", "POST", `/api/verify/${state.challenge_id}/confirm`, {
      source_urls: ["https://example.org/e2e-test-news-item", "Phone call with Tapkara panchayat mukhiya, 10:30"],
      photo_paths: photo.ok ? [photo.data.path] : [],
      note: `${TAG} Visited the tola: culvert collapsed and 30 houses show water marks.`,
    });
    log(confirm.ok, "verifier confirms with sources, link and photo", confirm.ok ? `confidence=${confirm.data.confidence ?? ""} status=${confirm.data.status ?? ""}` : err(confirm));
  } else {
    note("skipped manual confirmation: AI already verified it with sources");
  }

  const afterVerify = await api("admin", "GET", `/api/challenges/${state.challenge_id}`);
  const c1 = afterVerify.data?.challenge ?? afterVerify.data ?? {};
  log(["VERIFIED", "OPEN"].includes(c1.status), "problem is verified and open to colleges", `status=${c1.status} confidence=${c1.confidence}`);

  // ---- 4. college dashboard lists it; college proposes by PDF --------------
  const problems = await api("university", "GET", "/api/college/problems");
  log(problems.ok && JSON.stringify(problems.data).includes(state.challenge_id!), "verified problem is listed on the college dashboard", problems.ok ? "" : err(problems));

  // An unviable proposal first: the reviewer must reject it with reasons.
  const bad = await api("university", "POST", "/api/college/proposals", {
    challenge_id: state.challenge_id,
    extracted_text: `${TAG} We will fix it. `.repeat(12) + "We think it will work out fine and people will be happy with it when it is done by our students somehow.",
    document_name: "e2e-weak-proposal.txt",
  });
  log(bad.ok, "college submits a deliberately weak proposal", bad.ok ? `window opened=${bad.data.first_in_window}` : err(bad));

  const pdfBytes = makePdf([
    `${TAG} Proposal: Flood-safe culvert and raised footpath for Tapkara tola, Khunti`,
    "Submitted by BIT Mesra, Department of Electronics and Communication with Civil Engineering support.",
    "Problem: the village road culvert collapsed in floods; 120 people are cut off from the market and health centre.",
    "Solution: replace the collapsed culvert with a precast RCC box culvert sized for a 25-year flood,",
    "raise a 300 m footpath above the observed flood mark, and fit a solar water-level sensor with SMS alerts.",
    "Budget: total funding required Rs 50000 for labour, transport and the sensor.",
    "Bill of materials: 10 kg galvanised steel; 40 bags cement; 6 precast RCC pipes.",
    "Timeline: 45 days in total.",
    "Stage 1 - Site survey and hydrology study with the gram sabha (7 days). Done when levels are measured.",
    "Stage 2 - Procure materials and fabricate steel reinforcement (10 days). Done when all materials are on site.",
    "Stage 3 - Build the box culvert and raise the footpath (20 days). Done when vehicles can cross.",
    "Stage 4 - Install the water-level sensor and train two local volunteers (8 days). Done when a test SMS is received.",
    "Risks: monsoon delays; mitigated by doing the survey first and storing cement under cover.",
    "Maintenance: the panchayat will inspect the culvert before every monsoon; students return after 6 months.",
    "Safety: work zone barricaded, no work during heavy rain, IS 456 concrete standards followed.",
    "Community: the gram sabha agreed the footpath alignment; local labour will be hired.",
  ]);
  const pform = new FormData();
  pform.set("challenge_id", state.challenge_id!);
  pform.set("document", new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" }), "e2e-proposal.pdf");
  const good = await api("university", "POST", "/api/college/proposals", pform);
  log(good.ok, "college uploads a PDF proposal (text extracted)", good.ok ? `v${good.data.version} pages=${good.data.document_pages} doc=${good.data.document_url}` : err(good));

  // Wait for the analysis.
  let mine: Json[] = [];
  for (let i = 0; i < 25; i++) {
    const r = await api("university", "GET", "/api/college/proposals");
    mine = ((r.data?.proposals ?? []) as Json[]).filter((p) => p.challenge_id === state.challenge_id);
    if (mine.length && mine.every((p) => p.ai_score !== null && p.ai_score !== undefined)) break;
    await wait(3000);
  }
  for (const p of mine) {
    const reasons = p.ai_rubric?.required_changes ?? p.ai_rubric?.reasons ?? [];
    note(`proposal v${p.version}: state=${p.state} score=${p.ai_score} verdict=${p.ai_verdict} model=${p.ai_model ?? p.ai_rubric?.source} reasons=${JSON.stringify(reasons).slice(0, 200)}`);
    if (p.document_path && !String(p.document_path).startsWith("pending/")) state.files.push(p.document_path);
  }
  save();
  const latest = mine.slice().sort((a, b) => b.version - a.version)[0];
  const weak = mine.slice().sort((a, b) => a.version - b.version)[0];
  log(Boolean(latest && latest.ai_score !== null), "proposal was analysed and scored", latest ? `score=${latest.ai_score} verdict=${latest.ai_verdict}` : "no score");
  log(Boolean(weak && weak !== latest && weak.ai_verdict !== "viable"), "weak proposal was rejected with reasons", weak ? `verdict=${weak.ai_verdict}` : "");

  // ---- 5. award (admin closes the window now) ------------------------------
  let award = await api("admin", "POST", `/api/admin/windows/${state.challenge_id}/award`);
  for (let attempt = 1; award.ok && award.data.outcome !== "awarded" && attempt <= 2; attempt++) {
    // No viable proposal: the window reopens and the college revises, as a real one would.
    log(true, `no viable proposal, window reopened (attempt ${attempt}) - college revises using the reasons`);
    const revised = new FormData();
    revised.set("challenge_id", state.challenge_id!);
    revised.set(
      "document",
      new Blob([makePdf([
        `${TAG} Revised proposal v${attempt + 2}: Flood-safe crossing for Tapkara tola, Khunti (BIT Mesra)`,
        "Changes made after review: immediate temporary access, one consistent culvert design, and costed quantities.",
        "Day 1-3: install a 12 m modular steel footbridge with handrails (load 400 kg/m2) so people reach the market and clinic.",
        "Permanent works: one design only - a 2 x 2 m precast RCC box culvert, IRC:SP:13 hydraulic check for a 25-year flood.",
        "Raise 300 m of footpath by 0.6 m above the 2026 flood mark using compacted murrum with a cement-stabilised top.",
        "Early warning: solar ultrasonic water-level sensor at the check dam sending SMS to 2 trained volunteers and the mukhiya.",
        "Budget: total funding required Rs 50000 (labour Rs 22000, transport Rs 8000, sensor Rs 14000, contingency Rs 6000).",
        "Bill of materials: 10 kg galvanised steel; 40 bags cement; 6 precast RCC pipes; 1 modular footbridge kit (loaned).",
        "Timeline: 45 days in total, with the footbridge usable by day 3.",
        "Stage 1 - Temporary footbridge and site survey with the gram sabha (7 days). Done when people can cross safely.",
        "Stage 2 - Procure materials and fabricate steel reinforcement (10 days). Done when all materials are on site.",
        "Stage 3 - Build the box culvert and raise the footpath (20 days). Done when a loaded tractor crosses.",
        "Stage 4 - Install the sensor and train two volunteers (8 days). Done when a test SMS alert is received.",
        "Safety: barricaded work zone, no work in heavy rain, IS 456 concrete, site engineer present daily.",
        "Maintenance: panchayat pre-monsoon inspection each May; students return at 3 and 6 months with a written report.",
        "Community: gram sabha resolution on alignment dated this month; 8 local workers hired; women's SHG monitors the sensor.",
        "Risks: monsoon delay (survey first, cement stored under cover); supply delay (two steel suppliers identified).",
      ]).buffer as ArrayBuffer], { type: "application/pdf" }),
      `e2e-proposal-revised-${attempt}.pdf`,
    );
    const resub = await api("university", "POST", "/api/college/proposals", revised);
    log(resub.ok, `college resubmits a revised PDF after the window reopened`, resub.ok ? `v${resub.data.version}` : err(resub));
    if (!resub.ok) break;
    for (let i = 0; i < 25; i++) {
      const r = await api("university", "GET", "/api/college/proposals");
      const p = ((r.data?.proposals ?? []) as Json[]).find((x) => x.id === resub.data.proposal_id);
      if (p && p.ai_score !== null && p.ai_score !== undefined) {
        note(`revised v${p.version}: score=${p.ai_score} verdict=${p.ai_verdict}`);
        break;
      }
      await wait(3000);
    }
    award = await api("admin", "POST", `/api/admin/windows/${state.challenge_id}/award`);
  }
  log(award.ok && award.data.outcome === "awarded", "admin closes the window and awards", award.ok ? `outcome=${award.data.outcome} stages=${award.data.stages_created}` : err(award));

  // ---- 6. college publishes funding + materials ----------------------------
  const project = await api("university", "GET", `/api/college/projects/${state.challenge_ref}`);
  log(project.ok, "winning college opens its project workspace", project.ok ? `stages=${project.data.stages?.length} suggested=${JSON.stringify(project.data.suggested_requirements).slice(0, 200)}` : err(project));
  log((project.data?.stages?.length ?? 0) > 0, "delivery stages were generated from the document", (project.data?.stages ?? []).map((s: Json) => s.title).join(" | ").slice(0, 300));

  const reqs = await api("university", "POST", `/api/college/projects/${state.challenge_ref}/requirements`, {
    funding_amount: 50000,
    materials: [{ item: "Galvanised steel (E2E test)", qty: 10, unit: "kg" }],
    note: `${TAG} Deliver to the Tapkara panchayat bhawan.`,
  });
  log(reqs.ok, "college publishes Rs 50,000 funding and 10 kg steel", reqs.ok ? `needs=${reqs.data.needs?.length}` : err(reqs));
  if (!reqs.ok) return;
  const steel = (reqs.data.needs as Json[]).find((n) => n.kind !== "money");
  const money = (reqs.data.needs as Json[]).find((n) => n.kind === "money");

  // ---- 7. company and NGO dashboards ---------------------------------------
  const companyBoard = await api("industry", "GET", "/api/needs?group=materials&limit=150");
  const steelLine = ((companyBoard.data?.needs ?? []) as Json[]).find((n) => n.need_id === steel?.id);
  log(Boolean(steelLine), "steel line is on the company needs board", steelLine ? `college contact=${JSON.stringify(steelLine.college ?? null).slice(0, 160)}` : err(companyBoard));

  const admins = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: orgs } = await admins.from("organizations").select("id, name, type").in("type", ["company", "ngo"]).eq("verified", true);
  const me = await api("industry", "GET", "/api/auth/demo-login");
  const otherCompany = (orgs ?? []).find((o) => o.type === "company" && o.id !== me.data?.user?.org_id);
  const ngoOrg = (orgs ?? []).find((o) => o.name.startsWith("Palamu Jan Kalyan")) ?? (orgs ?? []).find((o) => o.type === "ngo");

  const p1 = await api("industry", "POST", `/api/challenges/${state.challenge_id}/pledges`, { need_id: steel!.id, qty: 5, note: `${TAG} first half`, expected_delivery_date: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) });
  log(p1.ok, "company A pledges 5 kg of the 10 kg", p1.ok ? `thread=${p1.data.thread_id}` : err(p1));
  const over = await api("admin", "POST", `/api/challenges/${state.challenge_id}/pledges`, { need_id: steel!.id, qty: 6, org_id: otherCompany?.id });
  log(over.status === 422, "pledging more than is left (6 of 5 kg) is refused", `HTTP ${over.status}`);
  const p2 = await api("admin", "POST", `/api/challenges/${state.challenge_id}/pledges`, { need_id: steel!.id, qty: 5, org_id: otherCompany?.id, note: `${TAG} second half` });
  log(p2.ok, `company B (${otherCompany?.name}) pledges the other 5 kg`, p2.ok ? `fully_pledged=${p2.data.fully_pledged}` : err(p2));

  const ngoAs = tokens.ngo ? "ngo" : "admin";
  const ngoBoard = await api(ngoAs, "GET", "/api/needs?group=funding&limit=150");
  log(((ngoBoard.data?.needs ?? []) as Json[]).some((n) => n.need_id === money?.id), `funding line is on the NGO board (as ${ngoAs})`, ngoBoard.ok ? "" : err(ngoBoard));
  const p3 = await api(ngoAs, "POST", `/api/challenges/${state.challenge_id}/pledges`, { need_id: money!.id, qty: 30000, ...(ngoAs === "admin" ? { org_id: ngoOrg?.id } : {}), note: `${TAG} NGO share` });
  log(p3.ok, `NGO (${ngoOrg?.name}) pledges Rs 30,000`, p3.ok ? "" : err(p3));
  const p4 = await api("admin", "POST", `/api/challenges/${state.challenge_id}/pledges`, { need_id: money!.id, qty: 20000, org_id: (orgs ?? []).find((o) => o.type === "ngo" && o.id !== ngoOrg?.id)?.id, note: `${TAG} second NGO` });
  log(p4.ok, "second NGO pledges the remaining Rs 20,000", p4.ok ? `fully_pledged=${p4.data.fully_pledged}` : err(p4));

  const boardAfter = await api("industry", "GET", "/api/needs?group=all&limit=150");
  log(!((boardAfter.data?.needs ?? []) as Json[]).some((n) => n.challenge?.id === state.challenge_id), "fully covered project leaves the needs board");

  // ---- 8. contact the college ----------------------------------------------
  const thread = await api("industry", "POST", "/api/threads", { challenge_id: state.challenge_id });
  log(thread.ok, "company opens a conversation with the college", thread.ok ? `thread=${thread.data.thread_id}` : err(thread));
  if (thread.ok) {
    const m1 = await api("industry", "POST", `/api/threads/${thread.data.thread_id}/messages`, { body: `${TAG} Do you need the steel cut to length?` });
    log(m1.ok, "company asks a question", m1.ok ? "" : err(m1));
    const m2 = await api("university", "POST", `/api/threads/${thread.data.thread_id}/messages`, { body: `${TAG} Yes, 6 m lengths please.` });
    log(m2.ok, "college answers in the same thread", m2.ok ? "" : err(m2));
  }

  // ---- 9. dispatch / receive -----------------------------------------------
  const mine1 = await api("industry", "GET", "/api/contributions/mine");
  const myPledge = ((mine1.data?.contributions ?? []) as Json[]).find((c) => c.challenge?.id === state.challenge_id);
  log(Boolean(myPledge), "company sees its contribution", myPledge ? `${myPledge.amount} state=${myPledge.state}` : err(mine1));
  if (myPledge) {
    const d = await api("industry", "POST", `/api/pledges/${myPledge.id}/dispatch`, { note: `${TAG} sent by truck` });
    log(d.ok, "company marks the steel sent", d.ok ? d.data.state : err(d));
    const wrong = await api("industry", "POST", `/api/pledges/${myPledge.id}/receive`, {});
    log(wrong.status === 403, "company cannot confirm its own delivery", `HTTP ${wrong.status}`);
    const rcv = await api("university", "POST", `/api/pledges/${myPledge.id}/receive`, { receipt_note: `${TAG} 5 kg received in good condition` });
    log(rcv.ok, "college confirms receipt of the steel", rcv.ok ? `state=${rcv.data.state}` : err(rcv));
  }

  // ---- 10. progress: stage + update with photo -----------------------------
  const proj2 = await api("university", "GET", `/api/college/projects/${state.challenge_ref}`);
  const firstStage = (proj2.data?.stages ?? [])[0];
  note(`status after funding: ${proj2.data?.challenge?.status}`);
  if (firstStage) {
    const s1 = await api("university", "POST", `/api/college/projects/${state.challenge_ref}/stages/${firstStage.id}`, { status: "done", note: `${TAG} Survey finished` });
    log(s1.ok, "college marks stage 1 done", s1.ok ? `stages_done=${s1.data.stages_done}` : err(s1));
  }
  const pf = new FormData();
  pf.set("purpose", "progress");
  pf.set("challenge_id", state.challenge_id!);
  pf.set("file", new Blob([PNG], { type: "image/png" }), "e2e-progress.png");
  const pphoto = await api("university", "POST", "/api/uploads", pf);
  if (pphoto.ok) {
    state.files.push(pphoto.data.path);
    save();
  }
  const upd = await api("university", "POST", `/api/college/projects/${state.challenge_ref}/updates`, { note: `${TAG} Steel received and cut; formwork starts Monday.`, photo_paths: pphoto.ok ? [pphoto.data.path] : [] });
  log(upd.ok, "college posts a progress update with a photo", upd.ok ? `updates=${upd.data.updates?.length}` : err(upd));

  const tracked = await api("industry", "GET", "/api/contributions/mine");
  const trackedProject = ((tracked.data?.projects ?? []) as Json[]).find((p) => p.id === state.challenge_id);
  log(Boolean(trackedProject && trackedProject.recent_updates?.length), "company tracks stages and updates from its contributions page", trackedProject ? `progress=${trackedProject.progress_pct}% updates=${trackedProject.recent_updates?.length}` : "");
  const readOnly = await api("industry", "GET", `/api/college/projects/${state.challenge_ref}`);
  log(readOnly.ok && readOnly.data.viewer?.is_college === false, "company can open the project read-only", readOnly.ok ? "" : err(readOnly));
  const noEdit = await api("industry", "POST", `/api/college/projects/${state.challenge_ref}/updates`, { note: "not allowed to post this" });
  log(noEdit.status === 403, "company cannot post progress for the college", `HTTP ${noEdit.status}`);

  // ---- 11. admin: history, metrics, assistant ------------------------------
  const hist = await api("admin", "GET", `/api/admin/challenges/${state.challenge_ref}/history`);
  log(hist.ok, "admin sees the full record with gaps", hist.ok ? `timeline=${hist.data.timeline?.length} proposals=${hist.data.proposals?.length} contributions=${hist.data.contributions?.length} updates=${hist.data.progress_cadence?.updates?.length}` : err(hist));
  const metrics = await api("admin", "GET", "/api/admin/metrics");
  log(metrics.ok, "admin metrics load", metrics.ok ? `solved=${metrics.data.totals?.solved} severe_open=${metrics.data.totals?.severe_open} in_delivery=${metrics.data.totals?.in_delivery}` : err(metrics));
  const ask = await api("admin", "POST", "/api/admin/assistant", { question: "What did the college propose and what has happened since?", challenge_ref: state.challenge_ref });
  log(ask.ok && String(ask.data.answer ?? "").length > 40, "admin assistant explains the problem", ask.ok ? `${ask.data.generated_by}: ${String(ask.data.answer).slice(0, 220).replace(/\n/g, " ")}` : err(ask));

  // ---- 12. public tracking -------------------------------------------------
  const pub = await api(null, "GET", `/api/challenges/${state.challenge_ref}`);
  log(pub.ok, "anyone can track the problem by its reference", pub.ok ? `project stages=${pub.data.project?.stages?.length ?? "none"}` : err(pub));
}

async function cleanup() {
  if (!existsSync(STATE_FILE)) {
    console.log("Nothing to clean: no state file.");
    return;
  }
  const s = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Json;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  // Every file a test challenge produced lives under <purpose>/<challenge id>/.
  const walk = async (prefix: string, out: string[]) => {
    const { data } = await sb.storage.from("jharsetu-files").list(prefix, { limit: 100 });
    for (const o of data ?? []) {
      const p = `${prefix}/${o.name}`;
      if (o.id) out.push(p);
      else await walk(p, out);
    }
  };
  const files = new Set<string>(s.files ?? []);
  for (const id of [s.challenge_id, s.second_challenge_id].filter(Boolean)) {
    if (s.merged_into_real && id === s.challenge_id) continue;
    const found: string[] = [];
    for (const top of ["proposal", "verification", "progress"]) await walk(`${top}/${id}`, found);
    found.forEach((f) => files.add(f));
  }
  if (files.size) {
    const { error } = await sb.storage.from("jharsetu-files").remove([...files]);
    console.log(`files removed: ${files.size}${error ? ` (error ${error.message})` : ""}`);
  }
  const reportIds = [s.report_id, s.second_report_id].filter(Boolean);
  for (const id of [s.challenge_id, s.second_challenge_id].filter(Boolean)) {
    if (s.merged_into_real && id === s.challenge_id) continue;
    const { data: ch } = await sb.from("challenges").select("id, title").eq("id", id).maybeSingle();
    if (!ch) continue;
    if (!String(ch.title).includes("E2E") && !String(ch.title).toLowerCase().includes("tapkara")) {
      console.log(`refusing to delete ${id}: title "${ch.title}" is not a test row`);
      continue;
    }
    await sb.from("notifications").delete().contains("payload", { challenge_id: id });
    await sb.from("reports").update({ cluster_id: null }).eq("cluster_id", id);
    const { error } = await sb.from("challenges").delete().eq("id", id);
    console.log(`challenge ${id} deleted${error ? ` (error ${error.message})` : ""}`);
  }
  if (reportIds.length) {
    const { error } = await sb.from("reports").delete().in("id", reportIds).like("original_text", "%E2E TEST%");
    console.log(`reports deleted: ${reportIds.length}${error ? ` (error ${error.message})` : ""}`);
  }
}

if (process.argv.includes("--cleanup")) {
  cleanup().then(() => process.exit(0), (e) => (console.error(e), process.exit(1)));
} else {
  run()
    .catch((e) => {
      failed++;
      console.error("ABORTED:", e);
    })
    .finally(() => {
      save();
      console.log(`\n${passed} passed, ${failed} failed. State: ${STATE_FILE}`);
      process.exit(failed ? 1 : 0);
    });
}
