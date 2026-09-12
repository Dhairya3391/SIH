-- JharSetu (SIH26043) Database Schema
-- Run ALL 245 lines in the Supabase SQL Editor

-- 0. Clean reset of existing partial tables if any
DROP TABLE IF EXISTS verifications, matches, assignments, pledges, resource_needs, milestones, evidence_files, impact_records, ledger, crisis_events, solutions, reports, challenges, org_capabilities, resources, organizations, regions CASCADE;

-- 1. Enable optional extensions if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Regions
CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    zoom INTEGER NOT NULL DEFAULT 7,
    languages TEXT[] NOT NULL DEFAULT '{}',
    total_districts INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT ('org-' || uuid_generate_v4()::text),
    region_id TEXT REFERENCES regions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('univ', 'company', 'ngo', 'govt', 'volunteers')),
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    response_radius_km DOUBLE PRECISION NOT NULL DEFAULT 50,
    csr_focus TEXT[] DEFAULT '{}',
    csr_budget BIGINT DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    capabilities TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Organization Capabilities
CREATE TABLE IF NOT EXISTS org_capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    capability TEXT NOT NULL,
    capacity INTEGER DEFAULT 1,
    available_from TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Resources Registry ("Available Nearby")
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY DEFAULT ('res-' || uuid_generate_v4()::text),
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'units',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    availability TEXT NOT NULL CHECK (availability IN ('immediate', 'within_24h', 'within_week')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Challenges
CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    region_id TEXT REFERENCES regions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    problem TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('disaster', 'water', 'health', 'education', 'agriculture', 'roads', 'energy', 'environment')),
    dm_phase TEXT NOT NULL CHECK (dm_phase IN ('mitigation', 'preparedness', 'response', 'recovery')),
    district TEXT NOT NULL,
    block TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    people_est INTEGER NOT NULL DEFAULT 0,
    severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
    priority INTEGER NOT NULL CHECK (priority BETWEEN 0 AND 100),
    priority_band TEXT NOT NULL CHECK (priority_band IN ('critical', 'high', 'moderate', 'long-term')),
    score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence TEXT NOT NULL CHECK (confidence IN ('unverified', 'community_corroborated', 'field_verified', 'coordinator_approved', 'resolved_with_evidence')),
    status TEXT NOT NULL CHECK (status IN ('REPORTED', 'REFINED', 'VERIFIED', 'OPEN', 'TEAM_FORMED', 'SOLUTION_PROPOSED', 'PILOT', 'DEPLOYED', 'IMPACT_VERIFIED')),
    report_count INTEGER NOT NULL DEFAULT 1,
    capabilities_needed TEXT[] NOT NULL DEFAULT '{}',
    available_nearby TEXT[] DEFAULT '{}',
    suggested_partners JSONB DEFAULT '[]'::jsonb,
    ai_unsure_about TEXT,
    outcome TEXT,
    success_metric TEXT,
    mode TEXT NOT NULL DEFAULT 'peace' CHECK (mode IN ('peace', 'crisis')),
    crisis_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Reports
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY DEFAULT ('REP-' || uuid_generate_v4()::text),
    client_id TEXT UNIQUE NOT NULL,
    region_id TEXT REFERENCES regions(id) ON DELETE CASCADE,
    district TEXT NOT NULL,
    village TEXT,
    reporter_id TEXT,
    reporter_name TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('web', 'sms', 'volunteer')),
    phone_hash TEXT,
    original_text TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'Hindi',
    audio_url TEXT,
    photo_urls TEXT[] DEFAULT '{}',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    people_est INTEGER NOT NULL DEFAULT 0,
    urgency INTEGER NOT NULL CHECK (urgency BETWEEN 1 AND 5),
    vulnerable TEXT[] DEFAULT '{}',
    translated_text TEXT,
    category TEXT NOT NULL CHECK (category IN ('disaster', 'water', 'health', 'education', 'agriculture', 'roads', 'energy', 'environment')),
    cluster_id TEXT REFERENCES challenges(id) ON DELETE SET NULL,
    consent BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Verifications
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id TEXT REFERENCES challenges(id) ON DELETE CASCADE,
    by_user TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('field', 'still_exists', 'improved', 'inaccurate', 'more_affected', 'unsuitable')),
    evidence_url TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Matches & Recommendations
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id TEXT REFERENCES challenges(id) ON DELETE CASCADE,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    reasons JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'notified', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Solutions & Proposals
CREATE TABLE IF NOT EXISTS solutions (
    id TEXT PRIMARY KEY DEFAULT ('prop-' || uuid_generate_v4()::text),
    challenge_id TEXT REFERENCES challenges(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    title TEXT NOT NULL,
    approach TEXT NOT NULL,
    cost_estimate TEXT,
    deploy_days INTEGER NOT NULL DEFAULT 30,
    risks TEXT,
    ratings JSONB DEFAULT '{}'::jsonb,
    readiness_score INTEGER NOT NULL CHECK (readiness_score BETWEEN 0 AND 100),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved_for_pilot', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Resource Needs & Pledges (Resource Swarm)
CREATE TABLE IF NOT EXISTS resource_needs (
    id TEXT PRIMARY KEY DEFAULT ('rn-' || uuid_generate_v4()::text),
    challenge_id TEXT REFERENCES challenges(id) ON DELETE CASCADE,
    solution_id TEXT REFERENCES solutions(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    qty_needed INTEGER NOT NULL,
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pledges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    need_id TEXT REFERENCES resource_needs(id) ON DELETE CASCADE,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('money', 'equipment', 'people', 'expertise')),
    status TEXT NOT NULL DEFAULT 'pledged' CHECK (status IN ('pledged', 'in_transit', 'delivered')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Milestones & Evidence
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id TEXT REFERENCES challenges(id) ON DELETE CASCADE,
    solution_id TEXT REFERENCES solutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    evidence_url TEXT
);

CREATE TABLE IF NOT EXISTS evidence_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id TEXT REFERENCES challenges(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL,
    url TEXT NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('before', 'after', 'closure')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Impact Records
CREATE TABLE IF NOT EXISTS impact_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id TEXT UNIQUE REFERENCES challenges(id) ON DELETE CASCADE,
    people_served INTEGER NOT NULL,
    time_to_match_min INTEGER,
    time_to_resolution_min INTEGER,
    remaining_need TEXT,
    verified_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Tamper-Evident Hash-Chained Audit Ledger
CREATE TABLE IF NOT EXISTS ledger (
    id BIGSERIAL PRIMARY KEY,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Crisis Events
CREATE TABLE IF NOT EXISTS crisis_events (
    id TEXT PRIMARY KEY,
    region_id TEXT REFERENCES regions(id) ON DELETE CASCADE,
    hazard TEXT NOT NULL,
    source TEXT NOT NULL,
    is_drill BOOLEAN DEFAULT FALSE,
    districts TEXT[] NOT NULL DEFAULT '{}',
    severity INTEGER NOT NULL DEFAULT 5,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- Indices for rapid geo & filter lookups
CREATE INDEX IF NOT EXISTS idx_challenges_region ON challenges(region_id);
CREATE INDEX IF NOT EXISTS idx_challenges_district ON challenges(district);
CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category);
CREATE INDEX IF NOT EXISTS idx_challenges_priority ON challenges(priority DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_reports_cluster ON reports(cluster_id);
CREATE INDEX IF NOT EXISTS idx_reports_client_id ON reports(client_id);
