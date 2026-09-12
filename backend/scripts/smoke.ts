/**
 * The judge's journey, run against a live deployment.
 *
 *   npm run smoke                      against http://localhost:3001
 *   npm run smoke -- https://your-url  against the production URL
 *
 * This is the H18-H20 checklist as a script: a judge should be able to walk the
 * whole loop on the deployed site without a developer's help, so we check that
 * the loop actually runs rather than trusting that it does.
 *
 * It writes real rows. Run `npm run db:reset` afterwards, or point it at a
 * throwaway project.
 */

import "dotenv/config";

const BASE = process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3001";

interface Check {
  name: string;
  run: () => Promise<string>;
}

let cookie = "";
let bearerToken = "";
let challengeId = "";
let reportId = "";

async function call(
  path: string,
  init: RequestInit & { as?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  // Prefer Bearer token (set after demo-login), fall back to cookies.
  // Bearer token works reliably against the deployed API where SameSite/Secure
  // cookie constraints prevent the ssr cookie from surviving a Node.js roundtrip.
  if (bearerToken) {
    headers["authorization"] = `Bearer ${bearerToken}`;
  } else if (cookie) {
    headers.cookie = cookie;
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = { raw: "not json" };
  }
  return { status: res.status, body };
}

function data(body: Record<string, unknown>): Record<string, unknown> {
  return (body.data ?? {}) as Record<string, unknown>;
}

async function loginAs(role: string): Promise<void> {
  cookie = "";
  bearerToken = "";
  const { status, body } = await call("/api/auth/demo-login", {
    method: "POST",
    body: JSON.stringify({ role }),
  });
  if (status !== 200) {
    throw new Error(
      `Could not sign in as ${role}: ${JSON.stringify(body.error ?? body)}. ` +
        "Set DEMO_PASSWORD and run the seed script.",
    );
  }
  // Use the JWT from the response body — this works regardless of cookie
  // domain or SameSite policy, which is important when running the smoke
  // test against jharsetu-api.vercel.app from a Node.js script.
  const d = data(body);
  if (typeof d.access_token === "string") {
    bearerToken = d.access_token;
  }
}

const CHECKS: Check[] = [
  {
    name: "Regions load, and both Jharkhand and Rajkot are present",
    run: async () => {
      const { status, body } = await call("/api/regions");
      if (status !== 200) throw new Error(`status ${status}`);
      const regions = (data(body).regions ?? []) as Array<{ id: string }>;
      const ids = regions.map((r) => r.id);
      if (!ids.includes("jharkhand")) throw new Error("jharkhand region is missing");
      if (!ids.includes("rajkot")) throw new Error("rajkot region is missing");
      return `${regions.length} regions: ${ids.join(", ")}`;
    },
  },
  {
    name: "A citizen submits a report, and it compiles into a challenge",
    run: async () => {
      await loginAs("citizen");
      const clientId = `smoke-${Date.now()}`;
      const { status, body } = await call("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          client_id: clientId,
          region_id: "jharkhand",
          text: "Bijli girne se hamare khet me do log mar gaye. Koi shelter nahi hai yahan.",
          lang: "hi",
          lat: 23.0512,
          lng: 84.5421,
          location_source: "gps",
          district: "Gumla",
          village: "Karra Toli",
          people_est: 400,
          urgency: 5,
          vulnerable: ["elderly"],
          consent: true,
        }),
      });
      if (status !== 201 && status !== 200) throw new Error(`status ${status}: ${JSON.stringify(body)}`);
      const d = data(body);
      reportId = String(d.report_id);
      challengeId = String(d.challenge_id);
      if (!challengeId || challengeId === "undefined") throw new Error("no challenge was created");
      return `decision=${d.decision}, priority=${d.priority}, degraded=${d.degraded}`;
    },
  },
  {
    name: "The pipeline trace is retrievable, with real timings",
    run: async () => {
      const { status, body } = await call(`/api/reports/${reportId}/trace`);
      if (status !== 200) throw new Error(`status ${status}`);
      const d = data(body);
      const trace = (d.trace ?? []) as Array<{ step: string; ms: number }>;
      return trace.length
        ? trace.map((t) => `${t.step} ${t.ms}ms`).join(" -> ")
        : "no trace recorded (the report merged into an existing cluster)";
    },
  },
  {
    name: "An idempotent resubmission does not create a second report",
    run: async () => {
      const clientId = `smoke-idem-${Date.now()}`;
      const payload = JSON.stringify({
        client_id: clientId,
        region_id: "jharkhand",
        text: "Handpump has been broken for three weeks. Women walk two kilometres for water.",
        lang: "en",
        lat: 23.05,
        lng: 84.54,
        location_source: "gps",
        district: "Gumla",
        consent: true,
      });
      const first = await call("/api/reports", { method: "POST", body: payload });
      const second = await call("/api/reports", { method: "POST", body: payload });
      if (data(first.body).report_id !== data(second.body).report_id) {
        throw new Error("the same client_id produced two different reports");
      }
      if (!data(second.body).already_received) throw new Error("the repeat was not flagged");
      return "the same client_id filed once";
    },
  },
  {
    name: "A report with no photo and no location still submits",
    run: async () => {
      const { status, body } = await call("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          client_id: `smoke-nogps-${Date.now()}`,
          region_id: "jharkhand",
          text: "School me peene ka saaf pani nahi hai. Bachche ghar se bottle late hain.",
          lang: "hi",
          location_source: "none",
          consent: true,
        }),
      });
      if (status !== 201 && status !== 200) throw new Error(`status ${status}: ${JSON.stringify(body)}`);
      return `accepted, confidence=${data(body).confidence}`;
    },
  },
  {
    name: "A citizen cannot approve a brief",
    run: async () => {
      await loginAs("citizen");
      const { status } = await call(`/api/challenges/${challengeId}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (status !== 403) throw new Error(`expected 403, got ${status}`);
      return "refused with 403, as it should be";
    },
  },
  {
    name: "A coordinator approves the brief, and the score explains itself",
    run: async () => {
      await loginAs("coordinator");
      const { status, body } = await call(`/api/challenges/${challengeId}/approve`, {
        method: "POST",
        body: JSON.stringify({ note: "Smoke test approval." }),
      });
      if (status !== 200) throw new Error(`status ${status}: ${JSON.stringify(body)}`);
      const d = data(body);
      const breakdown = d.score_breakdown as { factors?: unknown[] } | undefined;
      if (!breakdown?.factors?.length) throw new Error("no score breakdown was returned");
      return `status=${d.status}, priority=${d.priority}, factors=${breakdown.factors.length}`;
    },
  },
  {
    name: "Nearby resources and recommended partners come back with reasons",
    run: async () => {
      const nearby = await call(`/api/challenges/${challengeId}/nearby?radius_km=60`);
      const matches = await call(`/api/challenges/${challengeId}/matches?refresh=true`);
      const m = (data(matches.body).matches ?? []) as Array<{ name: string; score: number; reasons: string[] }>;
      if (!m.length) throw new Error("no partner recommendations");
      if (!m[0].reasons?.length) throw new Error("a recommendation arrived with no reasons");
      const resources = (data(nearby.body).resources ?? []) as unknown[];
      return `${resources.length} resources nearby, top match ${m[0].name} at ${m[0].score}`;
    },
  },
  {
    name: "Closure is refused while the evidence is missing",
    run: async () => {
      const { status, body } = await call(`/api/challenges/${challengeId}/deploy`, {
        method: "POST",
        body: JSON.stringify({
          completion_note: "Trying to close this without any evidence at all.",
          people_served: 400,
        }),
      });
      if (status !== 422) throw new Error(`expected 422, got ${status}`);
      const message = ((body.error ?? {}) as { message?: string }).message ?? "";
      return `refused: ${message.slice(0, 80)}`;
    },
  },
  {
    name: "The public list redacts, and the coordinator list does not",
    run: async () => {
      await loginAs("university");
      const partner = await call("/api/challenges?region_id=jharkhand&limit=1");
      if (!data(partner.body).redacted) throw new Error("a partner was served unredacted rows");

      await loginAs("coordinator");
      const staff = await call("/api/challenges?region_id=jharkhand&limit=1");
      if (data(staff.body).redacted) throw new Error("a coordinator was served redacted rows");
      return "partners see fuzzed locations, coordinators see exact ones";
    },
  },
  {
    name: "The ledger verifies: nothing has been altered",
    run: async () => {
      const { status, body } = await call("/api/ledger/verify");
      if (status !== 200) throw new Error(`status ${status}`);
      const d = data(body);
      if (!d.ok) throw new Error(`the chain breaks at entry ${d.broken_at}`);
      return `${d.entries_checked} entries recompute to their stored hashes`;
    },
  },
  {
    name: "A coded SMS lands with an exact location",
    run: async () => {
      const secret = process.env.SMS_INBOUND_SECRET;
      const { status, body } = await call("/api/sms/inbound", {
        method: "POST",
        headers: secret ? { "x-jharsetu-secret": secret } : {},
        body: JSON.stringify({
          from: "+919999000111",
          text: 'JS1 SM01 W5 25.2481,87.6412 P200 VCE "pani nahi 2 din"',
        }),
      });
      if (status !== 201 && status !== 200) throw new Error(`status ${status}: ${JSON.stringify(body)}`);
      const d = data(body);
      if (!d.parsed) throw new Error("the coded SMS was not parsed");
      if (!d.has_exact_location) throw new Error("the SMS landed without an exact location");
      return `parsed, pinned, challenge ${d.challenge_ref}`;
    },
  },
  {
    name: "The dashboard returns both headline KPIs",
    run: async () => {
      const { status, body } = await call("/api/dashboard/metrics?region_id=jharkhand");
      if (status !== 200) throw new Error(`status ${status}`);
      const headline = data(body).headline as Record<string, unknown>;
      if (!("pct_reaching_pilot_or_deployment" in headline)) throw new Error("KPI missing");
      return `${headline.pct_reaching_pilot_or_deployment}% reach pilot, ${headline.university_industry_collaborations} collaborations`;
    },
  },
  {
    name: "Silent zones are detected",
    run: async () => {
      const { status, body } = await call("/api/map/silent-zones?region_id=jharkhand");
      if (status !== 200) throw new Error(`status ${status}`);
      const zones = (data(body).silent_zones ?? []) as unknown[];
      return `${zones.length} silent zone(s) flagged for a field survey`;
    },
  },
  {
    name: "A mock drill switches districts to Crisis Mode",
    run: async () => {
      await loginAs("coordinator");
      const { status, body } = await call("/api/crisis/start", {
        method: "POST",
        body: JSON.stringify({
          region_id: "jharkhand",
          hazard: "flood",
          drill: true,
          source: "drill",
          headline: "Smoke-test drill",
          districts: ["Sahebganj"],
          severity: 5,
        }),
      });
      if (status !== 201 && status !== 200) throw new Error(`status ${status}: ${JSON.stringify(body)}`);
      const d = data(body);
      if (!d.is_drill) throw new Error("the drill was not labelled as a drill");
      return `${d.challenges_switched} challenges switched, banner: ${d.banner}`;
    },
  },
];

async function main() {
  console.log(`Running the judge's journey against ${BASE}\n`);

  let passed = 0;
  let failed = 0;

  for (const check of CHECKS) {
    process.stdout.write(`  ${check.name} ... `);
    try {
      const detail = await check.run();
      console.log(`ok\n      ${detail}`);
      passed++;
    } catch (error) {
      console.log(`FAILED\n      ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error("\nThe smoke run could not start:\n", error instanceof Error ? error.message : error);
  process.exit(1);
});
