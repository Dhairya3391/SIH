/**
 * The rule-based Challenge Compiler.
 *
 * This is not a stub. The playbook's H9 checkpoint is the whole golden path
 * running end to end with no AI calls at all, and this file is what makes that
 * true: a keyword classifier over the eight categories, a severity heuristic, a
 * capability mapper, and a template brief. Real AI plugs in behind the same
 * function signature afterwards.
 *
 * It also means we can switch the AI off live in front of a judge.
 */

import type { CompiledBrief } from "./brief";
import type { Category, DmPhase, VulnerabilityTag } from "@/lib/domain/types";

interface Rule {
  category: Category;
  hazard?: string;
  dmPhase?: DmPhase;
  /** Words in English and transliterated Hindi. Reports arrive in both. */
  terms: string[];
  capabilities: string[];
  needs: string[];
  /** Floor for severity when this rule fires. */
  severityFloor?: number;
}

const RULES: Rule[] = [
  {
    category: "disaster_safety",
    hazard: "lightning",
    dmPhase: "preparedness",
    terms: ["lightning", "thunder", "bijli girna", "bijli girne", "bijli giri", "vajrapat", "bijli gir", "aakash bijli", "aakashiya", "thunderstorm"],
    capabilities: ["electronics", "siren", "civil", "training"],
    needs: ["A siren relay that plays official alerts", "Low-cost shelter design", "Village training"],
    severityFloor: 4,
  },
  {
    category: "disaster_safety",
    hazard: "flood",
    dmPhase: "response",
    terms: ["flood", "baadh", "badh", "paani bhar", "waterlogging", "inundat", "river overflow", "ganga"],
    capabilities: ["logistics", "mapping", "civil", "drone_mapping"],
    needs: ["Route mapping for cut-off villages", "Temporary shelter capacity", "Last-mile distribution"],
    severityFloor: 4,
  },
  {
    category: "disaster_safety",
    hazard: "fire",
    dmPhase: "mitigation",
    terms: ["fire", "aag", "blaze", "burning", "jharia"],
    capabilities: ["civil", "training", "sensors"],
    needs: ["Fire-safety audit", "Community drill"],
    severityFloor: 4,
  },
  {
    category: "disaster_safety",
    hazard: "subsidence",
    dmPhase: "mitigation",
    terms: ["subsidence", "land sink", "dhansan", "crack in ground", "mine collapse"],
    capabilities: ["civil", "sensors", "mapping"],
    needs: ["Ground survey", "Monitoring sensors"],
    severityFloor: 4,
  },
  {
    category: "water",
    dmPhase: "response",
    terms: ["water", "pani", "paani", "drinking water", "handpump", "hand pump", "chapakal", "well", "kuan", "tubewell", "contaminat"],
    capabilities: ["water_testing", "water_quality", "logistics", "civil"],
    needs: ["Water-quality testing", "Filtration units", "Distribution plan"],
    severityFloor: 3,
  },
  {
    category: "health",
    dmPhase: "response",
    terms: ["health", "medicine", "dawa", "hospital", "clinic", "doctor", "bimar", "ill", "disease", "snakebite", "saanp", "ambulance", "phc"],
    capabilities: ["health", "logistics", "training"],
    needs: ["Last-mile medicine route", "Health-worker support"],
    severityFloor: 3,
  },
  {
    category: "education",
    dmPhase: "mitigation",
    terms: ["school", "vidyalaya", "teacher", "shikshak", "classroom", "student", "padhai", "anganwadi"],
    capabilities: ["education", "civil", "training"],
    needs: ["Learning support", "Safe classroom repair"],
  },
  {
    category: "agriculture",
    dmPhase: "mitigation",
    terms: ["crop", "fasal", "farm", "kheti", "khet", "irrigation", "sinchai", "seed", "beej", "harvest", "drought", "sookha", "elephant", "hathi"],
    capabilities: ["agriculture", "extension", "sensors"],
    needs: ["Extension advisory", "Field survey"],
  },
  {
    category: "roads_infra",
    dmPhase: "recovery",
    terms: ["road", "sadak", "bridge", "pul", "culvert", "blocked", "rasta", "transport", "path"],
    capabilities: ["civil", "logistics", "mapping"],
    needs: ["Route survey", "Temporary crossing"],
    severityFloor: 3,
  },
  {
    category: "energy_connectivity",
    dmPhase: "preparedness",
    terms: ["electricity", "bijli", "power cut", "network", "signal", "mobile", "tower", "internet", "solar", "generator"],
    capabilities: ["electronics", "energy", "telemetry"],
    needs: ["Backup power", "Connectivity survey"],
  },
  {
    category: "environment",
    dmPhase: "mitigation",
    terms: ["forest", "jangal", "pollution", "waste", "kachra", "tree", "ped", "air quality", "mining dust"],
    capabilities: ["environment", "water_testing", "mapping"],
    needs: ["Environmental assessment"],
  },
];

/** Phrases that push severity up, in English and transliterated Hindi. */
const SEVERITY_5 = ["death", "died", "killed", "mar gaya", "mar gaye", "maut", "marne", "jaan chali gayi", "jaan chali", "drown", "dub gaya", "collapse", "trapped", "fanse"];
const SEVERITY_4 = ["injur", "ghayal", "serious", "danger", "khatra", "emergency", "cut off", "no access", "बीमार"];

const VULNERABILITY_TERMS: Array<[VulnerabilityTag, string[]]> = [
  ["children", ["child", "children", "bachche", "bachcha", "baby", "infant", "school kids"]],
  ["elderly", ["elder", "elderly", "old people", "budhe", "buzurg", "senior citizen"]],
  ["disability", ["disab", "viklang", "wheelchair", "blind", "deaf"]],
  ["pregnancy", ["pregnan", "garbhvati", "expecting mother"]],
  ["medical_dependency", ["medicine", "dialysis", "insulin", "regular medication", "dawa", "patient"]],
  ["isolated", ["cut off", "isolated", "no transport", "stranded", "phanse", "marooned"]],
  ["no_signal", ["no signal", "no network", "no coverage", "network nahi", "signal nahi"]],
];

/** Jharkhand's 24 districts, plus the Rajkot demo region. */
export const KNOWN_DISTRICTS = [
  "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa",
  "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma",
  "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahebganj",
  "Seraikela Kharsawan", "Simdega", "West Singhbhum", "Rajkot",
];

function scoreRule(text: string, rule: Rule): number {
  let hits = 0;
  for (const term of rule.terms) if (text.includes(term)) hits++;
  return hits;
}

export interface FallbackInput {
  text: string;
  /** Values the reporter ticked on the form. They beat anything inferred from text. */
  peopleEst?: number | null;
  urgency?: number | null;
  vulnerable?: VulnerabilityTag[];
  district?: string | null;
  village?: string | null;
  lang?: string;
  /** Reports already in this cluster, so the brief can say how many voices it carries. */
  reportCount?: number;
}

export function compileWithRules(input: FallbackInput): CompiledBrief {
  const text = (input.text || "").toLowerCase();

  // --- category -----------------------------------------------------------
  let best: Rule | null = null;
  let bestScore = 0;
  for (const rule of RULES) {
    const score = scoreRule(text, rule);
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }

  const matched = best ?? RULES[0];
  const classified = bestScore > 0;

  // --- severity -----------------------------------------------------------
  let severity = matched.severityFloor ?? 2;
  if (SEVERITY_4.some((t) => text.includes(t))) severity = Math.max(severity, 4);
  if (SEVERITY_5.some((t) => text.includes(t))) severity = 5;

  // --- vulnerability ------------------------------------------------------
  const detected = new Set<VulnerabilityTag>(input.vulnerable ?? []);
  for (const [tag, terms] of VULNERABILITY_TERMS) {
    if (terms.some((t) => text.includes(t))) detected.add(tag);
  }

  // --- people affected ----------------------------------------------------
  let peopleEst = input.peopleEst ?? 0;
  let peopleInferred = false;
  if (!peopleEst) {
    const m = text.match(/(\d{2,6})\s*(people|log|logon|persons|residents|families|parivar|workers|children|bachche|bachchon|students|kisanon|farmers|villagers)/);
    if (m) {
      peopleEst = Number(m[1]);
      if (/families|parivar/.test(m[2])) peopleEst *= 4; // a household is not a person
      peopleInferred = true;
    } else {
      peopleEst = 50; // a village hamlet, stated plainly as a placeholder below
      peopleInferred = true;
    }
  }

  // --- place --------------------------------------------------------------
  const district =
    input.district ?? KNOWN_DISTRICTS.find((d) => text.includes(d.toLowerCase())) ?? null;

  // --- brief --------------------------------------------------------------
  const where = [input.village, district].filter(Boolean).join(", ");
  const subject = detected.has("children")
    ? "children"
    : detected.has("elderly")
      ? "elderly residents"
      : matched.category === "agriculture" || matched.hazard === "lightning"
        ? "farm workers"
        : "residents";

  const title = classified
    ? `${TITLE_STEM[matched.category]}${matched.hazard ? ` (${matched.hazard})` : ""} affecting ${subject}${where ? `, ${where}` : ""}`
    : `Unclassified local need${where ? ` in ${where}` : ""}`;

  const snippet = (input.text || "").trim().slice(0, 240);

  const uncertainties: string[] = [];
  if (!classified) {
    uncertainties.push(
      "No category keyword matched, so this was filed under disaster and safety by default. A coordinator should set the right category.",
    );
  }
  if (peopleInferred) {
    uncertainties.push(
      `The figure of ${peopleEst} people affected was estimated, not reported. A coordinator should confirm it.`,
    );
  }
  if (!district) uncertainties.push("No district could be identified from the report text or its location.");
  uncertainties.push("This brief was drafted by the rule-based compiler with no AI, so the wording is generic.");

  return {
    title,
    problem: classified
      ? `${capitalise(subject)} in ${where || "this area"} are affected by ${matched.hazard ?? matched.category.replace(/_/g, " ")}. Reported as: "${snippet}".`
      : `A local need was reported that the rule-based compiler could not categorise. Reported as: "${snippet}".`,
    category: matched.category,
    dm_phase: matched.dmPhase ?? "preparedness",
    severity,
    urgency: input.urgency ?? Math.max(1, severity - 1),
    people_est: peopleEst,
    vulnerable: [...detected],
    district,
    village: input.village ?? null,
    needs: matched.needs,
    capabilities: matched.capabilities,
    outcome: `${capitalise(matched.needs[0] ?? "The fix")} delivered and working in ${where || "the affected area"}.`,
    success_metric: `The reported problem no longer occurs in ${where || "the affected area"}, confirmed by a field volunteer and by the community.`,
    hazard_tags: matched.hazard ? [matched.hazard] : [],
    sdg_tags: SDG_BY_CATEGORY[matched.category] ?? [],
    sendai_tags: ["understanding_risk"],
    uncertainties,
    source: "fallback",
    translated_text: input.text || "",
    detected_language: input.lang ?? "hi",
  };
}

const TITLE_STEM: Record<Category, string> = {
  disaster_safety: "Disaster risk",
  water: "Drinking water problem",
  health: "Health access problem",
  education: "Education gap",
  agriculture: "Agricultural problem",
  roads_infra: "Road or infrastructure problem",
  energy_connectivity: "Energy or connectivity problem",
  environment: "Environmental problem",
};

const SDG_BY_CATEGORY: Record<Category, string[]> = {
  disaster_safety: ["SDG 11", "SDG 13"],
  water: ["SDG 6"],
  health: ["SDG 3"],
  education: ["SDG 4"],
  agriculture: ["SDG 2"],
  roads_infra: ["SDG 9"],
  energy_connectivity: ["SDG 7"],
  environment: ["SDG 15"],
};

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Keyword capability mapping, the matching counterpart to the classifier above.
 * Used when no embedding is available.
 */
export function rulesForCategory(category: Category): { capabilities: string[]; needs: string[] } {
  const rule = RULES.find((r) => r.category === category);
  return { capabilities: rule?.capabilities ?? [], needs: rule?.needs ?? [] };
}
