/**
 * The shapes the API actually returns.
 *
 * Every type here was read off live responses from the deployed backend, not
 * inferred from the schema — the two had drifted (the API sends `band`, not
 * `priority_band`, and `capabilities`, not `capabilities_needed`), and the
 * frontend used to paper over the difference with a normaliser. Binding to
 * what the service sends means a renamed field breaks the build instead of
 * silently rendering blank.
 */

export type UserRole =
  | "citizen"
  | "volunteer"
  | "verifier"
  | "coordinator"
  | "university"
  | "industry"
  | "ngo"
  | "admin";

export type OrgType = "univ" | "company" | "ngo" | "govt" | "volunteers";

export type Category =
  | "disaster_safety"
  | "water"
  | "health"
  | "education"
  | "agriculture"
  | "roads_infra"
  | "energy_connectivity"
  | "environment";

export type DisasterPhase = "mitigation" | "preparedness" | "response" | "recovery";

export type ChallengeStatus =
  | "REPORTED"
  | "REFINED"
  | "VERIFIED"
  | "OPEN"
  | "TEAM_FORMED"
  | "SOLUTION_PROPOSED"
  | "PILOT"
  | "DEPLOYED"
  | "IMPACT_VERIFIED"
  | "NEEDS_FOLLOW_UP"
  | "CLOSED_NOT_ACTIONABLE"
  | "DUPLICATE";

/** The confidence ladder. Each rung is a different kind of evidence. */
export type ConfidenceLevel =
  | "unverified"
  | "community_corroborated"
  | "externally_corroborated"
  | "field_verified"
  | "coordinator_approved"
  | "resolved_with_evidence";

export type Band = "critical" | "high" | "moderate" | "long_term";

export interface User {
  id: string;
  role: UserRole;
  full_name: string | null;
  org_id: string | null;
  region_id: string;
  district: string | null;
  language: string;
}

export interface Organisation {
  id: string;
  name: string;
  type: OrgType;
  district?: string | null;
}

/** One line of the priority score, with the sentence that justifies it. */
export interface ScoreFactor {
  key: string;
  label: string;
  max: number;
  raw: number;
  points: number;
  reason: string;
}

export interface ScoreBreakdown {
  total: number;
  factors: ScoreFactor[];
  weightsVersion: string;
}

/** The compiled brief. `source` says whether a model or the fallback wrote it. */
export interface Brief {
  title?: string;
  problem?: string;
  outcome?: string;
  needs?: string[];
  success_metric?: string;
  uncertainties?: string[];
  translated_text?: string;
  detected_language?: string;
  vulnerable?: string[];
  village?: string | null;
  district?: string;
  category?: string;
  dm_phase?: string;
  severity?: number;
  urgency?: number;
  people_est?: number;
  capabilities?: string[];
  hazard_tags?: string[];
  sdg_tags?: string[];
  sendai_tags?: string[];
  source?: "ai" | "fallback" | string;
}

export interface Challenge {
  id: string;
  ref: string;
  region_id?: string;
  title: string;
  category: Category | string;
  dm_phase: DisasterPhase | string;
  district: string | null;
  block: string | null;
  people_est: number;
  severity: number;
  priority: number;
  band: Band;
  confidence: ConfidenceLevel;
  status: ChallengeStatus;
  mode?: "peace" | "crisis";
  capabilities: string[];
  hazard_tags: string[];
  sdg_tags?: string[];
  sendai_tags?: string[];
  report_count: number;
  reporter_count: number;
  why_critical: string;
  ai_uncertainties: string[];
  score_breakdown: ScoreBreakdown | null;
  brief?: Brief;
  is_simulated?: boolean;
  severity_source?: string;
  ai_disclaimer?: string;
  created_at: string;
  updated_at: string;
  refined_at?: string | null;
  verified_at?: string | null;
  team_formed_at?: string | null;
  deployed_at?: string | null;
  closed_at?: string | null;
}

export interface ClusterReport {
  id: string;
  channel: "web" | "sms" | "volunteer";
  district: string | null;
  village: string | null;
  lang: string;
  people_est: number;
  urgency: number;
  vulnerable: string[];
  photo_urls: string[];
  original_text: string;
  translated_text: string | null;
  created_at: string;
}

export interface Cluster {
  reports: ClusterReport[];
  report_count: number;
  reporter_count: number;
  villages: number;
  photos: number;
  via_sms: number;
}

export interface Verification {
  id: string;
  kind: "community" | "field" | "coordinator" | string;
  /** ai_external: verified automatically from cited sources. field / coordinator: a person. */
  method?: "ai_external" | "field" | "coordinator" | "community" | string | null;
  note: string | null;
  evidence_url: string | null;
  source_urls?: string[];
  photo_count?: number;
  /** App URLs; empty for roles that may not open field photos. */
  photos?: string[];
  rejected_reason?: string | null;
  created_at: string;
}

/** Who to contact at an organisation. Only served to signed-in partners. */
export interface OrgContact {
  id: string;
  name: string;
  type: OrgType | string;
  district: string | null;
  contact_email: string | null;
  contact_person: string | null;
}

/** A project's public progress, on the challenge page. */
export interface PublicProject {
  college: { id: string; name: string; type: string; district: string | null } | null;
  proposal_id: string;
  score: number | null;
  funding_required: number | null;
  duration_days: number | null;
  awarded_at: string | null;
  stages: ExecutionStage[];
  stages_done: number;
  updates: { id: string; stage_id: string | null; note: string; photos: string[]; created_at: string }[];
}

export interface Assignment {
  org_id: string;
  role: string;
  accepted_at: string | null;
  organizations: { name: string; type: OrgType; district: string | null } | null;
}

export interface Solution {
  id: string;
  title: string;
  approach: string;
  cost_estimate: number | null;
  deploy_days: number | null;
  risks: string | null;
  ratings: Record<string, number> | null;
  readiness: number | null;
  readiness_notes: string | null;
  status: string;
  created_at: string;
  organizations: { name: string; type: OrgType } | null;
}

export interface Need {
  need_id: string;
  item: string;
  unit: string;
  kind: string;
  capability?: string | null;
  qty_needed: number;
  qty_pledged: number;
  qty_open?: number;
  qty_remaining?: number;
  pct_closed: number;
  contributor_count?: number;
}

export interface Gap {
  needs: Need[];
  pctClosed: number;
  fullyPledged: boolean;
}

export interface NextAction {
  to: string;
  action: string;
  ready: boolean;
  problems: string[];
}

export interface ChallengeDetail {
  challenge: Challenge;
  cluster: Cluster | null;
  verifications: Verification[];
  matches: unknown[];
  assignments: Assignment[];
  team: { seat: string; filled: boolean }[];
  solutions: Solution[];
  evidence: unknown[];
  impact: unknown | null;
  gap: Gap | null;
  timeline: TimelineEvent[];
  next_actions: NextAction[];
  redacted: boolean;
  /** The latest weather, news and web check, per provider. */
  external: ExternalSummary | null;
  /** Present once a college has been awarded the problem. */
  project: PublicProject | null;
}

/** One corroboration attempt against one outside source. */
export interface ExternalCheck {
  provider: "weather" | "news" | "web" | string;
  verdict: "supports" | "contradicts" | "inconclusive" | string;
  confidence: number;
  citations: { title?: string; url?: string; published_at?: string | null }[];
  reasoning: string;
  provider_error: string | null;
  model?: string | null;
  checked_at: string;
}

export interface ExternalSummary {
  checked: boolean;
  verdict: string;
  citation_count: number;
  checks: ExternalCheck[];
}

export interface VerifyQueueItem {
  id: string;
  ref: string;
  title: string;
  district: string | null;
  block: string | null;
  category: string;
  hazard_tags: string[];
  severity: number;
  priority: number;
  confidence: ConfidenceLevel;
  status: ChallengeStatus;
  people_est: number;
  report_count: number;
  reporter_count: number;
  brief: Brief | null;
  why_critical: string;
  created_at: string;
  verified_at?: string | null;
  external: ExternalSummary | null;
}

/** A problem the AI verified on its own, kept on the verifier's desk for audit. */
export interface AiVerifiedItem extends VerifyQueueItem {
  ai_verification: { sources: string[]; note: string | null; at: string | null };
}

/** What POST /api/challenges/:id/corroborate answers with. */
export interface CorroborationOutcome {
  challenge_id: string;
  ref: string | null;
  ran: boolean;
  disaster: { disaster: boolean; hazard: string | null; reason: string };
  verdict: string | null;
  confidence: number | null;
  reasoning: string | null;
  citations: { url: string; title: string; provider: string; publisher: string | null }[];
  method: "ai" | "rules" | "none" | null;
  model: string | null;
  all_providers_failed: boolean;
  auto_verified: boolean;
  eligible: boolean;
  status: string;
  confidence_level: string;
  still_needs_a_human: boolean;
}

/** Competition state as the college sees it. */
export interface CompetitionState {
  state: "not_opened" | "open" | "awarded" | "closed" | string;
  opened_at?: string | null;
  closes_at?: string | null;
  window_days?: number | null;
  leader_score?: number | null;
  leader_changed_at?: string | null;
  closed_at?: string | null;
  awarded_proposal_id?: string | null;
  proposal_count?: number | null;
  reopen_count?: number | null;
  i_am_leading?: boolean | null;
}

/** One rubric line as the reviewer stored it. `pages` cites the document. */
export interface ProposalRubricCriterion {
  key: string;
  label: string;
  max: number;
  points: number;
  reason: string;
  pages?: number[];
}

/** The whole stored review. Written once, by the scoring job. */
export interface ProposalRubric {
  total: number;
  criteria: ProposalRubricCriterion[];
  summary: string;
  /** What the college must change. Empty when the verdict is viable. */
  required_changes: string[];
  /** What the document itself asks for; pre-fills the college's requirements. */
  extraction?: {
    funding_required: number | null;
    currency: string;
    duration_days: number | null;
    materials: { item: string; qty: number | null; unit: string | null }[];
  };
  /** "rules" when the published rubric was applied without a model. */
  source?: "ai" | "rules";
  fallback_reason?: string | null;
}

export type ProposalVerdict = "viable" | "needs_changes" | "not_viable";

export interface Proposal {
  id: string;
  challenge_id: string;
  challenge: { ref: string; title: string; status?: string } | null;
  version: number;
  /** submitted | scoring | scored | rejected_not_viable | winner | runner_up | lapsed | withdrawn */
  state: string;
  ai_score: number | null;
  ai_verdict: ProposalVerdict | string | null;
  ai_rubric: ProposalRubric | null;
  ai_model?: string | null;
  ai_error: string | null;
  funding_required: number | null;
  currency: string | null;
  duration_days: number | null;
  document_name: string | null;
  document_pages?: number | null;
  /** Opens the uploaded PDF; null when the proposal was pasted as text. */
  document_url: string | null;
  is_winner: boolean;
  submitted_at: string;
  scored_at: string | null;
  window: { state: string; closes_at: string | null; leader_score: number | null } | null;
  /** Null until this proposal has a score to compare. */
  is_leading: boolean | null;
  /** Set only when someone else is ahead: the number to beat. */
  score_to_beat: number | null;
}

/** What a college sees for its own submission on the problems list. */
export interface MyProposalSummary {
  id: string;
  version: number;
  state: string;
  score: number | null;
  verdict: string | null;
  is_leading: boolean | null;
}

/** A row of GET /api/college/problems. */
export interface CollegeProblem extends Challenge {
  verified_at: string | null;
  /** How it was verified: by the AI from cited sources, or by a person. */
  verification: { method: "ai" | "verifier" | "coordinator"; sources: number; photos: number; at: string } | null;
  competition: CompetitionState;
  my_proposal: MyProposalSummary | null;
}

export interface NeedLine extends Need {
  /** The college delivering the project, and how to reach it. */
  college: OrgContact | null;
  project: { proposal_score: number | null; stages_total: number; stages_done: number };
  /** How much of this line the viewer's own organisation has already pledged. */
  my_pledged: number;
  challenge: {
    id: string;
    ref: string;
    title: string;
    district: string | null;
    category: string;
    status: string;
    priority: number;
    people_est: number;
    age_days: number;
  };
}

/** One pledge this organisation made, and what became of it. */
export interface Contribution {
  id: string;
  qty: number;
  kind: string;
  /** "₹1,00,000" or "5 kg". */
  amount: string;
  /** offered | committed | dispatched | received | withdrawn */
  state: string;
  can_dispatch: boolean;
  can_withdraw: boolean;
  note: string | null;
  expected_delivery_date: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  receipt_note: string | null;
  created_at: string;
  /** What the other side is still waiting for, in plain terms. */
  awaiting: string | null;
  need: { id: string; item: string; unit: string; qty_needed: number } | null;
  challenge: {
    id: string;
    ref: string;
    title: string;
    district: string | null;
    status: string;
    priority: number;
    closed: boolean;
    people_est: number;
  } | null;
}

/** A project this organisation funded, with the work its material unblocked. */
export interface FundedProject {
  id: string;
  ref: string;
  title: string;
  district: string | null;
  status: string;
  closed: boolean;
  college: OrgContact | null;
  thread_id: string | null;
  my_contributions: number;
  my_money: number;
  stages_total: number;
  stages_done: number;
  progress_pct: number | null;
  stages: { id: string; seq: number; title: string; status: string; started_at: string | null; completed_at: string | null }[];
  latest_update: { note: string | null; at: string; photos: string[] | null } | null;
  recent_updates: { note: string; at: string; photos: string[] }[];
  days_since_update: number | null;
}

// ---------------------------------------------------------------------------
// College projects: after the award
// ---------------------------------------------------------------------------

export interface ProjectPledge {
  id: string;
  org: OrgContact | null;
  qty: number;
  amount: string;
  state: string;
  note: string | null;
  expected_delivery_date: string | null;
  created_at: string;
  dispatched_at: string | null;
  received_at: string | null;
  receipt_note: string | null;
  can_receive: boolean;
  can_dispatch: boolean;
  thread_id: string | null;
}

export interface ProjectNeed {
  id: string;
  item: string;
  unit: string;
  kind: string;
  qty_needed: number;
  qty_pledged: number;
  qty_received: number;
  qty_remaining: number;
  pct_pledged: number;
  pct_received: number;
  created_at: string;
  can_remove: boolean;
  pledges: ProjectPledge[];
}

export interface ProjectUpdate {
  id: string;
  stage_id: string | null;
  note: string;
  author: string | null;
  photos: { path: string; url: string }[];
  created_at: string;
}

export interface ProjectDetail {
  challenge: {
    id: string;
    ref: string;
    title: string;
    district: string | null;
    block: string | null;
    category: string;
    status: string;
    priority: number;
    severity: number;
    people_est: number;
    confidence: string;
    problem: string | null;
    created_at: string;
    verified_at: string | null;
    awarded_at: string | null;
    deployed_at: string | null;
    closed_at: string | null;
  };
  college: OrgContact | null;
  proposal: {
    id: string;
    version: number;
    score: number | null;
    verdict: string | null;
    scored_by: "ai" | "rules";
    summary: string | null;
    funding_required: number | null;
    duration_days: number | null;
    document_name: string | null;
    document_url: string | null;
    submitted_at: string;
  };
  suggested_requirements: {
    funding_amount: number | null;
    materials: { item: string; qty: number; unit: string }[];
  };
  requirements_published: boolean;
  needs: ProjectNeed[];
  funding: { needed: number; pledged: number; received: number };
  materials: { lines: number; fully_pledged: number; fully_received: number };
  fully_pledged: boolean;
  fully_received: boolean;
  stages: ExecutionStage[];
  stages_total: number;
  stages_done: number;
  progress_pct: number | null;
  updates: ProjectUpdate[];
  cadence: {
    updates: number;
    average_gap_days: number | null;
    longest_gap_days: number | null;
    days_since_last_update: number | null;
    days_since_award: number | null;
  };
  threads: { id: string; contributor: OrgContact | null; last_message_at: string | null }[];
  viewer: { is_college: boolean; my_thread_id: string | null };
}

export interface ProjectSummary {
  id: string;
  ref: string;
  title: string;
  district: string | null;
  status: string;
  priority: number;
  people_est: number;
  college: OrgContact | null;
  score: number | null;
  awarded_at: string | null;
  requirements_published: boolean;
  pct_pledged: number | null;
  contributions_awaiting_receipt: number;
  stages_total: number;
  stages_done: number;
  last_update_at: string | null;
  days_since_update: number | null;
}

export interface ContributionTotals {
  money: number;
  lines: number;
  delivered: number;
  awaiting_dispatch?: number;
  awaiting_confirmation?: number;
}

export interface ExecutionStage {
  id: string;
  seq: number;
  title: string;
  definition_of_done: string;
  expected_days: number;
  status: "pending" | "in_progress" | "blocked" | "done" | string;
  blocked_on_need_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  expected_start: string | null;
  expected_end: string | null;
  ai_generated: boolean;
  version: number;
}

export interface TimelineEvent {
  at: string;
  kind: string;
  actor: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
  /** Hours since the previous event. Null on the first one. */
  gap_hours: number | null;
}

export interface ChallengeHistory {
  challenge: Challenge;
  window: {
    opened_at: string;
    window_days: number;
    closes_at: string;
    state: string;
    leader_proposal_id: string | null;
    leader_score: number | null;
    leader_changed_at: string | null;
    awarded_proposal_id: string | null;
    closed_at: string | null;
    reopen_count: number;
  } | null;
  stages: ExecutionStage[];
  needs: { id: string; item: string; unit: string; kind: string; qty_needed: number }[];
  contributions: {
    id: string;
    org: string;
    item: string;
    unit: string;
    kind: string;
    qty: number;
    state: string;
    pledged_at: string;
    dispatched_at: string | null;
    received_at: string | null;
    receipt_note: string | null;
    days_to_receive: number | null;
  }[];
  proposals: {
    id: string;
    org: string;
    version: number;
    state: string;
    ai_score: number | null;
    ai_verdict: string | null;
    ai_rubric: ProposalRubric | null;
    ai_model: string | null;
    funding_required: number | null;
    duration_days: number | null;
    document_name: string | null;
    document_pages: number | null;
    submitted_at: string;
    scored_at: string | null;
  }[];
  counts: Record<string, number>;
  timeline: TimelineEvent[];
  longest_gap_hours: number | null;
  /** The time between one progress update from the college and the next. */
  progress_cadence: {
    updates: { at: string; note: string; author: string | null; photos: string[]; gap_days: number | null }[];
    average_gap_days: number | null;
    longest_gap_days: number | null;
    days_since_last_update: number | null;
  };
}

export interface AdminWindow {
  challenge_id: string;
  state: string;
  opened_at: string;
  closes_at: string;
  closed_at: string | null;
  window_days: number;
  leader_score: number | null;
  reopen_count: number;
  awarded_proposal_id: string | null;
  ref: string | null;
  title: string | null;
  district: string | null;
  priority: number | null;
  challenge_status: string | null;
  proposals: number;
  viable: number;
  awaiting_score: number;
}

export interface AssistantAnswer {
  answer: string;
  generated_by: "ai" | "rules";
  model: string | null;
  scope: "challenge" | "system";
  refs: string[];
}

export interface SlaStage {
  stage_key: string;
  label: string;
  target_hours: number;
  sample_size: number;
  median_hours: number | null;
  worst_hours: number | null;
  attainment_pct: number | null;
  breaches: { challenge_id: string; ref: string; district: string | null; hours: number }[];
}

export interface SlaReport {
  stages: SlaStage[];
  by_district: {
    district: string;
    sample_size: number;
    attainment_pct: number;
    mean_hours: number;
  }[];
  overall: { sample_size: number; stages_measured: number; stages_total: number };
}

export interface DeliveryProject {
  id: string;
  ref: string;
  title: string;
  district: string | null;
  status: string;
  college: string | null;
  updates: number;
  average_gap_days: number | null;
  last_update_at: string | null;
  days_since_update: number | null;
}

export interface AdminMetrics {
  totals: {
    challenges: number;
    open: number;
    awaiting_verification: number;
    open_to_colleges: number;
    in_delivery: number;
    solved: number;
    closed_not_actionable: number;
    severe_open: number;
    severe_solved: number;
  };
  by_status: Record<string, number>;
  by_district: Record<string, number>;
  /** Severe (priority 75+) and still open: how long since reported, and since listed for colleges. */
  severe_open: {
    id: string;
    ref: string;
    title: string;
    district: string | null;
    priority: number;
    status: string;
    age_days: number | null;
    listed_days: number | null;
  }[];
  severe_open_ages_days: number[];
  solved: { count: number; by_band: Record<string, number>; median_days_to_solve: number | null };
  verification: {
    ai_verified: number;
    human_verified: number;
    rejected: number;
    awaiting: number;
    ai_share_pct: number | null;
  };
  median_verification_hours: number | null;
  proposals: {
    total: number;
    awaiting_score: number;
    viable: number;
    needs_changes: number;
    not_viable: number;
    awarded: number;
    scored_by_rules: number;
  };
  funding: {
    money_pledged: number;
    money_received: number;
    material_lines: number;
    material_lines_received: number;
    currency: string;
  };
  sla: Record<string, { n: number; met: number; median_hours: number | null }>;
  delivery: DeliveryProject[];
  quiet_projects: DeliveryProject[];
  cadence: { projects: number; average_gap_days: number | null };
  competition: { windows_open: number; windows_awarded: number; windows_reopened: number };
  open_windows: {
    challenge_id: string;
    ref: string | null;
    title: string | null;
    district: string | null;
    opened_at: string;
    closes_at: string;
    leader_score: number | null;
    proposals: number;
    viable: number;
    awaiting_score: number;
  }[];
}

/**
 * GET /api/dashboard/metrics. Several fields are deliberately nullable: the
 * service returns null where a median has no sample, and the UI must print a
 * dash and a reason rather than a zero.
 */
export interface DashboardMetrics {
  region_id: string;
  headline: {
    median_minutes_to_team_formed: number | null;
    median_hours_to_team_formed: number | null;
    pct_reaching_pilot_or_deployment: number | null;
    university_industry_collaborations: number | null;
    sample_size: number;
  };
  speed: {
    median_minutes_to_team_formed: number | null;
    median_hours_to_team_formed: number | null;
    median_minutes_to_resolution: number | null;
    median_hours_to_resolution: number | null;
  };
  quality: {
    pct_verified: number | null;
    duplicates_merged: number | null;
    community_confirmed: number | null;
  };
  outcome: {
    people_served: number | null;
    vulnerable_served: number | null;
    unmet_challenges: number | null;
  };
  funnel: Record<string, number>;
  by_district: Record<string, number>;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  organisations: {
    total: number;
    verified: number;
    by_type: Record<string, number>;
  } | null;
  crisis: {
    active: number;
    events: {
      id: string;
      hazard: string;
      source: string;
      headline: string;
      is_drill: boolean;
      districts: string[];
      severity: number;
      started_at: string;
    }[];
  };
  simulated: boolean;
  /** Known problems in the underlying rows. Printed, never smoothed over. */
  data_warnings: Record<string, number>;
}

export interface SilentZones {
  region_id: string;
  window_days: number;
  silent_zones: {
    district: string;
    block?: string | null;
    population?: number | null;
    hazard?: string | null;
    intensity?: number | null;
    reports?: number;
  }[];
  hazard_layers: Record<string, { districts: string[]; max_intensity: number; cells: number }>;
  explanation: string;
}

export interface Thread {
  id: string;
  challenge: { id: string; ref: string; title: string; district?: string | null };
  college: Organisation | null;
  contributor: Organisation | null;
  my_side: "college" | "contributor" | "observer" | string;
  message_count: number;
  unread_count: number;
  created_at: string;
  last_message_at: string | null;
}

export interface Message {
  id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  author_role: UserRole | string;
  author_org: string | null;
  is_self: boolean;
}

/** A row of GET /api/reports — one thing this person filed, and where it went. */
export interface MyReport {
  id: string;
  client_id: string;
  channel: "web" | "sms" | "volunteer" | string;
  district: string | null;
  village: string | null;
  lang: string;
  original_text: string | null;
  translated_text: string | null;
  people_est: number | null;
  urgency: number | null;
  vulnerable: string[];
  photo_count: number;
  has_audio: boolean;
  created_at: string;
  processed_at: string | null;
  dedup_similarity: number | null;
  challenge: {
    id: string;
    ref: string;
    title: string;
    district: string | null;
    category: string;
    status: ChallengeStatus | string;
    confidence: ConfidenceLevel | string;
    priority: number;
    severity: number;
    people_est: number;
    report_count: number;
    verified_at: string | null;
    updated_at: string;
  } | null;
}

/** What POST /api/reports answers with. */
export interface IntakeResult {
  report_id: string;
  challenge_id: string;
  challenge_ref: string;
  decision: "new" | "merge" | "review" | string;
  dedup_reason: string | null;
  possible_duplicates: {
    challenge_id: string;
    ref: string | null;
    title: string;
    similarity: number;
    distance_km: number | null;
  }[];
  priority: number | null;
  confidence: ConfidenceLevel | null;
  trace: TraceStep[];
  trace_total_ms: number | null;
  degraded: boolean;
  already_received: boolean;
  /**
   * queued: a disaster-type report; the AI is checking weather, news and web and
   * verifies it if it finds proof. not_disaster: a verifier will check it.
   */
  corroboration?: "queued" | "not_disaster" | "skipped";
  corroboration_reason?: string;
}

export interface TraceStep {
  step: string;
  ms?: number;
  model?: string | null;
  ok?: boolean;
  note?: string | null;
  [k: string]: unknown;
}

export interface HealthReport {
  ok: boolean;
  ms: number;
  database: { connected: boolean; regions: number; challenges: number; error: string | null };
  ai: {
    enabled: boolean;
    provider: string;
    gemini_keys_count: number;
    model_cascade: string[];
    speech_to_text: boolean;
    remote_embeddings: boolean;
  };
  sms: { inbound_secret_set: boolean; outbound_gateway: boolean; number: string | null };
  demo: { role_switcher: boolean; reset: boolean };
}
