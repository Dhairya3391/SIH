import type { SupabaseClient } from "@supabase/supabase-js";
import { localEmbed, toPgVector } from "@/lib/ai/local-embed";
import { compileWithRules } from "@/lib/ai/fallback";
import { computePriority, explainPriority } from "@/lib/domain/priority";
import { computeConfidence } from "@/lib/domain/confidence";
import { computeReadiness } from "@/lib/domain/readiness";
import { parseCodedSms } from "@/lib/sms/codec";
import { USER_ROLES, type Category, type VulnerabilityTag } from "@/lib/domain/types";
import { appendMany } from "@/lib/services/ledger";
import * as SEED from "./data";

/**
 * Seeds both demo scenarios, the background data and the Rajkot region.
 *
 * Two rules this file follows without exception:
 *
 *   1. No AI calls. Seeding uses the rule-based compiler and the local
 *      embedding fallback, so `npm run db:seed` finishes in seconds and works
 *      with no API keys at all. A demo reset must never depend on a network.
 *   2. Everything is labelled `is_simulated`, so no screen can show a made-up
 *      number without saying that is what it is.
 */

export interface SeedOptions {
  wipe?: boolean;
  /** Skip the six demo accounts when they already exist. */
  skipUsers?: boolean;
}

export interface SeedSummary {
  regions: number;
  users: number;
  organizations: number;
  resources: number;
  hazard_cells: number;
  reports: number;
  challenges: number;
  solutions: number;
  pledges: number;
  crisis_events: number;
}

const JHARKHAND = "jharkhand";
const RAJKOT = "rajkot";

export async function seedDatabase(
  supabase: SupabaseClient,
  options: SeedOptions = {},
): Promise<SeedSummary> {
  if (options.wipe) await wipe(supabase);

  const summary: SeedSummary = {
    regions: 0, users: 0, organizations: 0, resources: 0, hazard_cells: 0,
    reports: 0, challenges: 0, solutions: 0, pledges: 0, crisis_events: 0,
  };

  summary.regions = await seedRegions(supabase);
  const orgIds = await seedOrganizations(supabase);
  summary.organizations = orgIds.size;

  const [
    resourcesCount,
    hazardsCount,
    usersCount,
    solvedLibraryChallenges,
    scenarioA,
    scenarioB,
    background,
    rajkot,
  ] = await Promise.all([
    seedResources(supabase, orgIds),
    seedHazards(supabase),
    options.skipUsers ? seedExistingDemoUsers(supabase, orgIds) : seedDemoUsers(supabase, orgIds),
    seedSolvedLibrary(supabase),
    seedGumlaLightning(supabase, orgIds),
    seedSahebganjFlood(supabase, orgIds),
    seedBackground(supabase),
    seedRajkot(supabase),
  ]);

  summary.resources = resourcesCount;
  summary.hazard_cells = hazardsCount;
  summary.users = usersCount;
  summary.challenges += solvedLibraryChallenges;

  summary.reports += scenarioA.reports;
  summary.challenges += scenarioA.challenges;
  summary.solutions += scenarioA.solutions;
  summary.pledges += scenarioA.pledges;

  summary.reports += scenarioB.reports;
  summary.challenges += scenarioB.challenges;
  summary.crisis_events += scenarioB.crises;
  summary.pledges += scenarioB.pledges;

  summary.reports += background.reports;
  summary.challenges += background.challenges;

  summary.reports += rajkot.reports;
  summary.challenges += rajkot.challenges;

  return summary;
}

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------

async function wipe(supabase: SupabaseClient): Promise<void> {
  // The ledger has append-only triggers, so it is truncated through a function
  // rather than deleted through PostgREST.
  await supabase.rpc("demo_truncate_all").then(
    () => undefined,
    async () => {
      // Fall back to ordered deletes if the helper function is not installed.
      const tables = [
        "notifications", "impact_records", "evidence_files", "milestones",
        "pledges", "resource_needs", "solutions", "team_members", "assignments",
        "matches", "verifications", "sms_inbox", "reports", "challenges",
        "crisis_events", "resources", "org_capabilities", "organizations",
        "hazard_cells",
      ];
      for (const table of tables) {
        await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function seedRegions(supabase: SupabaseClient): Promise<number> {
  const { error } = await supabase.from("regions").upsert([
    {
      id: JHARKHAND,
      name: "Jharkhand",
      center: point(23.6102, 85.2799),
      zoom: 7,
      languages: ["hi", "en", "sat", "mun", "hoc", "kru", "nag", "kha"],
      is_default: true,
    },
    {
      id: RAJKOT,
      name: "Rajkot",
      center: point(22.3039, 70.8022),
      zoom: 9,
      languages: ["gu", "hi", "en"],
      is_default: false,
    },
  ]);
  if (error) throw error;
  return 2;
}

async function seedOrganizations(supabase: SupabaseClient): Promise<Map<string, string>> {
  const rows = [
    ...SEED.JHARKHAND_ORGS.map((o) => ({ org: o, region: JHARKHAND })),
    ...SEED.RAJKOT_ORGS.map((o) => ({ org: o, region: RAJKOT })),
  ];

  const payload = rows.map(({ org, region }) => {
    const place = findPlace(org.district, region);
    return {
      region_id: region,
      type: org.type,
      name: org.name,
      district: org.district,
      geom: point(place.lat, place.lng),
      response_radius_km: org.response_radius_km,
      expertise: org.expertise,
      csr_focus: org.csr_focus ?? [],
      csr_budget: org.csr_budget ?? null,
      about: org.about,
      // Every seeded organisation is pre-verified, otherwise the demo would
      // start with nobody able to adopt or pledge anything.
      verified: true,
      is_simulated: true,
      embedding: toPgVector(localEmbed([org.name, ...org.expertise, org.about].join(" "))),
    };
  });

  const { data, error } = await supabase.from("organizations").insert(payload).select("id, name");
  if (error) throw error;

  const byName = new Map((data ?? []).map((o) => [o.name as string, o.id as string]));

  const capabilities = rows.flatMap(({ org }) =>
    org.capabilities.map((c) => ({
      org_id: byName.get(org.name)!,
      capability: c.capability,
      capacity: c.capacity,
    })),
  );
  if (capabilities.length) await supabase.from("org_capabilities").insert(capabilities);

  return byName;
}

async function seedResources(
  supabase: SupabaseClient,
  orgIds: Map<string, string>,
): Promise<number> {
  const payload = SEED.RESOURCES.filter((r) => orgIds.has(r.orgName)).map((r) => {
    const region = SEED.RAJKOT_AREAS.some((a) => a.name === r.district) ? RAJKOT : JHARKHAND;
    const place = findPlace(r.district, region);
    return {
      org_id: orgIds.get(r.orgName)!,
      region_id: region,
      type: r.type,
      label: r.label,
      quantity: r.quantity,
      unit: r.unit,
      // Nudged off the district centre so markers do not stack exactly.
      geom: point(place.lat + jitter(0.02), place.lng + jitter(0.02)),
      availability: "available",
      is_simulated: true,
    };
  });

  const { error } = await supabase.from("resources").insert(payload);
  if (error) throw error;
  return payload.length;
}

async function seedHazards(supabase: SupabaseClient): Promise<number> {
  const rows = [
    ...SEED.JHARKHAND_HAZARDS.map((h) => ({ h, region: JHARKHAND })),
    ...SEED.RAJKOT_HAZARDS.map((h) => ({ h, region: RAJKOT })),
  ];

  const payload = rows.map(({ h, region }) => {
    const place = findPlace(h.district, region);
    return {
      region_id: region,
      hazard: h.hazard,
      district: h.district,
      geom: circle(place.lat, place.lng, h.radiusKm),
      intensity: h.intensity,
      population: h.population,
      expected_reports: h.expectedReports,
    };
  });

  const { error } = await supabase.from("hazard_cells").insert(payload);
  if (error) throw error;
  return payload.length;
}

async function seedExistingDemoUsers(
  supabase: SupabaseClient,
  orgIds: Map<string, string>,
): Promise<number> {
  const { data: existing } = await supabase.from("users").select("id, role");
  if (existing && existing.length >= 6) {
    const orgForRole: Record<string, string | null> = {
      volunteer: orgIds.get("Gram Sahyog Samiti (fictional)") ?? null,
      coordinator: orgIds.get("Jharkhand State Disaster Management Authority (demo data)") ?? null,
      university: orgIds.get("BIT Mesra, Department of Electronics and Communication") ?? null,
      industry: orgIds.get("Damodar Steel Works (fictional)") ?? null,
    };
    await Promise.all(
      Object.entries(orgForRole).map(([role, org_id]) =>
        supabase.from("users").update({ org_id, is_verified: true }).eq("role", role),
      ),
    );
    return existing.length;
  }
  return seedDemoUsers(supabase, orgIds);
}

async function seedDemoUsers(
  supabase: SupabaseClient,
  orgIds: Map<string, string>,
): Promise<number> {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    console.warn("[seed] DEMO_PASSWORD is not set, so the six demo accounts were skipped.");
    return 0;
  }
  const domain = process.env.DEMO_EMAIL_DOMAIN ?? "jharsetu.demo";

  const orgForRole: Record<string, string | null> = {
    citizen: null,
    volunteer: orgIds.get("Gram Sahyog Samiti (fictional)") ?? null,
    coordinator: orgIds.get("Jharkhand State Disaster Management Authority (demo data)") ?? null,
    university: orgIds.get("BIT Mesra, Department of Electronics and Communication") ?? null,
    industry: orgIds.get("Damodar Steel Works (fictional)") ?? null,
    admin: null,
  };

  const names: Record<string, string> = {
    citizen: "Somra Oraon (demo citizen)",
    volunteer: "Demo field volunteer",
    coordinator: "Demo district coordinator",
    university: "Demo university team lead",
    industry: "Demo CSR lead",
    admin: "Demo administrator",
  };

  let created = 0;
  const { data: authList } = await supabase.auth.admin.listUsers();
  const existingByEmail = new Map((authList?.users ?? []).map((u) => [u.email, u.id]));

  for (const role of USER_ROLES) {
    const email = `${role}@${domain}`;
    let userId = existingByEmail.get(email);

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role,
          full_name: names[role],
          region_id: JHARKHAND,
          language: role === "citizen" ? "hi" : "en",
          district: role === "citizen" ? "Gumla" : "Ranchi",
        },
      });

      if (error) {
        if (!/already|exists|registered/i.test(error.message)) {
          console.warn(`[seed] could not create ${email}: ${error.message}`);
        }
        continue;
      }
      userId = data.user.id;
    }

    if (userId) {
      await supabase.from("users").upsert({
        id: userId,
        role,
        full_name: names[role],
        region_id: JHARKHAND,
        language: role === "citizen" ? "hi" : "en",
        district: role === "citizen" ? "Gumla" : "Ranchi",
        org_id: orgForRole[role],
        is_verified: true,
      });
      created++;
    }
  }
  return created;
}

// ---------------------------------------------------------------------------
// Scenario A: lightning safety for farm workers, Gumla
// ---------------------------------------------------------------------------

/**
 * The brief is written out rather than generated, because this is the card the
 * whole pitch is built around and it has to read exactly as designed. Every
 * other challenge in the seed goes through the rule-based compiler.
 */
const GUMLA_BRIEF = {
  title: "Last-mile lightning alerts and safe shelter for farm workers, Gumla block",
  problem:
    "Official lightning alerts exist, from IMD and from IITM Pune's Damini app, but workers in open fields without smartphones never receive them, and there is nowhere safe to shelter.",
  category: "disaster_safety" as Category,
  dm_phase: "preparedness" as const,
  severity: 5,
  urgency: 4,
  people_est: 4800,
  vulnerable: ["elderly", "children", "no_signal"] as VulnerabilityTag[],
  district: "Gumla",
  village: null,
  needs: [
    "A siren relay that plays official alerts (electronics)",
    "12 siren units",
    "A low-cost shelter design (civil)",
    "Village training",
  ],
  capabilities: ["electronics", "siren", "civil", "shelter", "training"],
  outcome: "Sirens and shelters working in 12 pilot villages before the next monsoon.",
  success_metric:
    "Alerts reach registered farm workers ahead of storms in every pilot village, and no lightning deaths in pilot villages this season.",
  hazard_tags: ["lightning"],
  sdg_tags: ["SDG 11", "SDG 13"],
  sendai_tags: ["understanding_risk", "investing_in_resilience"],
  uncertainties: [
    "The exact number of workers affected was estimated from 31 reports and village sizes, so a coordinator should confirm it.",
    "Whether two of the twelve villages share a panchayat could not be determined from the reports.",
  ],
  source: "fallback" as const,
  translated_text:
    "Lightning repeatedly kills and injures farm workers across twelve villages in Gumla block. Official warnings never reach people working in open fields, and there is no safe shelter nearby.",
  detected_language: "hi",
};

async function seedGumlaLightning(supabase: SupabaseClient, orgIds: Map<string, string>) {
  const gumla = findPlace("Gumla", JHARKHAND);
  const embedding = toPgVector(
    localEmbed([GUMLA_BRIEF.title, GUMLA_BRIEF.problem, GUMLA_BRIEF.needs.join(" ")].join(" ")),
  );

  const reporters = SEED.GUMLA_LIGHTNING_REPORTS.length;
  const priority = computePriority({
    severity: 5,
    urgency: 4,
    peopleAffected: 4800,
    vulnerable: GUMLA_BRIEF.vulnerable,
    hazardExposure: 0.95,
    resourceGap: 1,
    recurrenceCount: 2,
    uniqueReporters: reporters,
    crisisMode: false,
  });

  const confidence = computeConfidence({
    uniqueReporters: reporters,
    hasFieldVerification: true,
    coordinatorApproved: true,
    resolvedWithEvidence: false,
    openInaccurateFlags: 0,
  });

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      region_id: JHARKHAND,
      title: GUMLA_BRIEF.title,
      brief: GUMLA_BRIEF,
      category: GUMLA_BRIEF.category,
      dm_phase: GUMLA_BRIEF.dm_phase,
      district: "Gumla",
      block: "Gumla block",
      geom: point(gumla.lat, gumla.lng),
      people_est: 4800,
      severity: 5,
      severity_source: "coordinator",
      priority: priority.total,
      score_breakdown: priority,
      why_critical: explainPriority(priority, {
        district: "Gumla",
        peopleAffected: 4800,
        hasPartner: false,
      }),
      confidence: confidence.level,
      status: "SOLUTION_PROPOSED",
      capabilities: GUMLA_BRIEF.capabilities,
      hazard_tags: ["lightning"],
      sdg_tags: GUMLA_BRIEF.sdg_tags,
      sendai_tags: GUMLA_BRIEF.sendai_tags,
      ai_uncertainties: GUMLA_BRIEF.uncertainties,
      embedding,
      is_simulated: true,
      refined_at: daysAgo(9),
      verified_at: daysAgo(8),
      team_formed_at: daysAgo(6),
    })
    .select("id, ref")
    .single();
  if (error) throw error;

  // The 31 reports, spread over the last few weeks.
  const reports = SEED.GUMLA_LIGHTNING_REPORTS.map((r, i) => {
    const village = SEED.GUMLA_VILLAGES.find((v) => v.name === r.village) ?? SEED.GUMLA_VILLAGES[0];
    return {
      client_id: `seed-gumla-${i}`,
      region_id: JHARKHAND,
      channel: (i % 9 === 0 ? "volunteer" : "web") as "web" | "volunteer",
      original_text: r.text,
      translated_text: r.text,
      lang: r.lang,
      geom: point(village.lat + jitter(0.004), village.lng + jitter(0.004)),
      location_source: "gps",
      district: "Gumla",
      village: r.village,
      people_est: r.people ?? null,
      urgency: r.urgency ?? null,
      vulnerable: r.vulnerable ?? [],
      photo_urls: i % 5 === 0 ? [`seed/gumla/photo-${i}.jpg`] : [],
      cluster_id: challenge.id,
      dedup_similarity: 0.86 + (i % 10) / 100,
      consent: true,
      is_simulated: true,
      embedding: toPgVector(localEmbed(r.text)),
      created_at: daysAgo(20 - Math.floor(i / 2)),
      processed_at: daysAgo(20 - Math.floor(i / 2)),
    };
  });
  await supabase.from("reports").insert(reports);
  await supabase.rpc("recount_cluster", { p_challenge: challenge.id });

  await supabase.from("verifications").insert([
    { challenge_id: challenge.id, kind: "field", note: "Confirmed on the ground. Photographed two damaged fields and the nearest community hall.", evidence_url: "seed/gumla/field-1.jpg" },
    { challenge_id: challenge.id, kind: "field", note: "Second volunteer visit. Four of the twelve villages have a hall that could serve as a shelter.", evidence_url: "seed/gumla/field-2.jpg" },
    { challenge_id: challenge.id, kind: "still_exists", note: "Still happening. Another near miss during last week's storm." },
  ]);

  // The two proposals. Their ratings reproduce the 48 and 84 from the playbook.
  const proposalA = computeReadiness({
    technical: 3, cost: 1, time_to_deploy: 1, local_resources: 2,
    safety: 4, community_acceptance: 3, scalability: 3,
  });
  const proposalB = computeReadiness({
    technical: 5, cost: 4, time_to_deploy: 4, local_resources: 4,
    safety: 4, community_acceptance: 4, scalability: 4,
  });

  const { data: solutions } = await supabase
    .from("solutions")
    .insert([
      {
        challenge_id: challenge.id,
        org_id: orgIds.get("Ranchi University, Department of Geography") ?? null,
        title: "Custom sensor network with AI lightning prediction",
        approach:
          "Build a bespoke network of electric-field sensors across the block and train a model to predict strikes minutes in advance, with alerts pushed to a new mobile app.",
        cost_estimate: 4_200_000,
        deploy_days: 420,
        risks:
          "Needs a validated dataset we do not have, a year of development, and smartphones that the affected workers do not own.",
        ratings: { technical: 3, cost: 1, time_to_deploy: 1, local_resources: 2, safety: 4, community_acceptance: 3, scalability: 3 },
        readiness: proposalA.total,
        readiness_notes: "Impressive, but it cannot be deployed before the coming monsoon.",
        status: "rejected",
        is_simulated: true,
        created_at: daysAgo(5),
      },
      {
        challenge_id: challenge.id,
        org_id: orgIds.get("BIT Mesra, Department of Electronics and Communication") ?? null,
        title: "Siren relay for official IMD and Damini alerts, plus low-cost shelter kits",
        approach:
          "Solar-powered siren relays mounted on panchayat buildings play the existing official alert, with a manual trigger for the local warden. Twelve villages get a low-cost shelter design built with village labour, and training on what the siren means.",
        cost_estimate: 620_000,
        deploy_days: 55,
        risks:
          "Depends on the official alert feed staying available, and on a village warden being trained in each location.",
        ratings: { technical: 5, cost: 4, time_to_deploy: 4, local_resources: 4, safety: 4, community_acceptance: 4, scalability: 4 },
        readiness: proposalB.total,
        readiness_notes: "Uses alerts that already exist and siren stock that already exists. Deployable before the monsoon.",
        status: "approved_for_pilot",
        is_simulated: true,
        created_at: daysAgo(5),
      },
    ])
    .select("id, status");

  const pilot = (solutions ?? []).find((s) => s.status === "approved_for_pilot");

  // The resource needs, and the Resource Swarm part-way through: 8 of 12 siren
  // units pledged, so the demo can close the last 4 live on stage.
  const { data: needs } = await supabase
    .from("resource_needs")
    .insert([
      { challenge_id: challenge.id, solution_id: pilot?.id ?? null, item: "Siren units", qty_needed: 12, unit: "unit", kind: "equipment", capability: "siren" },
      { challenge_id: challenge.id, solution_id: pilot?.id ?? null, item: "Shelter construction kits", qty_needed: 12, unit: "kit", kind: "equipment", capability: "civil" },
      { challenge_id: challenge.id, solution_id: pilot?.id ?? null, item: "Village training sessions", qty_needed: 12, unit: "session", kind: "people", capability: "training" },
    ])
    .select("id, item");

  const sirenNeed = (needs ?? []).find((n) => n.item === "Siren units");
  const trainingNeed = (needs ?? []).find((n) => n.item === "Village training sessions");

  let pledges = 0;
  if (sirenNeed) {
    await supabase.from("pledges").insert({
      need_id: sirenNeed.id,
      org_id: orgIds.get("Damodar Steel Works (fictional)")!,
      qty: 8,
      kind: "equipment",
      status: "confirmed",
      note: "CSR contribution towards the pilot. Eight of twelve units.",
    });
    pledges++;
  }
  if (trainingNeed) {
    await supabase.from("pledges").insert({
      need_id: trainingNeed.id,
      org_id: orgIds.get("Gram Sahyog Samiti (fictional)")!,
      qty: 12,
      kind: "people",
      status: "confirmed",
      note: "Our field team will run the village sessions.",
    });
    pledges++;
  }

  // The team that has already formed.
  await supabase.from("assignments").insert([
    { challenge_id: challenge.id, org_id: orgIds.get("BIT Mesra, Department of Electronics and Communication")!, role: "builder", accepted_at: daysAgo(6) },
    { challenge_id: challenge.id, org_id: orgIds.get("Damodar Steel Works (fictional)")!, role: "funder", accepted_at: daysAgo(4) },
    { challenge_id: challenge.id, org_id: orgIds.get("Gram Sahyog Samiti (fictional)")!, role: "deliverer", accepted_at: daysAgo(4) },
  ]);

  await supabase.from("team_members").insert([
    { challenge_id: challenge.id, seat: "ECE", filled: true },
    { challenge_id: challenge.id, seat: "ECE", filled: true },
    { challenge_id: challenge.id, seat: "CSE", filled: true },
    { challenge_id: challenge.id, seat: "Civil", filled: true },
    { challenge_id: challenge.id, seat: "Mentor", filled: true },
  ]);

  await supabase.from("milestones").insert([
    { challenge_id: challenge.id, solution_id: pilot?.id ?? null, title: "Siren relay prototype tested against the live alert feed", due: inDays(10), status: "done", completed_at: daysAgo(2) },
    { challenge_id: challenge.id, solution_id: pilot?.id ?? null, title: "Shelter design approved by the district engineer", due: inDays(25), status: "in_progress" },
    { challenge_id: challenge.id, solution_id: pilot?.id ?? null, title: "Twelve villages trained on the siren protocol", due: inDays(45), status: "pending" },
  ]);

  // Ledger entries for every lifecycle transition.
  // The seed writes rows directly into tables without going through the API
  // lifecycle, so these entries backfill the timeline that the challenge
  // detail page and GET /timeline both read.
  await appendMany(supabase, [
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "reported",
      regionId: JHARKHAND,
      payload: { ref: challenge.ref, district: "Gumla", report_count: reports.length },
      actor: null,
      actorRole: "citizen",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "refined",
      regionId: JHARKHAND,
      payload: { note: "Brief confirmed by the compiler. 31 reports across 12 villages." },
      actor: null,
      actorRole: "system",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "verified",
      regionId: JHARKHAND,
      payload: { note: "Two field visits confirmed. Coordinator reviewed and approved.", verifications: 3 },
      actor: null,
      actorRole: "coordinator",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "team_formed",
      regionId: JHARKHAND,
      payload: { assignments: 3, team_size: 5 },
      actor: null,
      actorRole: "coordinator",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "solution_proposed",
      regionId: JHARKHAND,
      payload: { solutions: 2, approved_for_pilot: "Siren relay for official IMD and Damini alerts, plus low-cost shelter kits" },
      actor: null,
      actorRole: "university",
    },
  ]);

  // A second Gumla challenge, already at the evidence stage, so the "prove"
  // step of the demo has something finished to show without waiting.
  const proven = await seedProvenPilot(supabase, orgIds);

  return {
    reports: reports.length,
    challenges: 1 + proven.challenges,
    solutions: 2,
    pledges: pledges + proven.pledges,
  };
}

/** A finished pilot with before-and-after photos and a full impact record. */
async function seedProvenPilot(supabase: SupabaseClient, orgIds: Map<string, string>) {
  const village = SEED.GUMLA_VILLAGES[2];
  const brief = compileWithRules({
    text: "Bijli girne se khatra tha aur koi shelter nahi tha. Ab siren aur shelter lag gaya hai teen gaon me.",
    peopleEst: 1200,
    urgency: 4,
    vulnerable: ["elderly", "children"],
    district: "Gumla",
    village: village.name,
    lang: "hi",
  });

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({
      region_id: JHARKHAND,
      title: "Siren relay and shelter pilot, three villages in Ghaghra panchayat",
      brief: { ...brief, title: "Siren relay and shelter pilot, three villages in Ghaghra panchayat" },
      category: "disaster_safety",
      dm_phase: "preparedness",
      district: "Gumla",
      geom: point(village.lat, village.lng),
      people_est: 1200,
      severity: 4,
      priority: 68,
      confidence: "resolved_with_evidence",
      status: "DEPLOYED",
      capabilities: ["electronics", "siren", "civil"],
      hazard_tags: ["lightning"],
      is_simulated: true,
      embedding: toPgVector(localEmbed("siren relay shelter lightning Gumla pilot deployed")),
      refined_at: daysAgo(80),
      verified_at: daysAgo(78),
      team_formed_at: daysAgo(70),
      deployed_at: daysAgo(6),
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("assignments").insert([
    { challenge_id: challenge.id, org_id: orgIds.get("BIT Mesra, Department of Electronics and Communication")!, role: "builder", accepted_at: daysAgo(70) },
    { challenge_id: challenge.id, org_id: orgIds.get("Chhotanagpur Electricals (fictional)")!, role: "funder", accepted_at: daysAgo(68) },
  ]);

  await supabase.from("evidence_files").insert([
    { challenge_id: challenge.id, url: "seed/proven/before-1.jpg", phase: "before", caption: "Open field with no shelter, before the pilot." },
    { challenge_id: challenge.id, url: "seed/proven/before-2.jpg", phase: "before", caption: "Panchayat building before the relay was mounted." },
    { challenge_id: challenge.id, url: "seed/proven/after-1.jpg", phase: "after", caption: "Siren relay mounted and tested against the live alert feed." },
    { challenge_id: challenge.id, url: "seed/proven/after-2.jpg", phase: "after", caption: "Completed shelter, in use during the first storm of the season." },
    { challenge_id: challenge.id, url: "seed/proven/closure.pdf", phase: "closure", caption: "Completion note and the village warden roster." },
  ]);

  await supabase.from("verifications").insert({
    challenge_id: challenge.id,
    kind: "field",
    note: "Visited all three villages. Sirens audible across the fields, shelters in use.",
    evidence_url: "seed/proven/after-1.jpg",
  });

  await supabase.from("impact_records").insert({
    challenge_id: challenge.id,
    people_served: 1200,
    vulnerable_served: 430,
    time_to_match_min: 14_400,
    time_to_resolution_min: 106_560,
    remaining_need: "Nine of the twelve villages in the wider block still have no siren or shelter.",
    community_confirmed: false,
  });

  // Backfill the full lifecycle so this challenge's timeline is non-empty.
  await appendMany(supabase, [
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "reported",
      regionId: JHARKHAND,
      payload: { district: "Gumla", block: "Ghaghra panchayat" },
      actorRole: "citizen",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "refined",
      regionId: JHARKHAND,
      payload: { note: "Compiled from four reports. Siren relay category confirmed." },
      actorRole: "system",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "verified",
      regionId: JHARKHAND,
      payload: { note: "Field visit confirmed. All three villages reached." },
      actorRole: "coordinator",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "team_formed",
      regionId: JHARKHAND,
      payload: { assignments: 2 },
      actorRole: "coordinator",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "solution_proposed",
      regionId: JHARKHAND,
      payload: { note: "BIT Mesra proposed the siren relay design." },
      actorRole: "university",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "piloted",
      regionId: JHARKHAND,
      payload: { note: "Pilot approved. Sirenunits installed in all three villages." },
      actorRole: "coordinator",
    },
    {
      entity: "challenge",
      entityId: challenge.id,
      action: "deployed",
      regionId: JHARKHAND,
      payload: { people_served: 1200, vulnerable_served: 430 },
      actorRole: "coordinator",
    },
  ]);

  return { challenges: 1, pledges: 0 };
}

// ---------------------------------------------------------------------------
// Scenario B: the Sahebganj flood drill
// ---------------------------------------------------------------------------

async function seedSahebganjFlood(supabase: SupabaseClient, orgIds: Map<string, string>) {
  const { data: crisis, error } = await supabase
    .from("crisis_events")
    .insert({
      region_id: JHARKHAND,
      hazard: "flood",
      source: "drill",
      headline: "IMD heavy-rain warning, Ganga rising at Sahebganj",
      is_drill: true,
      districts: ["Sahebganj"],
      severity: 5,
      started_at: hoursAgo(6),
    })
    .select("id")
    .single();
  if (error) throw error;

  let reports = 0;
  let pledges = 0;

  const results = await Promise.all(
    SEED.SAHEBGANJ_FLOOD_NEEDS.map(async (need) => {
      let needPledges = 0;
      const village = SEED.SAHEBGANJ_VILLAGES.find((v) => v.name === need.village)!;
      const brief = {
        ...compileWithRules({
          text: need.text,
          peopleEst: need.people,
          urgency: need.urgency,
          vulnerable: need.vulnerable as VulnerabilityTag[],
          district: "Sahebganj",
          village: need.village,
          lang: "en",
        }),
        title: need.title,
        capabilities: need.capabilities,
      };

      const priority = computePriority({
        severity: need.severity,
        urgency: need.urgency,
        peopleAffected: need.people,
        vulnerable: need.vulnerable as VulnerabilityTag[],
        hazardExposure: 0.92,
        resourceGap: 1,
        recurrenceCount: 1,
        uniqueReporters: 4,
        crisisMode: true,
      });

      const { data: challenge } = await supabase
        .from("challenges")
        .insert({
          region_id: JHARKHAND,
          title: need.title,
          brief,
          category: need.category as Category,
          dm_phase: "response",
          district: "Sahebganj",
          geom: point(village.lat, village.lng),
          people_est: need.people,
          severity: need.severity,
          priority: priority.total,
          score_breakdown: priority,
          why_critical: explainPriority(priority, {
            district: "Sahebganj",
            peopleAffected: need.people,
            hasPartner: false,
          }),
          confidence: "community_corroborated",
          status: "OPEN",
          mode: "crisis",
          crisis_id: crisis.id,
          capabilities: need.capabilities,
          hazard_tags: ["flood"],
          ai_uncertainties: brief.uncertainties,
          embedding: toPgVector(localEmbed(`${need.title} ${need.text}`)),
          is_simulated: true,
          refined_at: hoursAgo(5),
        })
        .select("id")
        .single();
      if (!challenge) return { reports: 0, pledges: 0 };

      await supabase.from("reports").insert({
        client_id: `seed-flood-${need.village}`,
        region_id: JHARKHAND,
        channel: "web",
        original_text: need.text,
        translated_text: need.text,
        lang: "en",
        geom: point(village.lat + jitter(0.003), village.lng + jitter(0.003)),
        location_source: "gps",
        district: "Sahebganj",
        village: need.village,
        people_est: need.people,
        urgency: need.urgency,
        vulnerable: need.vulnerable,
        cluster_id: challenge.id,
        consent: true,
        is_simulated: true,
        embedding: toPgVector(localEmbed(need.text)),
        created_at: hoursAgo(5),
        processed_at: hoursAgo(5),
      });

      const { data: insertedNeeds } = await supabase
        .from("resource_needs")
        .insert(
          need.needs.map((n) => ({
            challenge_id: challenge.id,
            item: n.item,
            qty_needed: n.qty,
            unit: n.unit,
            kind: n.kind,
            capability: n.capability,
          })),
        )
        .select("id, item");

      if (need.category === "water") {
        const filters = (insertedNeeds ?? []).find((n) => n.item === "Water filtration units");
        const boats = (insertedNeeds ?? []).find((n) => n.item.includes("boat"));
        const testing = (insertedNeeds ?? []).find((n) => n.item.includes("testing"));

        if (filters) {
          await supabase.from("pledges").insert({
            need_id: filters.id,
            org_id: orgIds.get("Ganga Water Systems (fictional)")!,
            qty: 6,
            kind: "equipment",
            status: "offered",
            note: "Six units available from the Sahebganj warehouse today.",
          });
          needPledges++;
        }
        if (boats) {
          await supabase.from("pledges").insert({
            need_id: boats.id,
            org_id: orgIds.get("Ganga Tat Seva Sansthan (fictional)")!,
            qty: 2,
            kind: "people",
            status: "confirmed",
            note: "Both boats and crew confirmed for last-mile distribution.",
          });
          needPledges++;
        }
        if (testing) {
          await supabase.from("assignments").insert({
            challenge_id: challenge.id,
            org_id: orgIds.get("Central University of Jharkhand, Environmental Sciences")!,
            role: "builder",
          });
        }
      }

      return { reports: 1, pledges: needPledges };
    }),
  );

  for (const r of results) {
    reports += r.reports;
    pledges += r.pledges;
  }

  // Two SMS reports already in the crisis room, so the live one on stage has a
  // backup sitting beside it.
  await Promise.all(
    SEED.SAHEBGANJ_SMS_REPORTS.map(async (sms, i) => {
      const parsed = parseCodedSms(sms.raw);
      const village = SEED.SAHEBGANJ_VILLAGES[0];

      const { data: report } = await supabase
        .from("reports")
        .insert({
          client_id: `seed-sms-${i}`,
          region_id: JHARKHAND,
          channel: "sms",
          sms_code: parsed?.code ?? `SMS${i}`,
          phone_hash: `seed-phone-${i}`,
          original_text: parsed ? parsed.text : sms.raw,
          translated_text: parsed ? parsed.text : sms.raw,
          lang: "hi",
          geom: parsed?.lat != null ? point(parsed.lat, parsed.lng!) : null,
          location_source: parsed?.lat != null ? "sms" : "none",
          district: "Sahebganj",
          village: parsed?.lat != null ? village.name : "Radhanagar",
          people_est: parsed?.peopleEst ?? null,
          urgency: parsed?.severity ?? 4,
          vulnerable: parsed?.vulnerable ?? ["elderly", "children"],
          consent: false,
          is_simulated: true,
          embedding: toPgVector(localEmbed(parsed ? parsed.text : sms.raw)),
          created_at: hoursAgo(2 - i),
          processed_at: hoursAgo(2 - i),
        })
        .select("id")
        .single();

      await supabase.from("sms_inbox").insert({
        phone_hash: `seed-phone-${i}`,
        raw_text: sms.raw,
        parsed: parsed as unknown as Record<string, unknown> | null,
        parse_ok: Boolean(parsed),
        report_id: report?.id ?? null,
        received_at: hoursAgo(2 - i),
      });
    }),
  );
  reports += SEED.SAHEBGANJ_SMS_REPORTS.length;

  // An Impact Ledger entry from an earlier simulated flood, so the ledger is
  // not empty when a judge opens it.
  await seedEarlierFloodImpact(supabase, orgIds);

  return { reports, challenges: SEED.SAHEBGANJ_FLOOD_NEEDS.length + 1, crises: 1, pledges };
}

async function seedEarlierFloodImpact(supabase: SupabaseClient, orgIds: Map<string, string>) {
  const village = SEED.SAHEBGANJ_VILLAGES[1];
  const { data: challenge } = await supabase
    .from("challenges")
    .insert({
      region_id: JHARKHAND,
      title: "Emergency drinking water for two cut-off hamlets, Sahebganj (last season)",
      brief: {
        problem: "Two hamlets were cut off by the river for three days with no safe drinking water.",
        outcome: "Filtration units delivered by boat and water tested before distribution.",
      },
      category: "water",
      dm_phase: "response",
      district: "Sahebganj",
      geom: point(village.lat, village.lng),
      people_est: 200,
      severity: 5,
      priority: 71,
      confidence: "resolved_with_evidence",
      status: "IMPACT_VERIFIED",
      capabilities: ["water_testing", "logistics"],
      hazard_tags: ["flood"],
      is_simulated: true,
      embedding: toPgVector(localEmbed("emergency drinking water flood Sahebganj filtration boat")),
      refined_at: daysAgo(300),
      verified_at: daysAgo(299),
      team_formed_at: daysAgo(299),
      deployed_at: daysAgo(298),
      closed_at: daysAgo(296),
    })
    .select("id")
    .single();
  if (!challenge) return;

  await supabase.from("evidence_files").insert([
    { challenge_id: challenge.id, url: "seed/flood-past/before.jpg", phase: "before", caption: "Flooded approach to the hamlet." },
    { challenge_id: challenge.id, url: "seed/flood-past/after-1.jpg", phase: "after", caption: "Filtration unit in use at the distribution point." },
    { challenge_id: challenge.id, url: "seed/flood-past/after-2.jpg", phase: "after", caption: "Water-quality test results posted at the village noticeboard." },
  ]);

  await supabase.from("verifications").insert({
    challenge_id: challenge.id,
    kind: "field",
    note: "Field confirmation by an Aapda Mitra volunteer.",
    evidence_url: "seed/flood-past/after-1.jpg",
  });

  await supabase.from("impact_records").insert({
    challenge_id: challenge.id,
    people_served: 200,
    vulnerable_served: 78,
    time_to_match_min: 42,
    time_to_resolution_min: 540,
    remaining_need: "Recheck the water supply in 48 hours.",
    community_confirmed: true,
    community_confirmed_at: daysAgo(296),
  });

  await supabase.from("assignments").insert({
    challenge_id: challenge.id,
    org_id: orgIds.get("Ganga Tat Seva Sansthan (fictional)")!,
    role: "deliverer",
    accepted_at: daysAgo(299),
  });
}

// ---------------------------------------------------------------------------
// Background and Rajkot
// ---------------------------------------------------------------------------

async function seedBackground(supabase: SupabaseClient) {
  const reports: Record<string, unknown>[] = [];
  const challenges: Record<string, unknown>[] = [];

  let n = 0;
  for (const district of SEED.JHARKHAND_DISTRICTS) {
    for (let i = 0; i < 7; i++) {
      const template = SEED.BACKGROUND_TEMPLATES[(n + i) % SEED.BACKGROUND_TEMPLATES.length];
      const lat = district.lat + jitter(0.15);
      const lng = district.lng + jitter(0.15);
      const vulnerable = (template.vulnerable ?? []) as VulnerabilityTag[];

      const brief = compileWithRules({
        text: template.text,
        peopleEst: template.people,
        urgency: template.severity,
        vulnerable,
        district: district.name,
        lang: "en",
      });

      const priority = computePriority({
        severity: template.severity,
        urgency: Math.max(1, template.severity - 1),
        peopleAffected: template.people,
        vulnerable,
        hazardExposure: 0.3,
        resourceGap: 1,
        recurrenceCount: 0,
        uniqueReporters: 1 + (n % 4),
        crisisMode: false,
      });

      const statuses = ["REFINED", "VERIFIED", "OPEN", "OPEN", "TEAM_FORMED", "SOLUTION_PROPOSED", "PILOT"];
      const status = statuses[n % statuses.length];

      challenges.push({
        region_id: JHARKHAND,
        title: `${brief.title}`,
        brief,
        category: template.category,
        dm_phase: brief.dm_phase,
        district: district.name,
        geom: point(lat, lng),
        people_est: template.people,
        severity: template.severity,
        priority: priority.total,
        score_breakdown: priority,
        why_critical: explainPriority(priority, { district: district.name, peopleAffected: template.people }),
        confidence: n % 3 === 0 ? "community_corroborated" : "unverified",
        status,
        capabilities: brief.capabilities,
        ai_uncertainties: brief.uncertainties,
        embedding: toPgVector(localEmbed(template.text)),
        is_simulated: true,
        refined_at: daysAgo(30 + (n % 60)),
      });

      reports.push({
        client_id: `seed-bg-${n}-${i}`,
        region_id: JHARKHAND,
        channel: n % 11 === 0 ? "sms" : "web",
        original_text: template.text,
        translated_text: template.text,
        lang: n % 2 === 0 ? "hi" : "en",
        geom: point(lat, lng),
        location_source: "gps",
        district: district.name,
        people_est: template.people,
        urgency: template.severity,
        vulnerable,
        consent: true,
        is_simulated: true,
        embedding: toPgVector(localEmbed(template.text)),
        created_at: daysAgo(30 + (n % 60)),
        processed_at: daysAgo(30 + (n % 60)),
      });
      n++;
    }
  }

  const { data: inserted } = await supabase.from("challenges").insert(challenges).select("id");
  const ids = (inserted ?? []).map((c) => c.id as string);
  reports.forEach((r, i) => {
    if (ids[i]) r.cluster_id = ids[i];
  });

  await supabase.from("reports").insert(reports);
  return { reports: reports.length, challenges: challenges.length };
}

async function seedRajkot(supabase: SupabaseClient) {
  const reports: Record<string, unknown>[] = [];
  const challenges: Record<string, unknown>[] = [];

  SEED.RAJKOT_TEMPLATES.forEach((template, i) => {
    const place = findPlace(template.area, RAJKOT);
    for (let copy = 0; copy < 3; copy++) {
      const lat = place.lat + jitter(0.04);
      const lng = place.lng + jitter(0.04);
      const vulnerable = (template.vulnerable ?? []) as VulnerabilityTag[];

      if (copy === 0) {
        const brief = compileWithRules({
          text: template.text,
          peopleEst: template.people,
          urgency: template.severity,
          vulnerable,
          district: template.area,
          lang: "gu",
        });
        const priority = computePriority({
          severity: template.severity,
          urgency: template.severity,
          peopleAffected: template.people,
          vulnerable,
          hazardExposure: 0.7,
          resourceGap: 1,
          recurrenceCount: 1,
          uniqueReporters: 3,
          crisisMode: false,
        });
        challenges.push({
          region_id: RAJKOT,
          title: brief.title,
          brief,
          category: template.category,
          dm_phase: brief.dm_phase,
          district: template.area,
          geom: point(lat, lng),
          people_est: template.people,
          severity: template.severity,
          priority: priority.total,
          score_breakdown: priority,
          why_critical: explainPriority(priority, { district: template.area, peopleAffected: template.people }),
          confidence: "community_corroborated",
          status: i === 0 ? "OPEN" : "REFINED",
          capabilities: brief.capabilities,
          ai_uncertainties: brief.uncertainties,
          embedding: toPgVector(localEmbed(template.text)),
          is_simulated: true,
          refined_at: daysAgo(12 + i),
        });
      }

      reports.push({
        client_id: `seed-rajkot-${i}-${copy}`,
        region_id: RAJKOT,
        channel: "web",
        original_text: template.text,
        translated_text: template.text,
        lang: copy === 0 ? "gu" : "en",
        geom: point(lat, lng),
        location_source: "gps",
        district: template.area,
        people_est: template.people,
        urgency: template.severity,
        vulnerable,
        consent: true,
        is_simulated: true,
        embedding: toPgVector(localEmbed(template.text)),
        created_at: daysAgo(12 + i),
        processed_at: daysAgo(12 + i),
      });
    }
  });

  const { data: inserted } = await supabase.from("challenges").insert(challenges).select("id");
  const ids = (inserted ?? []).map((c) => c.id as string);
  reports.forEach((r, i) => {
    const challengeIndex = Math.floor(i / 3);
    if (ids[challengeIndex]) r.cluster_id = ids[challengeIndex];
  });

  await supabase.from("reports").insert(reports);
  return { reports: reports.length, challenges: challenges.length };
}

/** Twenty closed challenges, so the do-not-duplicate library has real entries. */
async function seedSolvedLibrary(supabase: SupabaseClient): Promise<number> {
  const rows = SEED.SOLVED_LIBRARY.map((s, i) => {
    const place = findPlace(s.district, JHARKHAND);
    return {
      region_id: JHARKHAND,
      title: s.title,
      brief: { problem: s.approach, outcome: "Delivered and confirmed by the community." },
      category: s.category as Category,
      dm_phase: "mitigation" as const,
      district: s.district,
      geom: point(place.lat + jitter(0.1), place.lng + jitter(0.1)),
      people_est: s.peopleServed,
      severity: 3,
      priority: 40 + (i % 25),
      confidence: "resolved_with_evidence" as const,
      status: "IMPACT_VERIFIED" as const,
      capabilities: [],
      is_simulated: true,
      embedding: toPgVector(localEmbed(`${s.title} ${s.approach}`)),
      refined_at: daysAgo(400 + i * 5),
      deployed_at: daysAgo(300 + i * 4),
      closed_at: daysAgo(295 + i * 4),
    };
  });

  const { data, error } = await supabase.from("challenges").insert(rows).select("id");
  if (error) throw error;

  const ids = (data ?? []).map((c) => c.id as string);

  await supabase.from("solutions").insert(
    SEED.SOLVED_LIBRARY.map((s, i) => ({
      challenge_id: ids[i],
      title: s.title,
      approach: s.approach,
      cost_estimate: s.cost,
      deploy_days: s.days,
      readiness: 70 + (i % 20),
      status: "deployed" as const,
      is_simulated: true,
    })),
  );

  await supabase.from("impact_records").insert(
    SEED.SOLVED_LIBRARY.map((s, i) => ({
      challenge_id: ids[i],
      people_served: s.peopleServed,
      vulnerable_served: Math.round(s.peopleServed * 0.3),
      time_to_match_min: 2000 + i * 300,
      time_to_resolution_min: s.days * 24 * 60,
      community_confirmed: true,
    })),
  );

  await supabase.from("evidence_files").insert(
    ids.flatMap((id, i) => [
      { challenge_id: id, url: `seed/library/${i}-before.jpg`, phase: "before" as const },
      { challenge_id: id, url: `seed/library/${i}-after.jpg`, phase: "after" as const },
    ]),
  );

  return rows.length;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function point(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

/** An n-gon standing in for a circle, which is enough for a hazard layer. */
function circle(lat: number, lng: number, radiusKm: number, sides = 18): string {
  const latDeg = radiusKm / 110.574;
  const lngDeg = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring: string[] = [];
  for (let i = 0; i <= sides; i++) {
    const theta = (i / sides) * 2 * Math.PI;
    ring.push(
      `${(lng + lngDeg * Math.cos(theta)).toFixed(6)} ${(lat + latDeg * Math.sin(theta)).toFixed(6)}`,
    );
  }
  return `SRID=4326;POLYGON((${ring.join(",")}))`;
}

function findPlace(name: string, region: string): SEED.DistrictSeed {
  const list = region === RAJKOT ? SEED.RAJKOT_AREAS : SEED.JHARKHAND_DISTRICTS;
  return list.find((d) => d.name === name) ?? list[0];
}

/** Deterministic spread, so a reseed puts markers in the same places. */
let jitterSeed = 1;
function jitter(scale: number): number {
  jitterSeed = (jitterSeed * 1103515245 + 12345) % 2147483648;
  return ((jitterSeed / 2147483648) * 2 - 1) * scale;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function hoursAgo(n: number): string {
  return new Date(Date.now() - Math.max(n, 0) * 3_600_000).toISOString();
}

function inDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}
