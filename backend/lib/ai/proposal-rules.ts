import "server-only";
import {
  RUBRIC,
  RUBRIC_VERSION,
  VIABILITY_FLOOR,
  NEEDS_CHANGES_CEILING,
  clampPoints,
  type GeneratedStage,
  type ProposalExtraction,
  type ProposalReview,
  type ProposalScoreCriterion,
} from "./proposal-review";

/**
 * The published rubric, applied by rules when no model is available.
 *
 * The flow cannot stop at "waiting to be scored" because an API key is
 * missing or a provider is down: colleges are told their document is being
 * analysed, and a proposal that is never analysed never reaches a funder. So
 * the same seven criteria are checked by deterministic rules - does the
 * document use the brief's own language, does it itemise materials, name a
 * budget, a duration, a maintainer - and the verdict says plainly that rules,
 * not a model, produced it.
 *
 * The same file extracts the funding figure, duration and material list a
 * college's requirements are pre-filled from, and drafts delivery stages from
 * the document when the model cannot.
 */

const STOPWORDS = new Set(
  (
    "the and for with that this from are was were have has had will would could should into their they them " +
    "which about there been also each such more than other only over under when where what while these those " +
    "being because through after before between during including within without upon very must shall your our " +
    "its it's who whom whose how why can may might not but any all some most many much make made use used using " +
    "per via etc like just well even still here then thus hence therefore however people problem project proposal " +
    "solution district jharkhand village villages area local team plan work need needs will"
  ).split(/\s+/),
);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-zऀ-ॿ]{4,}/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

/** Pages whose text mentions any of the terms, read from the "--- page N ---" markers. */
function pagesMentioning(text: string, terms: string[]): number[] {
  if (!terms.length) return [];
  const parts = text.split(/--- page (\d+) ---/);
  const pages: number[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const body = (parts[i + 1] ?? "").toLowerCase();
    if (terms.some((t) => body.includes(t.toLowerCase()))) pages.push(Number(parts[i]));
  }
  return pages.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

const UNIT_SRC =
  "kgs?|kilograms?|grams?|g|tonnes?|tons?|units?|nos\\.?|numbers?|pcs|pieces?|sets?|metres?|meters?|m|km|litres?|liters?|bags?|rolls?|sheets?|boxes?|panels?|poles?|pairs?|kits?|bundles?|sq\\.?\\s?ft|cubic\\s?metres?|cum";

function normaliseUnit(u: string): string {
  const x = u.toLowerCase().replace(/\s+/g, "");
  if (/^kg|^kilogram/.test(x)) return "kg";
  if (/^(g|gram)/.test(x)) return "g";
  if (/^ton/.test(x)) return "tonnes";
  if (/^(unit|nos|number|pcs|piece)/.test(x)) return "units";
  if (/^(m|metre|meter)s?$/.test(x)) return "m";
  if (/^(litre|liter)/.test(x)) return "litres";
  if (/^cubic|^cum$/.test(x)) return "cubic m";
  if (/^sq/.test(x)) return "sq ft";
  return x.replace(/s$/, "") + "s";
}

const NOT_A_MATERIAL = /\b(total|cost|budget|price|amount|rupees?|inr|rs\b|salary|wage|honorarium|phase|stage|week|month|page|score)\b/i;

export function extractMaterials(text: string): ProposalExtraction["materials"] {
  const out: ProposalExtraction["materials"] = [];
  const seen = new Set<string>();
  const itemFirst = new RegExp(
    `^(?:[-*•▪◦]|\\d+[.)]|[a-z][.)])?\\s*([A-Za-z][A-Za-z0-9 ,/&()'+.-]{2,70}?)\\s*(?:[:\\-–—x×=(,]|\\bqty\\b|\\bquantity\\b)\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(${UNIT_SRC})\\b`,
    "i",
  );
  const qtyFirst = new RegExp(
    `^(?:[-*•▪◦]|\\d+[.)])?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(${UNIT_SRC})\\s*(?:of|x|×)?\\s+([A-Za-z][A-Za-z0-9 ,/&()'+.-]{2,70})$`,
    "i",
  );

  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (line.length < 4 || line.length > 160) continue;
    let item: string | null = null;
    let qty: number | null = null;
    let unit: string | null = null;

    const a = line.match(itemFirst);
    const b = a ? null : line.match(qtyFirst);
    if (a) {
      item = a[1];
      qty = Number(a[2].replace(/,/g, ""));
      unit = a[3];
    } else if (b) {
      qty = Number(b[1].replace(/,/g, ""));
      unit = b[2];
      item = b[3];
    }
    if (!item || qty == null || !Number.isFinite(qty) || qty <= 0) continue;

    item = item.replace(/\s*[-–—:(,]+\s*$/, "").replace(/\s+/g, " ").trim();
    if (item.length < 3 || NOT_A_MATERIAL.test(item)) continue;

    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ item: item.charAt(0).toUpperCase() + item.slice(1), qty, unit: unit ? normaliseUnit(unit) : null });
    if (out.length >= 20) break;
  }
  return out;
}

const MULTIPLIER: Record<string, number> = {
  lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5,
  crore: 1e7, crores: 1e7, cr: 1e7,
  k: 1e3, thousand: 1e3,
};

export function extractFunding(text: string): number | null {
  const t = text.replace(/₹/g, " Rs ");
  const money =
    /(?:\brs\.?|\binr\b|\brupees\b)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|k|thousand)?\b|\b([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?)\b/gi;
  const labelled =
    /(total|overall|grand total|budget|funding (?:required|needed|requested|sought)|amount (?:required|requested)|estimated cost|total cost|project cost)/i;

  const valueOf = (m: RegExpMatchArray): number | null => {
    const num = Number((m[1] ?? m[3] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(num) || num <= 0) return null;
    const unit = (m[2] ?? m[4] ?? "").toLowerCase();
    return Math.round(num * (MULTIPLIER[unit] ?? 1));
  };

  let labelledMax = 0;
  let anyMax = 0;
  const lines = t.split(/\n/);
  lines.forEach((line, i) => {
    const values = [...line.matchAll(money)].map(valueOf).filter((v): v is number => v != null);
    if (values.length) anyMax = Math.max(anyMax, ...values);
    if (labelled.test(line)) {
      // The figure is often on the next line of a two-column table.
      const here = values.length
        ? values
        : [...(lines[i + 1] ?? "").matchAll(money)].map(valueOf).filter((v): v is number => v != null);
      if (here.length) labelledMax = Math.max(labelledMax, ...here);
    }
  });
  return labelledMax || anyMax || null;
}

export function extractDurationDays(text: string): number | null {
  const toDays = (n: number, unit: string) =>
    n * (unit.startsWith("day") ? 1 : unit.startsWith("week") ? 7 : 30);
  const labelled =
    /(duration|timeline|time ?frame|completion|complete[d]? (?:in|within)|deliver(?:ed)? (?:in|within)|over a period of|total time|implementation period|project period)[^\n\d]{0,40}(\d{1,4})\s*(days?|weeks?|months?)/i;
  const m = text.match(labelled);
  if (m) return toDays(Number(m[2]), m[3].toLowerCase());

  let longest = 0;
  for (const mm of text.matchAll(/\b(\d{1,3})\s*(days?|weeks?|months?)\b/gi)) {
    const days = toDays(Number(mm[1]), mm[2].toLowerCase());
    if (days <= 1095 && days > longest) longest = days;
  }
  return longest || null;
}

export function extractProposalFacts(text: string): ProposalExtraction {
  return {
    funding_required: extractFunding(text),
    currency: "INR",
    duration_days: extractDurationDays(text),
    materials: extractMaterials(text),
  };
}

// ---------------------------------------------------------------------------
// The rubric, by rules
// ---------------------------------------------------------------------------

const FIX_FOR: Record<string, string> = {
  problem_fit: "Address this brief directly: explain how the solution fixes the problem as reported, and name the place.",
  technical_soundness: "Describe the technical approach: the components, their specifications and quantities.",
  practicality_in_context: "Explain how it works with unreliable power and no technician on call, and who builds it locally.",
  cost_credibility: "Give a total budget in rupees and an itemised cost breakdown.",
  timeline_credibility: "State the total duration and the phases or milestones with their lengths.",
  requirements_completeness: "List every material with a quantity and unit, one per line, e.g. 'Galvanised steel - 10 kg'.",
  maintenance_handover: "Name who owns and maintains it after handover - a panchayat, school or department.",
};

const hits = (lower: string, words: string[]) => words.filter((w) => lower.includes(w));

export function reviewProposalWithRules(input: {
  challengeTitle: string;
  challengeProblem: string;
  challengeNeeds: string[];
  challengeDistrict: string;
  documentText: string;
  documentPages: number;
}): ProposalReview {
  const doc = input.documentText;
  const lower = doc.toLowerCase();
  const docTokens = new Set(tokens(doc));
  const briefTokens = [
    ...new Set(tokens([input.challengeTitle, input.challengeProblem, ...input.challengeNeeds].join(" "))),
  ];
  const shared = briefTokens.filter((t) => docTokens.has(t));
  const overlap = briefTokens.length ? shared.length / briefTokens.length : 0;
  const district = input.challengeDistrict.trim();
  const namesDistrict = district ? lower.includes(district.toLowerCase()) : false;
  const extraction = extractProposalFacts(doc);

  const criteria: ProposalScoreCriterion[] = [];
  const add = (key: string, points: number, reason: string, pages: number[] = []) => {
    const def = RUBRIC.find((c) => c.key === key)!;
    criteria.push({ key, label: def.label, max: def.max, points: clampPoints(points, def.max), reason, pages });
  };

  // Problem fit: does it speak to THIS brief?
  let fit = overlap < 0.08 ? 0 : 25 * Math.min(1, overlap / 0.35);
  if (fit > 0 && namesDistrict) fit += 3;
  add(
    "problem_fit",
    fit,
    overlap < 0.08
      ? `The document uses almost none of this brief's language (${shared.length} of ${briefTokens.length} key terms), so it does not appear to address this problem.`
      : `It addresses ${shared.length} of ${briefTokens.length} key terms from the brief (${shared.slice(0, 6).join(", ")})${
          namesDistrict ? ` and names ${district}` : `, but never names ${district || "the district"}`
        }.`,
    pagesMentioning(doc, shared.slice(0, 8)),
  );

  const TECH = ["approach", "method", "design", "architecture", "component", "specification", "technical", "prototype", "install", "circuit", "structure", "sensor", "battery", "solar", "pipe", "concrete", "steel", "software", "hardware", "testing", "calibrat"];
  const techHits = hits(lower, TECH);
  const quantities = (doc.match(new RegExp(`\\d+(?:\\.\\d+)?\\s*(?:${UNIT_SRC})\\b`, "gi")) ?? []).length;
  add(
    "technical_soundness",
    12 * Math.min(1, techHits.length / 5) + 8 * Math.min(1, quantities / 8),
    techHits.length
      ? `Describes ${techHits.slice(0, 5).join(", ")}, with ${quantities} quantified specification${quantities === 1 ? "" : "s"}.`
      : "No technical approach, components or specifications could be found.",
    pagesMentioning(doc, techHits),
  );

  const PRACTICAL = ["solar", "battery", "offline", "without internet", "local", "panchayat", "monsoon", "low cost", "low-cost", "durable", "spare", "training", "community", "maintain", "power cut", "backup", "rugged"];
  const practicalHits = hits(lower, PRACTICAL);
  add(
    "practicality_in_context",
    15 * Math.min(1, practicalHits.length / 6),
    practicalHits.length
      ? `Considers local conditions: ${practicalHits.slice(0, 6).join(", ")}.`
      : "Says nothing about power, connectivity, local labour or the monsoon.",
    pagesMentioning(doc, practicalHits),
  );

  const costLines = doc.split(/\n/).filter((l) => /(?:₹|\brs\.?|\binr\b)\s*[\d,]+/i.test(l)).length;
  add(
    "cost_credibility",
    (extraction.funding_required ? 8 : 0) + 7 * Math.min(1, costLines / 4),
    extraction.funding_required
      ? `States a budget of ₹${extraction.funding_required.toLocaleString("en-IN")}, with ${costLines} costed line${costLines === 1 ? "" : "s"}.`
      : "No total budget in rupees could be found.",
  );

  const TIME = ["week", "month", "phase", "milestone", "timeline", "schedule"];
  const timeHits = hits(lower, TIME);
  add(
    "timeline_credibility",
    (extraction.duration_days ? 6 : 0) + 4 * Math.min(1, timeHits.length / 3),
    extraction.duration_days
      ? `States a duration of ${extraction.duration_days} days${timeHits.length ? `, broken into ${timeHits.join(", ")}` : ""}.`
      : "No overall duration could be found.",
    pagesMentioning(doc, timeHits),
  );

  add(
    "requirements_completeness",
    10 * Math.min(1, extraction.materials.length / 4),
    extraction.materials.length
      ? `Itemises ${extraction.materials.length} material${extraction.materials.length === 1 ? "" : "s"} with quantities: ${extraction.materials
          .slice(0, 4)
          .map((m) => `${m.item} (${m.qty} ${m.unit ?? ""})`.trim())
          .join(", ")}.`
      : "No materials are listed with quantities and units, so a company could not pledge against it.",
  );

  const MAINT = ["maintain", "maintenance", "handover", "hand over", "warranty", "ownership", "caretaker", "repair", "upkeep", "panchayat", "sustain"];
  const maintHits = hits(lower, MAINT);
  add(
    "maintenance_handover",
    5 * Math.min(1, maintHits.length / 2),
    maintHits.length
      ? `Covers what happens after deployment: ${maintHits.slice(0, 4).join(", ")}.`
      : "Does not say who owns or repairs it after deployment.",
    pagesMentioning(doc, maintHits),
  );

  const total = Math.round(criteria.reduce((s, c) => s + c.points, 0) * 10) / 10;
  const problemFit = criteria.find((c) => c.key === "problem_fit")?.points ?? 0;
  const verdict: ProposalReview["verdict"] =
    problemFit <= 0 || total < VIABILITY_FLOOR
      ? "not_viable"
      : total < NEEDS_CHANGES_CEILING
        ? "needs_changes"
        : "viable";

  const required_changes =
    verdict === "viable"
      ? []
      : criteria.filter((c) => c.points < c.max * 0.5).map((c) => FIX_FOR[c.key]).filter(Boolean);

  return {
    total,
    verdict,
    criteria,
    summary: `Scored against the published rubric by rule-based checks, because no AI reviewer is available on this deployment. ${
      verdict === "viable"
        ? "The document covers enough of the rubric to be viable."
        : verdict === "needs_changes"
          ? "It is close, but the gaps listed below must be addressed before it can lead."
          : "It falls below the viability floor; the reasons for each criterion are below."
    }`,
    required_changes,
    extraction,
    rubric_version: RUBRIC_VERSION,
    model: "rules-v1",
  };
}

// ---------------------------------------------------------------------------
// Delivery stages, by rules
// ---------------------------------------------------------------------------

export function generateStagesWithRules(input: {
  district?: string | null;
  documentText: string;
  durationDays: number | null;
  materials: string[];
}): GeneratedStage[] {
  const total = input.durationDays && input.durationDays > 0 ? input.durationDays : 60;
  const daysIn = (s: string): number | null => {
    const m = s.match(/(\d{1,3})\s*(days?|weeks?|months?)/i);
    if (!m) return null;
    const n = Number(m[1]);
    return m[2].toLowerCase().startsWith("day") ? n : m[2].toLowerCase().startsWith("week") ? n * 7 : n * 30;
  };
  const clean = (s: string) =>
    s.replace(/\(?\s*\d{1,3}\s*(days?|weeks?|months?)\s*\)?/gi, "").replace(/[\s:.,;–—-]+$/, "").trim();
  const materialFor = (title: string) =>
    input.materials.find((m) => title.toLowerCase().includes(m.toLowerCase())) ??
    (/procure|purchase|material|buy|supply/i.test(title) ? (input.materials[0] ?? null) : null);

  // Prefer the college's own plan when the document spells one out.
  const found: Array<{ title: string; days: number | null }> = [];
  const heading = /^(?:[-*•]\s*)?(?:phase|stage|step|milestone)\s*(\d{1,2})\s*[:.)\-–—]\s*(.{4,100})$/i;
  const span = /^(?:[-*•]\s*)?(?:weeks?|months?)\s*\d{1,2}(?:\s*(?:-|–|to)\s*\d{1,2})?\s*[:.)\-–—]\s*(.{4,100})$/i;
  for (const raw of input.documentText.split(/\n/)) {
    const line = raw.trim();
    const h = line.match(heading);
    const s = h ? null : line.match(span);
    const text = h ? h[2] : s ? s[1] : null;
    if (!text) continue;
    const title = clean(text);
    if (title.length >= 4 && !found.some((f) => f.title.toLowerCase() === title.toLowerCase())) {
      found.push({ title, days: daysIn(text) });
    }
  }

  if (found.length >= 3) {
    const stages = found.slice(0, 8);
    const known = stages.reduce((sum, s) => sum + (s.days ?? 0), 0);
    const unknown = stages.filter((s) => s.days == null).length;
    const share = unknown ? Math.max(1, Math.round(Math.max(total - known, unknown * 3) / unknown)) : 0;
    return stages.map((s, i) => ({
      seq: i + 1,
      title: s.title.charAt(0).toUpperCase() + s.title.slice(1),
      definition_of_done: `A progress update with a photo shows "${s.title}" finished.`,
      expected_days: s.days ?? share,
      needs_material: materialFor(s.title),
    }));
  }

  const where = input.district ? ` in ${input.district}` : "";
  const top = input.materials.slice(0, 3).join(", ");
  const template: Array<{ title: string; done: string; share: number; material: string | null }> = [
    { title: `Site survey and community consultation${where}`, done: "Survey notes and a photo of the consultation meeting are uploaded.", share: 0.1, material: null },
    { title: top ? `Procure materials: ${top}` : "Procure materials and equipment", done: "Every pledged material and fund is marked received, with a photo of the delivery.", share: 0.2, material: input.materials[0] ?? null },
    { title: "Build and assemble the solution", done: "A photo of the assembled solution before installation.", share: 0.3, material: null },
    { title: "Install and field-test on site", done: "A photo of the installed solution working on site, with the test result noted.", share: 0.25, material: null },
    { title: "Train the community and hand over", done: "A photo of the handover with the named caretaker, and a signed handover note.", share: 0.15, material: null },
  ];
  return template.map((t, i) => ({
    seq: i + 1,
    title: t.title,
    definition_of_done: t.done,
    expected_days: Math.max(1, Math.round(total * t.share)),
    needs_material: t.material,
  }));
}
