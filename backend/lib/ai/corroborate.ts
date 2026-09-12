import "server-only";
import { llmJson, isAiEnabled } from "./llm";

/**
 * External corroboration: go and look for independent proof that a reported
 * event happened, then return a verdict with citations.
 *
 * THE SAFETY DESIGN, which matters more than the feature:
 *
 * A model that cites a page which does not actually confirm the event would
 * launder a false verification into an official-looking record, and resources
 * would move on it. So:
 *
 *  - The model never writes a URL. It is given numbered passages and returns
 *    INDICES. The orchestrator maps indices back to the URLs it fetched, so a
 *    citation cannot be invented - only pointed at.
 *  - An index that does not map fails the whole check to "inconclusive".
 *  - "supports" earns the `externally_corroborated` confidence rung and
 *    nothing higher. A human verifier still has to agree before a challenge
 *    reaches colleges.
 *  - "contradicts" is surfaced to the verifier as a flag. It never auto-rejects
 *    a citizen's report: a villager can be right while the internet is silent,
 *    which is the entire premise of Silent Zones.
 *  - Provider failures are recorded as failures, distinct from "found nothing".
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

export interface ProviderResult {
  provider: Provider;
  query: string;
  passages: Passage[];
  raw: unknown;
  error: string | null;
  ms: number;
}

export interface CorroborationResult {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  citations: Citation[];
  providers: ProviderResult[];
  model: string | null;
  /** True when no provider could be reached at all. */
  allProvidersFailed: boolean;
}

const TIMEOUT_MS = 8000;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Weather - Open-Meteo historical archive. No API key, which is why this
// adapter works on a fresh deployment with nothing configured.
// ---------------------------------------------------------------------------

interface WeatherDay {
  date: string;
  precipitation_mm: number | null;
  wind_max_kmh: number | null;
  temp_max_c: number | null;
}

export async function checkWeather(input: {
  lat: number;
  lng: number;
  when: Date;
  hazard: string | null;
  placeLabel: string;
  isDistrictEstimate: boolean;
}): Promise<ProviderResult> {
  const started = Date.now();
  // The three days up to and including the report.
  const end = input.when.toISOString().slice(0, 10);
  const startDate = new Date(input.when.getTime() - 3 * 86400_000).toISOString().slice(0, 10);
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${input.lat.toFixed(4)}` +
    `&longitude=${input.lng.toFixed(4)}&start_date=${startDate}&end_date=${end}` +
    `&daily=precipitation_sum,wind_speed_10m_max,temperature_2m_max&timezone=Asia%2FKolkata`;

  try {
    const raw = (await fetchJson(url)) as {
      daily?: {
        time?: string[];
        precipitation_sum?: (number | null)[];
        wind_speed_10m_max?: (number | null)[];
        temperature_2m_max?: (number | null)[];
      };
    };
    const d = raw.daily;
    const days: WeatherDay[] = (d?.time ?? []).map((date, i) => ({
      date,
      precipitation_mm: d?.precipitation_sum?.[i] ?? null,
      wind_max_kmh: d?.wind_speed_10m_max?.[i] ?? null,
      temp_max_c: d?.temperature_2m_max?.[i] ?? null,
    }));

    if (days.length === 0) {
      return {
        provider: "weather",
        query: url,
        passages: [],
        raw,
        error: null,
        ms: Date.now() - started,
      };
    }

    const wettest = days.reduce(
      (a, b) => ((b.precipitation_mm ?? 0) > (a.precipitation_mm ?? 0) ? b : a),
      days[0],
    );
    const precision = input.isDistrictEstimate
      ? "District-level reading: the report carried no GPS, so this is the district centroid, not the village."
      : "Point reading at the reported coordinates.";

    const snippet =
      `Observed conditions near ${input.placeLabel} over the three days to ${end}: ` +
      days
        .map(
          (x) =>
            `${x.date} rain ${x.precipitation_mm ?? "?"}mm, max wind ${x.wind_max_kmh ?? "?"}km/h`,
        )
        .join("; ") +
      `. Wettest day ${wettest.date} at ${wettest.precipitation_mm ?? 0}mm. ${precision}`;

    return {
      provider: "weather",
      query: url,
      passages: [
        {
          provider: "weather",
          url: `https://open-meteo.com/`,
          title: `Historical weather, ${input.placeLabel}, ${startDate} to ${end}`,
          publisher: "Open-Meteo historical archive (ERA5)",
          published_at: end,
          snippet,
        },
      ],
      raw,
      error: null,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      provider: "weather",
      query: url,
      passages: [],
      raw: null,
      error: err instanceof Error ? err.message : "weather provider unreachable",
      ms: Date.now() - started,
    };
  }
}

// ---------------------------------------------------------------------------
// News - adapter over whichever provider has a key. A Gumla lightning death
// appears in a Ranchi Hindi daily, not the national English press, so the
// query is built in Hindi as well as English.
// ---------------------------------------------------------------------------

export async function checkNews(input: {
  district: string;
  hazard: string | null;
  when: Date;
}): Promise<ProviderResult> {
  const started = Date.now();
  const hazardWords: Record<string, string> = {
    lightning: "lightning OR बिजली OR वज्रपात",
    flood: "flood OR बाढ़",
    drought: "drought OR सूखा",
    mining: "subsidence OR coalfield OR भू-धंसाव",
    heavy_rain: "heavy rain OR भारी बारिश",
  };
  const hz = input.hazard ? hazardWords[input.hazard] ?? input.hazard : "disaster OR आपदा";
  const from = new Date(input.when.getTime() - 5 * 86400_000).toISOString().slice(0, 10);
  const to = new Date(input.when.getTime() + 2 * 86400_000).toISOString().slice(0, 10);
  const q = `${input.district} Jharkhand ${hz}`;

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

  const url =
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}` +
    `&from=${from}&to=${to}&sortBy=relevancy&pageSize=6&language=hi,en`;

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
// the panchayat post that no news API indexes.
// ---------------------------------------------------------------------------

export async function checkWeb(input: {
  district: string;
  hazard: string | null;
  text: string;
}): Promise<ProviderResult> {
  const started = Date.now();
  const q = `${input.district} Jharkhand ${input.hazard ?? ""} ${input.text.slice(0, 120)}`.trim();
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
    // Tavily's shape; swapping provider means changing only this block.
    const raw = (await fetchJson("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: q,
        max_results: 6,
        search_depth: "basic",
      }),
    })) as { results?: Array<{ url?: string; title?: string; content?: string }> };

    const passages: Passage[] = (raw.results ?? [])
      .filter((r) => r.url && r.title)
      .map((r) => ({
        provider: "web" as const,
        url: r.url as string,
        title: r.title as string,
        publisher: null,
        published_at: null,
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
    checkWeb({ district: input.district, hazard: input.hazard, text: input.reportText }),
  ];
  if (input.lat != null && input.lng != null) {
    jobs.unshift(
      checkWeather({
        lat: input.lat,
        lng: input.lng,
        when: input.when,
        hazard: input.hazard,
        placeLabel: input.placeLabel,
        isDistrictEstimate: input.isDistrictEstimate,
      }),
    );
  }

  const providers = await Promise.all(jobs);
  const allProvidersFailed = providers.every((p) => p.error !== null);
  const passages = providers.flatMap((p) => p.passages);

  const base: CorroborationResult = {
    verdict: "inconclusive",
    confidence: 0,
    reasoning: allProvidersFailed
      ? "No external source could be reached, so nothing is confirmed either way."
      : "Nothing was found that speaks to this report.",
    citations: [],
    providers,
    model: null,
    allProvidersFailed,
  };

  if (passages.length === 0 || !isAiEnabled()) return base;

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
      system: `You decide whether independent sources confirm a citizen's disaster report for a Government of Jharkhand platform.

You are given numbered passages that were actually retrieved. Refer to them ONLY by their index number. You must never write a URL and never refer to a source that is not in the list.

"supports"      - at least one passage independently indicates this kind of event happened in this place around this time.
"contradicts"   - a passage positively indicates it did not, for example weather records showing no rain at all for a reported flood.
"inconclusive"  - anything else, including passages that are merely about the district.

Be conservative. A report being plausible is not the same as it being corroborated. Remote places are often genuinely unreported: absence of coverage is never evidence against the reporter.`,
      prompt: `THE REPORT
District: ${input.district}
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
    // An index we cannot map is a fabricated citation. Fail the whole check
    // rather than accepting the half that happens to resolve.
    const unmapped = idx.filter((i) => !Number.isInteger(i) || i < 0 || i >= passages.length);
    if (unmapped.length > 0) {
      return {
        ...base,
        reasoning:
          "The model cited a source that was not retrieved, so this check was discarded. A verifier should review this report manually.",
        providers,
        model: result.model,
      };
    }

    const citations: Citation[] = idx.map((i) => ({ ...passages[i], supports: true }));
    const verdict = result.value.verdict;

    return {
      verdict,
      // No citations means nothing was actually corroborated, whatever the
      // model said about its own confidence.
      confidence:
        verdict === "supports" && citations.length === 0
          ? 0
          : Math.max(0, Math.min(1, result.value.confidence ?? 0)),
      reasoning: result.value.reasoning?.trim() || base.reasoning,
      citations,
      providers,
      model: result.model,
      allProvidersFailed,
    };
  } catch (err) {
    return {
      ...base,
      reasoning: `The corroboration model could not be reached: ${
        err instanceof Error ? err.message : "unknown error"
      }. A verifier should review this report manually.`,
      providers,
    };
  }
}
