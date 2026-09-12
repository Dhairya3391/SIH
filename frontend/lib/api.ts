import { Challenge } from '@/types/database';

/**
 * The frontend talks to /api/* on its own origin. Which service answers depends
 * on BACKEND_ORIGIN (see next.config.ts):
 *
 *   unset -> the frontend's own demo routes, envelope { success, data }
 *   set   -> the backend service in backend/, envelope { ok, data }
 *
 * Everything below normalises both into the shapes the pages already expect, so
 * flipping between them needs no page changes.
 */

type Envelope = {
  ok?: boolean;
  success?: boolean;
  data?: unknown;
  error?: { message?: string } | string;
};

function unwrap(json: Envelope): any {
  if (json?.ok === false || json?.success === false) {
    const err = json.error;
    const message = typeof err === 'string' ? err : err?.message;
    throw new Error(message || 'Request failed');
  }
  return json?.data ?? json;
}

/** Backend rows name a few fields differently from the demo routes. */
function normaliseChallenge(raw: any): Challenge {
  if (!raw) return raw;
  return {
    ...raw,
    problem: raw.problem ?? raw.why_critical ?? '',
    capabilities_needed: raw.capabilities_needed ?? raw.capabilities ?? [],
    ai_unsure_about:
      raw.ai_unsure_about ??
      (Array.isArray(raw.ai_uncertainties) ? raw.ai_uncertainties.join(' · ') : raw.ai_uncertainties),
    score_breakdown: raw.score_breakdown
      ? { ...raw.score_breakdown, why_critical: raw.score_breakdown.why_critical ?? raw.why_critical ?? '' }
      : raw.score_breakdown,
  } as Challenge;
}

export async function fetchChallenges(regionId: string = 'jharkhand') {
  const res = await fetch(`/api/challenges?region_id=${regionId}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || json?.error || 'Failed to fetch challenges';
    throw new Error(typeof message === 'string' ? message : 'Failed to fetch challenges');
  }
  const payload = unwrap(json);
  const rows: any[] = Array.isArray(payload) ? payload : payload?.challenges ?? payload?.items ?? [];
  return { data: rows.map(normaliseChallenge), count: rows.length };
}

export async function submitReport(payload: {
  text: string;
  district?: string;
  village?: string;
  people_est?: number;
  reporter_name?: string;
  vulnerable?: string[];
  photo_urls?: string[];
  client_id?: string;
}) {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // The offline queue can retry safely: both services key on client_id.
      client_id: payload.client_id ?? `cli-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...payload,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || json?.error || 'Failed to submit report';
    throw new Error(typeof message === 'string' ? message : 'Failed to submit report');
  }
  const data = unwrap(json);

  return {
    ...data,
    challenge: data.challenge ? normaliseChallenge(data.challenge) : undefined,
    compiled: data.compiled ?? {
      // The backend answers with a decision and a score rather than a brief.
      category: data.decision ? `${data.decision} challenge` : undefined,
      priority: data.priority,
    },
    is_fallback: data.is_fallback ?? data.degraded ?? false,
  };
}
