import "server-only";
import { llmJson, isAiEnabled } from "./llm";

/**
 * External corroboration: go and look for independent proof that a reported
 * event happened, then return a verdict with citations.
 *
 * When the proof is real - a supporting verdict, at least one cited source,
 * and enough confidence - the caller verifies the problem on the spot and opens
 * it to colleges with those sources attached. When it is not, the problem stays
 * unverified and goes to a human verifier with whatever was found beside it.
 *
 * THE SAFETY DESIGN, which is what makes acting on the verdict defensible:
 *
 *  - The model never writes a URL. It is given numbered passages and returns
 *    INDICES. The orchestrator maps indices back to the URLs it fetched, so a
 *    citation cannot be invented - only pointed at.
 *  - An index that does not map discards the model's answer entirely.
 *  - "supports" with no citation is worth nothing, whatever confidence the
 *    model claims.
 *  - "contradicts" is a flag for the verifier, never a rejection. A villager
 *    can be right while the internet is silent - that is the premise of Silent
 *    Zones.
 *  - Provider failures are recorded as failures, distinct from "found nothing".
 *  - With no model configured, a published rule set decides instead: IMD rain
 *    thresholds, WMO thunderstorm codes, and news or web passages that name both
 *    the district and the event. Its verdicts are labelled as rule-based.
 */

export type Provider = "weather" | "news" | "web";
export type Verdict = "supports" | "contradicts" | "inconclusive";

export interface Passage {
  provider: Provider;
  url: string;
  title: string;
  publisher: string | null;
  published_at: string | null;
  snippet: string;
}

export interface Citation extends Passage {
  supports: boolean;
}

export interface WeatherDay {
  date: string;
  precipitation_mm: number | null;
  wind_max_kmh: number | null;
  wind_gust_kmh: number | null;
  temp_max_c: number | null;
  weather_code: number | null;
}

export interface ProviderResult {
  provider: Provider;
  query: string;
  passages: Passage[];
  raw: unknown;
  error: string | null;
  ms: number;
  /** Structured observations, so the rules can judge numbers rather than prose. */
  weather?: WeatherDay[];
}

export interface CorroborationResult {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  citations: Citation[];
  providers: ProviderResult[];
  model: string | null;
  /** Who reached the verdict: the model, the published rules, or nobody. */
  method: "ai" | "rules" | "none";
  /** True when no provider could be reached at all. */
  allProvidersFailed: boolean;
}

/** Below this, a supporting verdict is shown to a verifier rather than acted on. */
export const AUTO_VERIFY_CONFIDENCE = 0.6;

/** Proof in the sense the flow means: supporting, cited, and confident enough to act on. */
export function isProof(result: CorroborationResult): boolean {
  return (
    result.verdict === "supports" &&
    result.citations.length > 0 &&
    result.confidence >= AUTO_VERIFY_CONFIDENCE
  );
}

const TIMEOUT_MS = 8000;
const DAY_MS = 86_400_000;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      // Providers explain themselves in the body; "HTTP 426" alone helps nobody.
      const body = await res.text().catch(() => "");
      let detail = body.slice(0, 160);
      try {
        const parsed = JSON.parse(body) as { message?: string; detail?: string; reason?: string };
        detail = parsed.message ?? parsed.detail ?? parsed.reason ?? detail;
      } catch {
        // not JSON
      }
      throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Hazards: one vocabulary for queries, rules and text matching
// ---------------------------------------------------------------------------

export type HazardKey =
  | "flood"
  | "lightning"
  | "heat"
  | "storm"
  | "drought"
  | "fire"
  | "landslide"
  | "subsidence"
  | "cold"
  | "other";

const HAZARD_ALIASES: Array<[HazardKey, string[]]> = [
  ["flood", ["flood", "heavy_rain", "heavy rain", "waterlog", "cloudburst", "inundat", "baadh", "badh", "बाढ़"]],
  ["lightning", ["lightning", "thunder", "vajrapat", "bijli gir", "वज्रपात", "ठनका"]],
  ["heat", ["heatwave", "heat_wave", "heat wave", "heat", "loo", "लू"]],
  ["storm", ["storm", "cyclone", "gale", "hail", "tornado", "squall", "aandhi", "आंधी", "तूफान"]],
  ["drought", ["drought", "dry spell", "sookha", "sukha", "सूखा"]],
  ["fire", ["fire", "wildfire", "blaze", "aag", "आग"]],
  ["landslide", ["landslide", "mudslide", "भूस्खलन"]],
  ["subsidence", ["subsidence", "mining", "land sink", "dhansan", "धंसान"]],
  ["cold", ["cold wave", "coldwave", "frost", "शीतलहर"]],
];

export function hazardKey(hazard: string | null | undefined): HazardKey {
  const h = (hazard ?? "").toLowerCase();
  if (!h) return "other";
  for (const [key, aliases] of HAZARD_ALIASES) {
    if (aliases.some((a) => h.includes(a))) return key;
  }
  return "other";
}

/** Words that name the event, in English and Hindi, for matching retrieved text. */
const HAZARD_TERMS: Record<HazardKey, string[]> = {
  flood: ["flood", "inundat", "waterlog", "heavy rain", "cloudburst", "बाढ़", "जलजमाव", "भारी बारिश"],
  lightning: ["lightning", "thunderstorm", "thunderbolt", "वज्रपात", "बिजली गिर", "ठनका", "आकाशीय बिजली"],
  heat: ["heatwave", "heat wave", "heatstroke", "heat stroke", "sunstroke", "लू", "भीषण गर्मी"],
  storm: ["storm", "cyclone", "gale", "hailstorm", "squall", "आंधी", "तूफान", "चक्रवात", "ओलावृष्टि"],
  drought: ["drought", "dry spell", "deficient rain", "सूखा", "अकाल"],
  fire: ["fire", "blaze", "wildfire", "आग"],
  landslide: ["landslide", "भूस्खलन"],
  subsidence: ["subsidence", "caved in", "land sank", "cave-in", "भू-धंसान", "भूधंसान", "धंसान"],
  cold: ["cold wave", "coldwave", "शीतलहर"],
  other: ["disaster", "accident", "आपदा", "हादसा"],
};

const NEWS_QUERY: Record<HazardKey, string> = {
  flood: "flood OR flooding OR waterlogging OR बाढ़",
  lightning: "lightning OR thunderstorm OR वज्रपात OR ठनका",
  heat: "heatwave OR heatstroke OR लू",
  storm: "storm OR cyclone OR hailstorm OR आंधी OR तूफान",
  drought: "drought OR सूखा",
  fire: "fire OR blaze OR आग",
  landslide: "landslide OR भूस्खलन",
  subsidence: 'subsidence OR "land sank" OR भू-धंसान',
  cold: '"cold wave" OR शीतलहर',
  other: "disaster OR accident OR आपदा",
};

/** Spellings a newspaper actually uses for these districts. */
const DISTRICT_ALIASES: Record<string, string[]> = {
  sahebganj: ["sahibganj", "साहिबगंज", "साहेबगंज"],
  palamu: ["palamau", "daltonganj", "medininagar", "पलामू"],
  "east singhbhum": ["jamshedpur", "जमशेदपुर"],
  "west singhbhum": ["chaibasa", "चाईबासा"],
  "seraikela kharsawan": ["seraikela", "saraikela", "सरायकेला"],
  hazaribagh: ["hazaribag", "हजारीबाग"],
  dhanbad: ["jharia", "धनबाद"],
  ranchi: ["रांची"],
  gumla: ["गुमला"],
  garhwa: ["गढ़वा"],
  dumka: ["दुमका"],
  deoghar: ["देवघर"],
  bokaro: ["बोकारो"],
  giridih: ["गिरिडीह"],
};

function placeTerms(district: string): string[] {
  const d = district.toLowerCase().trim();
  return d ? [d, ...(DISTRICT_ALIASES[d] ?? [])] : [];
}

// ---------------------------------------------------------------------------
// Weather - Open-Meteo. No API key, which is why this works on a fresh
// deployment. Recent dates come from the forecast service's observed history;
// older ones from the ERA5 archive, which lags by about five days.
// ---------------------------------------------------------------------------

const THUNDERSTORM_CODES = new Set([95, 96, 99]);

async function fetchWeatherDays(lat: number, lng: number, start: string, end: string) {
  const daily =
    "weather_code,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,temperature_2m_max";
  const common =
    `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&start_date=${start}&end_date=${end}&daily=${daily}&timezone=Asia%2FKolkata`;
  const ageDays = (Date.now() - new Date(`${end}T00:00:00Z`).getTime()) / DAY_MS;

  const endpoints =
    ageDays <= 80
      ? [
          { base: "https://api.open-meteo.com/v1/forecast", source: "Open-Meteo observed weather" },
          { base: "https://archive-api.open-meteo.com/v1/archive", source: "Open-Meteo historical archive (ERA5)" },
        ]
      : [{ base: "https://archive-api.open-meteo.com/v1/archive", source: "Open-Meteo historical archive (ERA5)" }];

  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    const url = `${endpoint.base}?${common}`;
    try {
      const raw = (await fetchJson(url)) as {
        daily?: {
          time?: string[];
          weather_code?: (number | null)[];
          precipitation_sum?: (number | null)[];
          wind_speed_10m_max?: (number | null)[];
          wind_gusts_10m_max?: (number | null)[];
          temperature_2m_max?: (number | null)[];
        };
      };
      const d = raw.daily;
      const days: WeatherDay[] = (d?.time ?? []).map((date, i) => ({
        date,
        precipitation_mm: d?.precipitation_sum?.[i] ?? null,
        wind_max_kmh: d?.wind_speed_10m_max?.[i] ?? null,
        wind_gust_kmh: d?.wind_gusts_10m_max?.[i] ?? null,
        temp_max_c: d?.temperature_2m_max?.[i] ?? null,
        weather_code: d?.weather_code?.[i] ?? null,
      }));
      if (days.some((x) => x.precipitation_mm != null || x.temp_max_c != null)) {
        return { url, days, raw, source: endpoint.source };
      }
      lastError = new Error("no observations are available for those dates yet");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("weather provider unreachable");
}

const fmt = (n: number | null) => (n == null ? "?" : String(Math.round(n * 10) / 10));

export async function checkWeather(input: {
  lat: number;
  lng: number;
  when: Date;
  placeLabel: string;
  isDistrictEstimate: boolean;
}): Promise<ProviderResult> {
  const started = Date.now();
  // The three days up to and including the report.
  const end = isoDate(input.when);
  const start = isoDate(new Date(input.when.getTime() - 3 * DAY_MS));
  const query = `open-meteo ${input.lat.toFixed(4)},${input.lng.toFixed(4)} ${start}..${end}`;

  try {
    const { url, days, raw, source } = await fetchWeatherDays(input.lat, input.lng, start, end);
    const precision = input.isDistrictEstimate
      ? "District-level reading: the report carried no GPS, so this is the district centre, not the village."
      : "Point reading at the reported coordinates.";

    const snippet =
      `Observed near ${input.placeLabel}, ${start} to ${end}: ` +
      days
        .map(
          (x) =>
            `${x.date} rain ${fmt(x.precipitation_mm)} mm, max ${fmt(x.temp_max_c)}°C, gusts ${fmt(
              x.wind_gust_kmh ?? x.wind_max_kmh,
            )} km/h${THUNDERSTORM_CODES.has(x.weather_code ?? -1) ? ", thunderstorm" : ""}`,
        )
        .join("; ") +
      `. ${precision}`;

    return {
      provider: "weather",
      query: url,
      passages: [
        {
          provider: "weather",
          // The exact query, so anyone can re-run it and see the same numbers.
          url,
          title: `Weather observations, ${input.placeLabel}, ${start} to ${end}`,
          publisher: source,
          published_at: end,
          snippet,
        },
      ],
      raw,
      error: null,
      ms: Date.now() - started,
      weather: days,
    };
  } catch (err) {
    return {
      provider: "weather",
      query,
      passages: [],
      raw: null,
      error: err instanceof Error ? err.message : "weather provider unreachable",
      ms: Date.now() - started,
    };
  }
}

// ---------------------------------------------------------------------------
// News - a Gumla lightning death appears in a Ranchi Hindi daily, not the
// national English press, so the query carries Hindi terms as well.
// ---------------------------------------------------------------------------

export async function checkNews(input: {
  district: string;
  hazard: string | null;
  when: Date;
}): Promise<ProviderResult> {
  const started = Date.now();
  const hz = hazardKey(input.hazard);
  const q = input.district ? `"${input.district}" AND (${NEWS_QUERY[hz]})` : NEWS_QUERY[hz];

  const key = process.env.NEWS_API_KEY;
  if (!key) {
    return {
      provider: "news",
      query: q,
      passages: [],
      raw: null,
      error: "NEWS_API_KEY is not set on this deployment.",
      ms: Date.now() - started,
    };
  }

  // The free tier only searches the last month.
  const from = isoDate(new Date(Math.max(input.when.getTime() - 5 * DAY_MS, Date.now() - 29 * DAY_MS)));
  const to = isoDate(new Date(Math.min(input.when.getTime() + 3 * DAY_MS, Date.now())));
  const url =
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}` +
    `&from=${from}&to=${to}&sortBy=relevancy&pageSize=10`;

  try {
    const raw = (await fetchJson(url, { headers: { "X-Api-Key": key } })) as {
      articles?: Array<{
        url?: string;
        title?: string;
        description?: string;
        publishedAt?: string;
        source?: { name?: string };
      }>;
    };
    const passages: Passage[] = (raw.articles ?? [])
      .filter((a) => a.url && a.title)
      .map((a) => ({
        provider: "news" as const,
        url: a.url as string,
        title: a.title as string,
        publisher: a.source?.name ?? null,
        published_at: a.publishedAt ?? null,
        snippet: a.description ?? "",
      }));
    return { provider: "news", query: q, passages, raw, error: null, ms: Date.now() - started };
  } catch (err) {
    return {
      provider: "news",
      query: q,
      passages: [],
      raw: null,
      error: err instanceof Error ? err.message : "news provider unreachable",
      ms: Date.now() - started,
    };
  }
}

// ---------------------------------------------------------------------------
// Web search - catches the district administration notice, the NDRF sitrep,
// the panchayat post that no news API indexes. Tavily's response shape.
// ---------------------------------------------------------------------------

export async function checkWeb(input: {
  district: string;
  hazard: string | null;
  text: string;
  when: Date;
}): Promise<ProviderResult> {
  const started = Date.now();
  const hz = hazardKey(input.hazard);
  const month = input.when.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const q = `${input.district} Jharkhand ${hz === "other" ? "" : hz} ${month} ${input.text.slice(0, 100)}`
    .replace(/\s+/g, " ")
    .trim();

  const key = process.env.SEARCH_API_KEY;
  if (!key) {
    return {
      provider: "web",
      query: q,
      passages: [],
      raw: null,
      error: "SEARCH_API_KEY is not set on this deployment.",
      ms: Date.now() - started,
    };
  }

  try {
    const raw = (await fetchJson("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ api_key: key, query: q, max_results: 6, search_depth: "basic" }),
    })) as { results?: Array<{ url?: string; title?: string; content?: string; published_date?: string }> };

    const passages: Passage[] = (raw.results ?? [])
      .filter((r) => r.url && r.title)
      .map((r) => ({
        provider: "web" as const,
        url: r.url as string,
        title: r.title as string,
        publisher: null,
        published_at: r.published_date ?? null,
        snippet: r.content ?? "",
      }));
    return { provider: "web", query: q, passages, raw, error: null, ms: Date.now() - started };
  } catch (err) {
    return {
      provider: "web",
      query: q,
      passages: [],
      raw: null,
      error: err instanceof Error ? err.message : "search provider unreachable",
      ms: Date.now() - started,
    };
  }
}

// ---------------------------------------------------------------------------
// The published rules - used when no model is configured or it cannot answer
// ---------------------------------------------------------------------------

export function judgeWeather(
  hz: HazardKey,
  days: WeatherDay[],
): { verdict: Verdict; confidence: number; note: string } {
  const values = (pick: (d: WeatherDay) => number | null) =>
    days.map(pick).filter((v): v is number => typeof v === "number");
  const rain = values((d) => d.precipitation_mm);
  const temps = values((d) => d.temp_max_c);
  const winds = values((d) => d.wind_gust_kmh ?? d.wind_max_kmh);
  const maxRain = rain.length ? Math.max(...rain) : 0;
  const totalRain = rain.reduce((s, v) => s + v, 0);
  const maxTemp = temps.length ? Math.max(...temps) : null;
  const maxWind = winds.length ? Math.max(...winds) : 0;
  const thunder = days.some((d) => THUNDERSTORM_CODES.has(d.weather_code ?? -1));
  const r = (n: number) => Math.round(n * 10) / 10;

  switch (hz) {
    case "flood":
      if (maxRain >= 115.6)
        return { verdict: "supports", confidence: 0.8, note: `very heavy rain, ${r(maxRain)} mm in one day (IMD "very heavy" starts at 115.6 mm)` };
      if (maxRain >= 64.5)
        return { verdict: "supports", confidence: 0.7, note: `heavy rain, ${r(maxRain)} mm in one day (IMD "heavy" starts at 64.5 mm)` };
      if (rain.length && totalRain < 5)
        return { verdict: "contradicts", confidence: 0.5, note: `almost no rain, ${r(totalRain)} mm over the whole period` };
      return { verdict: "inconclusive", confidence: 0, note: `rain peaked at ${r(maxRain)} mm in a day, not enough on its own to confirm a flood` };
    case "lightning":
      if (thunder)
        return { verdict: "supports", confidence: 0.65, note: "a thunderstorm was recorded at this location (WMO weather code 95-99)" };
      return { verdict: "inconclusive", confidence: 0, note: "no thunderstorm was recorded at this grid point; lightning is too local to rule out from that" };
    case "heat":
      if (maxTemp != null && maxTemp >= 45)
        return { verdict: "supports", confidence: 0.8, note: `severe heat, ${r(maxTemp)}°C` };
      if (maxTemp != null && maxTemp >= 40)
        return { verdict: "supports", confidence: 0.7, note: `heatwave conditions, ${r(maxTemp)}°C (IMD's plains threshold is 40°C)` };
      if (maxTemp != null && maxTemp < 33)
        return { verdict: "contradicts", confidence: 0.5, note: `no heat recorded, the maximum was ${r(maxTemp)}°C` };
      return { verdict: "inconclusive", confidence: 0, note: `the maximum was ${maxTemp == null ? "not recorded" : `${r(maxTemp)}°C`}` };
    case "storm":
      if (maxWind >= 75)
        return { verdict: "supports", confidence: 0.75, note: `damaging wind gusts of ${r(maxWind)} km/h` };
      if (maxWind >= 50)
        return { verdict: "supports", confidence: 0.65, note: `strong wind gusts of ${r(maxWind)} km/h` };
      if (thunder)
        return { verdict: "supports", confidence: 0.6, note: "a thunderstorm was recorded at this location" };
      return { verdict: "inconclusive", confidence: 0, note: `wind gusts peaked at ${r(maxWind)} km/h` };
    default:
      return { verdict: "inconclusive", confidence: 0, note: "weather records do not speak to this kind of event" };
  }
}

export function judgeText(
  passage: Passage,
  hz: HazardKey,
  district: string,
  when: Date,
): boolean {
  const text = `${passage.title} ${passage.snippet}`.toLowerCase();
  const namesPlace = placeTerms(district).some((t) => text.includes(t));
  const namesEvent = HAZARD_TERMS[hz].some((t) => text.includes(t.toLowerCase()));
  if (!namesPlace || !namesEvent) return false;
  if (passage.published_at) {
    const t = Date.parse(passage.published_at);
    // About this place and this kind of event, but from another season.
    if (Number.isFinite(t) && (t < when.getTime() - 7 * DAY_MS || t > when.getTime() + 5 * DAY_MS)) {
      return false;
    }
  }
  return true;
}

function synthesiseWithRules(
  input: { district: string; hazard: string | null; when: Date },
  providers: ProviderResult[],
): Pick<CorroborationResult, "verdict" | "confidence" | "reasoning" | "citations" | "model" | "method"> {
  const hz = hazardKey(input.hazard);
  const citations: Citation[] = [];
  const notes: string[] = [];
  let weatherConfidence = 0;
  let contradicted = false;

  const weather = providers.find((p) => p.provider === "weather");
  if (weather?.weather?.length && weather.passages[0]) {
    const judged = judgeWeather(hz, weather.weather);
    notes.push(`Weather records: ${judged.note}.`);
    if (judged.verdict === "supports") {
      weatherConfidence = judged.confidence;
      citations.push({ ...weather.passages[0], supports: true });
    }
    if (judged.verdict === "contradicts") contradicted = true;
  }

  const textHits: Citation[] = providers
    .filter((p) => p.provider !== "weather")
    .flatMap((p) => p.passages)
    .filter((p) => judgeText(p, hz, input.district, input.when))
    .map((p) => ({ ...p, supports: true }));

  if (textHits.length) {
    notes.push(
      `${textHits.length} news or web source${textHits.length === 1 ? "" : "s"} name${textHits.length === 1 ? "s" : ""} ${input.district} and this kind of event around the reported date.`,
    );
    citations.push(...textHits.slice(0, 5));
  } else if (providers.some((p) => p.provider !== "weather" && p.passages.length > 0)) {
    notes.push(`No news or web result named both ${input.district} and the event.`);
  }

  let confidence = weatherConfidence;
  if (textHits.length) {
    const textConfidence = textHits.length >= 2 ? 0.7 : 0.55;
    // Two independent kinds of evidence agreeing is stronger than either alone.
    confidence =
      weatherConfidence > 0
        ? Math.min(0.9, Math.max(weatherConfidence, textConfidence) + 0.1)
        : textConfidence;
  }

  const verdict: Verdict =
    citations.length > 0 ? "supports" : contradicted ? "contradicts" : "inconclusive";

  return {
    verdict,
    confidence: verdict === "supports" ? Math.round(confidence * 100) / 100 : verdict === "contradicts" ? 0.5 : 0,
    reasoning: notes.join(" ") || "Nothing retrieved speaks to this report.",
    citations,
    model: "rules-v1",
    method: "rules",
  };
}

// ---------------------------------------------------------------------------
// Synthesis - the only model call. Returns indices, never URLs.
// ---------------------------------------------------------------------------

const synthSchema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "confidence", "supporting_indices", "reasoning"],
  properties: {
    verdict: { type: "string", enum: ["supports", "contradicts", "inconclusive"] },
    confidence: { type: "number" },
    supporting_indices: { type: "array", items: { type: "integer" } },
    reasoning: { type: "string" },
  },
} as const;

export async function corroborate(input: {
  reportText: string;
  district: string;
  hazard: string | null;
  when: Date;
  lat: number | null;
  lng: number | null;
  placeLabel: string;
  isDistrictEstimate: boolean;
}): Promise<CorroborationResult> {
  const jobs: Promise<ProviderResult>[] = [
    checkNews({ district: input.district, hazard: input.hazard, when: input.when }),
    checkWeb({ district: input.district, hazard: input.hazard, text: input.reportText, when: input.when }),
  ];
  if (input.lat != null && input.lng != null) {
    jobs.unshift(
      checkWeather({
        lat: input.lat,
        lng: input.lng,
        when: input.when,
        placeLabel: input.placeLabel,
        isDistrictEstimate: input.isDistrictEstimate,
      }),
    );
  }

  const providers = await Promise.all(jobs);
  const allProvidersFailed = providers.every((p) => p.error !== null);
  const passages = providers.flatMap((p) => p.passages);

  if (passages.length === 0) {
    return {
      verdict: "inconclusive",
      confidence: 0,
      reasoning: allProvidersFailed
        ? "No external source could be reached, so nothing is confirmed either way."
        : "Nothing was found that speaks to this report.",
      citations: [],
      providers,
      model: null,
      method: "none",
      allProvidersFailed,
    };
  }

  const rules = synthesiseWithRules(input, providers);

  if (!isAiEnabled()) {
    return {
      ...rules,
      reasoning: `${rules.reasoning} (Rule-based check: no AI model is configured on this deployment.)`,
      providers,
      allProvidersFailed,
    };
  }

  const numbered = passages
    .map(
      (p, i) =>
        `[${i}] provider=${p.provider} title="${p.title}" publisher="${p.publisher ?? "unknown"}" date=${p.published_at ?? "unknown"}\n${p.snippet.slice(0, 900)}`,
    )
    .join("\n\n");

  try {
    const result = await llmJson<{
      verdict: Verdict;
      confidence: number;
      supporting_indices: number[];
      reasoning: string;
    }>({
      task: "corroborate",
      system: `You decide whether independent sources confirm a citizen's disaster report for a Government of Jharkhand platform. A "supports" verdict with confidence of ${AUTO_VERIFY_CONFIDENCE} or more verifies the report and opens it to colleges, so be careful.

You are given numbered passages that were actually retrieved. Refer to them ONLY by their index number. You must never write a URL and never refer to a source that is not in the list.

"supports"      - at least one passage independently indicates this kind of event happened in this place around this time. Weather observations count when they show the conditions the report describes (for example 70 mm of rain in a day for a flood, or a recorded thunderstorm for lightning).
"contradicts"   - a passage positively indicates it did not, for example weather records showing no rain at all for a reported flood.
"inconclusive"  - anything else, including passages that are merely about the district.

confidence is 0 to 1. Remote places are often genuinely unreported: absence of coverage is never evidence against the reporter.`,
      prompt: `THE REPORT
District: ${input.district || "not stated"}
Hazard: ${input.hazard ?? "unspecified"}
Filed: ${input.when.toISOString()}
Text: ${input.reportText.slice(0, 2000)}

RETRIEVED PASSAGES
${numbered}

Which indices, if any, support this report?`,
      schema: synthSchema as unknown as Record<string, unknown>,
      maxTokens: 900,
      cache: "off",
    });

    const idx = result.value.supporting_indices ?? [];
    // An index we cannot map is a fabricated citation. Discard the model's
    // answer rather than accepting the half that happens to resolve.
    const unmapped = idx.filter((i) => !Number.isInteger(i) || i < 0 || i >= passages.length);
    if (unmapped.length > 0) {
      return {
        ...rules,
        reasoning: `The model cited a source that was not retrieved, so its answer was discarded and the published rules decided instead. ${rules.reasoning}`,
        providers,
        allProvidersFailed,
      };
    }

    const citations: Citation[] = [...new Set(idx)].map((i) => ({ ...passages[i], supports: true }));
    const verdict = result.value.verdict;

    return {
      verdict,
      // No citations means nothing was actually corroborated, whatever the
      // model said about its own confidence.
      confidence:
        verdict === "supports" && citations.length === 0
          ? 0
          : Math.max(0, Math.min(1, result.value.confidence ?? 0)),
      reasoning: result.value.reasoning?.trim() || rules.reasoning,
      citations,
      providers,
      model: result.model,
      method: "ai",
      allProvidersFailed,
    };
  } catch (err) {
    return {
      ...rules,
      reasoning: `The AI model could not be reached (${
        err instanceof Error ? err.message : "unknown error"
      }), so the published rules decided instead. ${rules.reasoning}`,
      providers,
      allProvidersFailed,
    };
  }
}
