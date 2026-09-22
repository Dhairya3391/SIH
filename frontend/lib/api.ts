import type {
  AdminMetrics,
  AdminWindow,
  AiVerifiedItem,
  AssistantAnswer,
  Challenge,
  ChallengeDetail,
  ChallengeHistory,
  CollegeProblem,
  Contribution,
  ContributionTotals,
  CorroborationOutcome,
  DashboardMetrics,
  FundedProject,
  HealthReport,
  IntakeResult,
  Message,
  MyReport,
  NeedLine,
  Organisation,
  ProjectDetail,
  ProjectSummary,
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
  error?: { message?: string; code?: string; details?: unknown } | string;
};

function messageOf(json: Envelope<unknown>, fallback: string): string {
  const err = json?.error;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object") {
    // A validation failure names the field that failed, which is the useful part.
    const issues = Array.isArray(err.details) ? (err.details as { message?: string; path?: unknown[] }[]) : [];
    if (err.code === "validation" && issues.length) {
      return issues.map((i) => i.message).filter(Boolean).join(" ") || err.message || fallback;
    }
    if (err.message) return err.message;
  }
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
// Files
// ---------------------------------------------------------------------------

/** POST /api/uploads — stores one photo privately; GPS metadata is stripped first. */
export function uploadPhoto(file: File, purpose: "verification" | "progress", challengeId?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  if (challengeId) form.append("challenge_id", challengeId);
  return request<{ path: string; url: string; name: string; size: number }>("/api/uploads", {
    method: "POST",
    body: form,
  });
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

export function getCertificateUrl(idOrRef: string, format: "html" | "json" = "html") {
  return `/api/challenges/${encodeURIComponent(idOrRef)}/certificate?format=${format}`;
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
    const ext = audio.type.includes("webm") ? "webm" : "wav";
    form.append("audio", audio, `report.${ext}`);
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
  return request<{
    report_id: string;
    challenge_id: string | null;
    channel: string;
    action: string;
    trace: unknown[];
    total_ms: number;
    dedup: unknown;
    processed_at: string;
  }>(`/api/reports/${encodeURIComponent(reportId)}/trace`);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export async function fetchVerifyQueue(
  params: { district?: string; hazard?: string; limit?: number } = {},
) {
  return request<{ queue: VerifyQueueItem[]; count: number; recently_verified_by_ai: AiVerifiedItem[] }>(
    `/api/verify/queue${query({ limit: 40, ...params })}`,
  );
}

export function confirmVerification(
  challengeId: string,
  body: {
    source_urls: string[];
    photo_paths: string[];
    note: string;
    granted?: "field_verified" | "coordinator_approved";
  },
) {
  return post<{ confidence: string; status: string; now_visible_to_colleges: boolean }>(
    `/api/verify/${challengeId}/confirm`,
    body,
  );
}

export function rejectVerification(challengeId: string, reason: string) {
  return post<{ status: string; reporters_told: number }>(`/api/verify/${challengeId}/reject`, { reason });
}

/** Ask the AI to look for independent proof again (weather, news, web). */
export function runCorroboration(challengeId: string) {
  return post<CorroborationOutcome>(`/api/challenges/${challengeId}/corroborate`);
}

// ---------------------------------------------------------------------------
// College: problems, proposals and projects
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

export type SubmittedProposal = {
  proposal_id: string;
  version: number;
  first_in_window: boolean;
  document_pages: number;
  document_url: string | null;
  window: { closes_at: string; window_days: number; leader_score: number | null };
};

/** Pasted text, for a college that cannot export a PDF. */
export function submitProposal(body: {
  challenge_id: string;
  extracted_text: string;
  document_name?: string;
  document_pages?: number;
}) {
  return post<SubmittedProposal>("/api/college/proposals", body);
}

/** The PDF itself. The server extracts the text and the AI analyses it after replying. */
export function submitProposalDocument(challengeId: string, file: File) {
  const form = new FormData();
  form.append("challenge_id", challengeId);
  form.append("document", file);
  return request<SubmittedProposal>("/api/college/proposals", { method: "POST", body: form });
}

export function fetchCollegeProjects() {
  return request<{ projects: ProjectSummary[]; count: number }>("/api/college/projects");
}

export function fetchProject(idOrRef: string) {
  return request<ProjectDetail>(`/api/college/projects/${encodeURIComponent(idOrRef)}`);
}

export function publishRequirements(
  idOrRef: string,
  body: { funding_amount?: number | null; materials: { item: string; qty: number; unit?: string }[]; note?: string },
) {
  return post<ProjectDetail>(`/api/college/projects/${encodeURIComponent(idOrRef)}/requirements`, body);
}

export function removeRequirement(idOrRef: string, needId: string) {
  return del<ProjectDetail>(
    `/api/college/projects/${encodeURIComponent(idOrRef)}/requirements/${encodeURIComponent(needId)}`,
  );
}

export function updateStage(
  idOrRef: string,
  stageId: string,
  body: { status: "pending" | "in_progress" | "done" | "blocked"; note?: string; photo_paths?: string[] },
) {
  return post<ProjectDetail>(
    `/api/college/projects/${encodeURIComponent(idOrRef)}/stages/${encodeURIComponent(stageId)}`,
    body,
  );
}

export function postProgressUpdate(
  idOrRef: string,
  body: { note: string; stage_id?: string | null; photo_paths: string[] },
) {
  return post<ProjectDetail>(`/api/college/projects/${encodeURIComponent(idOrRef)}/updates`, body);
}

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

export async function fetchNeeds(
  params: {
    district?: string;
    category?: string;
    kind?: string;
    group?: "materials" | "funding" | "all";
    limit?: number;
  } = {},
) {
  return request<{ needs: NeedLine[]; count: number }>(
    `/api/needs${query({ limit: 60, ...params })}`,
  );
}

/** Contribute part or all of one published need, as your own organisation. */
export function pledge(
  challengeId: string,
  body: { need_id: string; qty: number; note?: string; expected_delivery_date?: string; org_id?: string },
) {
  return post<{ pledge_id: string; fully_pledged: boolean; thread_id: string | null }>(
    `/api/challenges/${challengeId}/pledges`,
    body,
  );
}

export function dispatchPledge(pledgeId: string, body: { expected_delivery_date?: string; note?: string } = {}) {
  return post<{ state: string }>(`/api/pledges/${pledgeId}/dispatch`, body);
}

export function receivePledge(pledgeId: string, body: { receipt_note?: string } = {}) {
  return post<{ state: string; all_received: boolean }>(`/api/pledges/${pledgeId}/receive`, body);
}

export function withdrawPledge(pledgeId: string) {
  return post<{ state: string }>(`/api/pledges/${pledgeId}/withdraw`);
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

export function fetchAdminWindows() {
  return request<{ windows: AdminWindow[]; count: number }>("/api/admin/windows");
}

/** Close a proposal window now and award it to the highest viable proposal. */
export function awardWindow(challengeIdOrRef: string) {
  return post<{ outcome: "awarded" | "reopened"; winner_org_id: string | null; stages_created: number }>(
    `/api/admin/windows/${encodeURIComponent(challengeIdOrRef)}/award`,
  );
}

/** Ask the admin assistant what has been going on. Answers from the record only. */
export function askAssistant(body: { question: string; challenge_ref?: string | null }) {
  return post<AssistantAnswer>("/api/admin/assistant", body);
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

/** Opens the one thread with the college for a challenge, or returns it. */
export function openThread(body: {
  challenge_id: string;
  college_org_id?: string;
  contributor_org_id?: string;
}) {
  return post<{ thread_id: string; created: boolean }>("/api/threads", body);
}

export function fetchMessages(threadId: string) {
  return request<{ thread: Thread; messages: Message[]; count: number }>(
    `/api/threads/${threadId}/messages`,
  );
}

export function sendMessage(threadId: string, body: string) {
  return post<{ message_id: string; created_at: string; notified: number }>(
    `/api/threads/${threadId}/messages`,
    { body },
  );
}

// ---------------------------------------------------------------------------
// Crisis Mode
// ---------------------------------------------------------------------------

export interface CrisisEvent {
  id: string;
  region_id: string;
  hazard: string;
  source: string;
  headline: string | null;
  is_drill: boolean;
  districts: string[];
  severity: number;
  started_at: string;
  ended_at?: string | null;
}

export interface CrisisRoomData {
  crisis: CrisisEvent;
  needsBoard: Array<{
    id: string;
    ref: string;
    title: string;
    district: string;
    category: string;
    severity: number;
    priority: number;
    status: string;
    confidence: string;
    people_est: number;
    why_critical: string;
    gap?: {
      needs: Array<{
        need_id: string;
        item: string;
        qty_needed: number;
        qty_pledged: number;
        unit: string;
        pct_closed: number;
      }>;
      pctClosed: number;
      fullyPledged: boolean;
    };
    nearby?: Array<{
      id: string;
      type: string;
      quantity: number;
      distance_km: number;
      org_name: string;
    }>;
  }>;
  remaining: unknown[];
  smsReports: Array<{
    id: string;
    village: string | null;
    district: string | null;
    original_text: string;
    created_at: string;
    location_source: string;
  }>;
  techSquad: Array<{
    id: string;
    name: string;
    type: string;
    district: string;
    expertise?: string[];
  }>;
  counts: {
    total: number;
    critical: number;
    unassigned: number;
  };
}

export function fetchActiveCrises(regionId = "jharkhand") {
  return request<{ active: CrisisEvent[] }>(`/api/crisis/start${query({ region_id: regionId })}`);
}

export function startCrisis(body: {
  region_id?: string;
  hazard: string;
  drill: boolean;
  source: string;
  headline?: string;
  districts: string[];
  severity: number;
}) {
  return post<{
    crisis: CrisisEvent;
    challenges_switched: number;
    is_drill: boolean;
    banner: string;
  }>("/api/crisis/start", {
    region_id: body.region_id ?? "jharkhand",
    ...body,
  });
}

export function fetchCrisisRoom(crisisId: string) {
  return request<CrisisRoomData>(`/api/crisis/${encodeURIComponent(crisisId)}/room`);
}

export function endCrisis(crisisId: string) {
  return post<{
    crisis: CrisisEvent;
    challenges_reverted: number;
    preparedness_drafted: Array<{ id: string; ref: string; title: string }>;
  }>(`/api/crisis/${encodeURIComponent(crisisId)}/end`);
}

export interface BenchmarkMetrics {
  totalCases: number;
  categoryAccuracyPct: number;
  vulnerabilityF1Pct: number;
  deduplicationPrecisionPct: number;
  overallScorePct: number;
  categoryBreakdown: Record<string, { total: number; correct: number; accuracy: number }>;
  evaluatedAt: string;
}

export function fetchBenchmarkMetrics() {
  return request<BenchmarkMetrics>("/api/admin/benchmark");
}


