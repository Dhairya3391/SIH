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
    // The backend keeps the compiled brief as a JSON object; its `problem` is the
    // real problem statement, and why_critical is only the ranking verdict.
    problem: raw.problem ?? raw.brief?.problem ?? raw.why_critical ?? '',
    outcome: raw.outcome ?? raw.brief?.outcome ?? '',
    needs: raw.needs ?? raw.brief?.needs ?? [],
    compiler_source: raw.brief?.source ?? null,
    ref: raw.ref ?? raw.id,
    priority_band:
      raw.priority_band ??
      raw.band ??
      (raw.priority >= 75 ? 'critical' : raw.priority >= 55 ? 'high' : raw.priority >= 35 ? 'moderate' : 'long-term'),
    capabilities_needed: raw.capabilities_needed ?? raw.capabilities ?? [],
    ai_unsure_about:
      raw.ai_unsure_about ??
      (Array.isArray(raw.ai_uncertainties) ? raw.ai_uncertainties.join(' · ') : raw.ai_uncertainties),
    score_breakdown: raw.score_breakdown
      ? { ...raw.score_breakdown, why_critical: raw.score_breakdown.why_critical ?? raw.why_critical ?? '' }
      : raw.score_breakdown,
  } as Challenge;
}

export async function fetchChallenges(regionId: string = 'jharkhand', limit: number = 500) {
  const res = await fetch(`/api/challenges?region_id=${regionId}&limit=${limit}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || json?.error || 'Failed to fetch challenges';
    throw new Error(typeof message === 'string' ? message : 'Failed to fetch challenges');
  }
  const payload = unwrap(json);
  const rows: any[] = Array.isArray(payload) ? payload : payload?.challenges ?? payload?.items ?? [];
  return { data: rows.map(normaliseChallenge), count: payload?.total ?? rows.length };
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
  /** Recorded voice note. Sent as multipart; the backend transcribes via Whisper. */
  audio?: Blob | null;
}) {
  const { audio, ...fields } = payload;
  const body = JSON.stringify({
    // The offline queue can retry safely: both services key on client_id.
    client_id: payload.client_id ?? `cli-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...fields,
  });

  const res = await fetch('/api/reports', audio
    ? (() => {
      const form = new FormData();
      form.append('payload', body);
      form.append('audio', audio, 'report.webm');
      return { method: 'POST', body: form } as RequestInit;
    })()
    : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
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
    // The backend answers with a routing decision and a score rather than a brief,
    // so describe what it actually did with the report.
    compiled: data.compiled ?? {
      category:
        data.decision === 'merged'
          ? 'merged into an existing challenge'
          : data.decision === 'new'
            ? 'opened a new challenge'
            : data.decision,
      priority: data.priority,
    },
    challenge_ref: data.challenge_ref,
    dedup_reason: data.dedup_reason,
    trace: data.trace,
    is_fallback: data.is_fallback ?? data.degraded ?? false,
  };
}

export async function fetchChallengeDetail(id: string) {
  const res = await fetch(`/api/challenges/${id}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || json?.error || 'Failed to fetch challenge detail';
    throw new Error(typeof message === 'string' ? message : 'Failed to fetch challenge detail');
  }
  const data = unwrap(json);
  
  if (data.challenge) {
    data.challenge = normaliseChallenge(data.challenge);
  }
  return data;
}

export async function fetchNearbyResources(id: string, radiusKm: number = 30) {
  const res = await fetch(`/api/challenges/${id}/nearby?radius_km=${radiusKm}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || json?.error || 'Failed to fetch nearby resources';
    throw new Error(typeof message === 'string' ? message : 'Failed to fetch nearby resources');
  }
  return unwrap(json);
}

export async function adoptChallenge(id: string, payload: { org_id: string; role: string }) {
  const res = await fetch(`/api/challenges/${id}/adopt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || json?.error || 'Failed to adopt challenge';
    throw new Error(typeof message === 'string' ? message : 'Failed to adopt challenge');
  }
  return unwrap(json);
}

export async function pledgeResource(id: string, payload: { need_id?: string; org_id: string; qty: number; kind: string; note?: string }) {
  const res = await fetch(`/api/challenges/${id}/pledges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || json?.error || 'Failed to pledge resource';
    throw new Error(typeof message === 'string' ? message : 'Failed to pledge resource');
  }
  return unwrap(json);
}
export async function demoLogin(role: string) {
  const res = await fetch('/api/auth/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || json?.error || 'Failed to switch role';
    throw new Error(typeof message === 'string' ? message : 'Failed to switch role');
  }
  return unwrap(json);
}

export async function fetchDemoUser() {
  const res = await fetch('/api/auth/demo-login', { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return null;
  }
  return unwrap(json);
}

export async function fetchSilentZones(regionId: string = 'jharkhand') {
  const res = await fetch(`/api/map/silent-zones?region_id=${regionId}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error('Failed to fetch silent zones');
  }
  return unwrap(json);
}

export async function verifyLedger() {
  const res = await fetch('/api/ledger/verify', { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error('Failed to verify ledger');
  }
  return unwrap(json);
}

export async function fetchDashboardMetrics(regionId: string = 'jharkhand') {
  const res = await fetch(`/api/dashboard/metrics?region_id=${regionId}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error('Failed to fetch dashboard metrics');
  }
  return unwrap(json);
}

