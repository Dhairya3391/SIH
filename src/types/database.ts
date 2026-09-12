export type Category = 
  | 'disaster' 
  | 'water' 
  | 'health' 
  | 'education' 
  | 'agriculture' 
  | 'roads' 
  | 'energy' 
  | 'environment';

export type DisasterPhase = 'mitigation' | 'preparedness' | 'response' | 'recovery';

export type ChallengeStatus = 
  | 'REPORTED'
  | 'REFINED'
  | 'VERIFIED'
  | 'OPEN'
  | 'TEAM_FORMED'
  | 'SOLUTION_PROPOSED'
  | 'PILOT'
  | 'DEPLOYED'
  | 'IMPACT_VERIFIED';

export type ConfidenceLevel = 
  | 'unverified'
  | 'community_corroborated'
  | 'field_verified'
  | 'coordinator_approved'
  | 'resolved_with_evidence';

export type PriorityBand = 'critical' | 'high' | 'moderate' | 'long-term';

export type UserRole = 
  | 'citizen' 
  | 'volunteer' 
  | 'coordinator' 
  | 'university' 
  | 'company' 
  | 'admin';

export type OrgType = 'univ' | 'company' | 'ngo' | 'govt' | 'volunteers';

export interface ScoreBreakdown {
  severity: number;         // Max 25
  urgency: number;          // Max 15
  people_affected: number;  // Max 15
  vulnerability: number;    // Max 15
  hazard_exposure: number;  // Max 10
  resource_gap: number;     // Max 10
  recurrence: number;       // Max 5
  community_signal: number; // Max 5 (Capped)
  why_critical: string;
}

export interface Region {
  id: string;
  name: string;
  state: string;
  center: [number, number]; // [lat, lng]
  zoom: number;
  languages: string[];
  total_districts: number;
}

export interface Organization {
  id: string;
  region_id: string;
  type: OrgType;
  name: string;
  district: string;
  lat: number;
  lng: number;
  response_radius_km: number;
  csr_focus?: string[];
  csr_budget?: number;
  verified: boolean;
  capabilities: string[];
}

export interface ResourceItem {
  id: string;
  org_id: string;
  org_name?: string;
  type: string;
  quantity: number;
  unit: string;
  lat: number;
  lng: number;
  availability: 'immediate' | 'within_24h' | 'within_week';
}

export interface Report {
  id: string;
  client_id: string;
  region_id: string;
  district: string;
  village?: string;
  reporter_id?: string;
  reporter_name?: string;
  channel: 'web' | 'sms' | 'volunteer';
  phone_hash?: string;
  original_text: string;
  lang: string;
  audio_url?: string;
  photo_urls: string[];
  lat: number;
  lng: number;
  people_est: number;
  urgency: number; // 1-5
  vulnerable: ('children' | 'elderly' | 'disability' | 'pregnancy' | 'medical')[];
  translated_text?: string;
  category: Category;
  cluster_id?: string;
  consent: boolean;
  created_at: string;
}

export interface Proposal {
  id: string;
  challenge_id: string;
  team_id: string;
  team_name: string;
  title: string;
  approach: string;
  cost_estimate: string;
  deploy_days: number;
  risks: string;
  readiness_score: number; // 0-100
  ratings: {
    technical: number; // /20
    cost: number;      // /15
    time: number;      // /15
    local_res: number; // /15
    safety: number;    // /15
    community: number; // /10
    scalability: number; // /10
  };
  status: 'submitted' | 'under_review' | 'approved_for_pilot' | 'rejected';
}

export interface ResourceNeed {
  id: string;
  challenge_id: string;
  item: string;
  qty_needed: number;
  qty_pledged: number;
  unit: string;
}

export interface Challenge {
  id: string;
  region_id: string;
  title: string;
  problem: string;
  category: Category;
  dm_phase: DisasterPhase;
  district: string;
  block?: string;
  lat: number;
  lng: number;
  people_est: number;
  severity: number; // 1-5
  priority: number; // 0-100
  priority_band: PriorityBand;
  score_breakdown: ScoreBreakdown;
  confidence: ConfidenceLevel;
  status: ChallengeStatus;
  report_count: number;
  capabilities_needed: string[];
  available_nearby?: string[];
  suggested_partners?: {
    name: string;
    type: OrgType;
    reason: string;
  }[];
  resource_needs?: ResourceNeed[];
  proposals?: Proposal[];
  ai_unsure_about?: string;
  outcome?: string;
  success_metric?: string;
  mode: 'peace' | 'crisis';
  crisis_id?: string;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  entity: 'report' | 'challenge' | 'proposal' | 'pledge' | 'verification';
  entity_id: string;
  action: string;
  actor: string;
  actor_role: UserRole;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  created_at: string;
}
