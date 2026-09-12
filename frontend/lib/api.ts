import type {
  AdminMetrics,
  Challenge,
  ChallengeDetail,
  ChallengeHistory,
  CollegeProblem,
  Contribution,
  ContributionTotals,
  DashboardMetrics,
  FundedProject,
  HealthReport,
  IntakeResult,
  Message,
  MyReport,
  NeedLine,
  Organisation,
  Proposal,
  SilentZones,
  SlaReport,
  Thread,
  User,
  UserRole,
  VerifyQueueItem,
} from "@/types/database";

/**
 * Every call goes to /api/* on this origin. next.config.ts rewrites that to
 * BACKEND_ORIGIN, so the session cookie stays first-party and there is no CORS
 * and no credentials: "include" anywhere.
 *
 * The backend answers { ok, data } on success and { ok: false, error } on
 * failure. `request` unwraps the former and throws an ApiError carrying the
 * service's own sentence for the latter, because a console that cannot say
 * WHY it is empty is worse than one that is empty.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Envelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string; code?: string } | string;
};

function messageOf(json: Envelope<unknown>, fallback: string): string {
  const err = json?.error;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object" && err.message) return err.message;
  return fallback;
}

function codeOf(json: Envelope<unknown>): string | null {
  const err = json?.error;
  if (err && typeof err === "object" && err.code) return err.code;
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check the connection and try again.",
      0,
      "offline",
    );
  }

  const json = (await res.json().catch(() => ({}))) as Envelope<T>;

  if (!res.ok || json?.ok === false) {
    throw new ApiError(
      messageOf(json, `The request to ${path} failed (${res.status}).`),
      res.status,
      codeOf(json),
    );
  }

  return (json?.data ?? (json as unknown)) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, {
    method: "DELETE",
  });
}

function query(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export type Session = { user: User | null; organisation: Organisation | null };

/** GET /api/auth/login — the session probe. Signed out is not an error. */
export async function fetchSession(): Promise<Session> {
  const data = await request<Session>("/api/auth/login");
  return { user: data?.user ?? null, organisation: data?.organisation ?? null };
}

export function signIn(email: string, password: string): Promise<Session> {
  return post<Session>("/api/auth/login", { email, password });
}

/** The judging path. Labelled as a demo in the UI rather than dressed up. */
export function demoSignIn(role: UserRole): Promise<{ user: User; email: string }> {
  return post<{ user: User; email: string }>("/api/auth/demo-login", { role });
}

export function signOut(): Promise<unknown> {
  return post("/api/auth/logout");
}

// ---------------------------------------------------------------------------
// Reports and challenges
// ---------------------------------------------------------------------------

export type ChallengeListParams = {
  region_id?: string;
  district?: string;
  category?: string;
  status?: string;
  band?: string;
  limit?: number;
  offset?: number;
};

export async function fetchChallenges(params: ChallengeListParams = {}) {
  return request<{
    challenges: Challenge[];
    total: number;
    limit: number;
    offset: number;
    redacted: boolean;
  }>(`/api/challenges${query({ region_id: "jharkhand", limit: 200, ...params })}`);
}

export function fetchChallenge(idOrRef: string) {
  return request<ChallengeDetail>(`/api/challenges/${encodeURIComponent(idOrRef)}`);
}

export function deleteChallenge(idOrRef: string) {
  return del<{ deleted: boolean; id: string; ref: string; title: string }>(
    `/api/challenges/${encodeURIComponent(idOrRef)}`,
  );
}

export type ReportInput = {
  text: string;
  district?: string;
  village?: string;
  people_est?: number;
  urgency?: number;
  vulnerable?: string[];
  reporter_name?: string;
  photo_urls?: string[];
  client_id?: string;
  /** A recorded voice note. Sent as multipart; the backend transcribes it. */
  audio?: Blob | null;
};

/**
 * POST /api/reports.
 *
 * client_id is generated here and reused on retry, so a citizen on a dropping
 * connection who taps send twice files one report, not two.
 */
export async function submitReport(input: ReportInput): Promise<IntakeResult> {
  const { audio, ...fields } = input;
  const payload = JSON.stringify({
    client_id: input.client_id ?? newClientId(),
    ...fields,
  });

  if (audio) {
    const form = new FormData();
    form.append("payload", payload);
    form.append("audio", audio, "report.wav");
    return request<IntakeResult>("/api/reports", { method: "POST", body: form });
  }

  return request<IntakeResult>("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
}

export function newClientId(): string {
  return `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * GET /api/reports — what this account filed. Anonymous reports are not here
 * by design; those are followed through the reference the submission returned,
 * which the browser keeps in localStorage (see lib/localReports.ts).
 */
export function fetchMyReports() {
  return request<{ reports: MyReport[]; count: number }>("/api/reports");
}

export function fetchReportTrace(reportId: string) {
  return request<{ trace: unknown[] }>(`/api/reports/${encodeURIComponent(reportId)}/trace`);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export async function fetchVerifyQueue(
  params: { district?: string; hazard?: string; limit?: number } = {},
) {
  return request<{ queue: VerifyQueueItem[]; count: number }>(
    `/api/verify/queue${query({ limit: 40, ...params })}`,
  );
}

export function confirmVerification(
  challengeId: string,
  body: { source_urls: string[]; photo_paths: string[]; note: string; granted?: string },
) {
  return post<{ confidence: string }>(`/api/verify/${challengeId}/confirm`, body);
}

export function rejectVerification(challengeId: string, reason: string) {
  return post<unknown>(`/api/verify/${challengeId}/reject`, { reason });
}

/** Ask the AI to look for independent proof (weather, news, web). */
export function runCorroboration(challengeId: string) {
  return post<{ verdict: string; checks: unknown[] }>(
    `/api/challenges/${challengeId}/corroborate`,
  );
}

// ---------------------------------------------------------------------------
// College: problems, and the proposal competition
// ---------------------------------------------------------------------------

export async function fetchCollegeProblems(
  params: { district?: string; category?: string } = {},
) {
  return request<{ problems: CollegeProblem[]; count: number }>(
    `/api/college/problems${query(params)}`,
  );
}

export async function fetchMyProposals() {
  return request<{ proposals: Proposal[]; count: number }>("/api/college/proposals");
}

export function submitProposal(body: {
  challenge_id: string;
  extracted_text: string;
  document_name?: string;
  document_pages?: number;
}) {
  return post<{
    proposal_id: string;
    window: { closes_at: string; window_days: number; leader_score: number | null };
    first_in_window: boolean;
  }>("/api/college/proposals", body);
}

// ---------------------------------------------------------------------------
// Sponsorship
// ---------------------------------------------------------------------------

export async function fetchNeeds(
  params: { district?: string; category?: string; kind?: string; limit?: number } = {},
) {
  return request<{ needs: NeedLine[]; count: number }>(
    `/api/needs${query({ limit: 60, ...params })}`,
  );
}

export function pledge(
  challengeId: string,
  body: { need_id?: string; org_id: string; qty: number; kind: string; note?: string },
) {
  return post<unknown>(`/api/challenges/${challengeId}/pledges`, body);
}

export function fetchMyContributions() {
  return request<{
    contributions: Contribution[];
    projects: FundedProject[];
    totals: ContributionTotals | null;
  }>("/api/contributions/mine");
}

// ---------------------------------------------------------------------------
// Coordinator and admin
// ---------------------------------------------------------------------------

export function fetchDashboardMetrics(regionId = "jharkhand") {
  return request<DashboardMetrics>(
    `/api/dashboard/metrics${query({ region_id: regionId })}`,
  );
}

export function fetchAdminMetrics() {
  return request<AdminMetrics>("/api/admin/metrics");
}

export function fetchSla() {
  return request<SlaReport>("/api/admin/sla");
}

export function fetchChallengeHistory(refOrId: string) {
  return request<ChallengeHistory>(
    `/api/admin/challenges/${encodeURIComponent(refOrId)}/history`,
  );
}

export function fetchSilentZones(regionId = "jharkhand") {
  return request<SilentZones>(`/api/map/silent-zones${query({ region_id: regionId })}`);
}

/**
 * GET /api/ledger/verify — walks the hash chain and recomputes every entry.
 *
 * Tamper evidence without pretending to be a blockchain: the append-only
 * guarantee is a Postgres trigger, and this proves nothing was rewritten.
 */
export function verifyLedger() {
  return request<{
    ok: boolean;
    entries_checked: number;
    broken_at: string | null;
    explanation: string;
  }>("/api/ledger/verify");
}

export function fetchHealth() {
  return request<HealthReport>("/api/health");
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export async function fetchThreads() {
  return request<{ threads: Thread[]; count: number }>("/api/threads");
}

export function openThread(body: {
  challenge_id: string;
  college_org_id?: string;
  contributor_org_id?: string;
}) {
  return post<{ thread_id: string }>("/api/threads", body);
}

export function fetchMessages(threadId: string) {
  return request<{ thread: Thread; messages: Message[]; count: number }>(
    `/api/threads/${threadId}/messages`,
  );
}

export function sendMessage(threadId: string, body: string) {
  return post<Message>(`/api/threads/${threadId}/messages`, { body });
}
