-- ===========================================================================
-- JharSetu 0003 - core data model
-- ===========================================================================
-- Straight from the playbook's data model. Two things it insists on and that
-- are painful to retrofit, so they are here from the first migration:
--   * region_id on everything that belongs to a place
--   * client_id on reports, so a phone that retries five times files one report
-- ===========================================================================

-- Embedding width. 768 matches Gemini text-embedding-004 and the deterministic
-- local fallback in lib/ai/embeddings.ts, so dedup works with no API key at all.
-- Changing this means re-embedding everything, so it is fixed now.

-- ---------------------------------------------------------------------------
-- regions - the switch that proves any state can run this
-- ---------------------------------------------------------------------------
create table regions (
  id            text primary key,                    -- 'jharkhand', 'rajkot'
  name          text not null,
  country       text not null default 'IN',
  center        geography(Point, 4326) not null,
  zoom          int  not null default 8,
  boundary      jsonb,                                -- district GeoJSON FeatureCollection
  languages     text[] not null default '{hi,en}',
  timezone      text not null default 'Asia/Kolkata',
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- users - mirrors auth.users, carries the role that row-level security reads
-- ---------------------------------------------------------------------------
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null default 'citizen',
  full_name     text,
  org_id        uuid,                                 -- FK added after organizations
  region_id     text not null references regions(id),
  language      text not null default 'hi',
  district      text,
  phone_hash    text,                                 -- never the raw number
  skills        text[] not null default '{}',
  reputation    int not null default 0,
  is_verified   boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- organizations - universities, companies, NGOs, volunteer groups, government
-- ---------------------------------------------------------------------------
create table organizations (
  id                 uuid primary key default gen_random_uuid(),
  region_id          text not null references regions(id),
  type               org_type not null,
  name               text not null,
  district           text,
  geom               geography(Point, 4326),
  response_radius_km int not null default 50,
  expertise          text[] not null default '{}',
  csr_focus          text[] not null default '{}',
  csr_budget         numeric(14,2),
  contact_email      text,
  about              text,
  -- An admin must verify an organisation before it can adopt or pledge.
  verified           boolean not null default false,
  is_simulated       boolean not null default true,   -- every seeded row says so
  embedding          vector(768),                     -- capability-fit matching
  created_at         timestamptz not null default now()
);

alter table users
  add constraint users_org_id_fkey foreign key (org_id) references organizations(id) on delete set null;

-- What an organisation can actually do, and how much of it is free right now.
create table org_capabilities (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  capability     text not null,                       -- 'electronics', 'water_testing', 'drone_mapping'
  capacity       int  not null default 1,
  available_from date,
  note           text,
  unique (org_id, capability)
);

-- ---------------------------------------------------------------------------
-- resources - the registry behind "what is already nearby?"
-- ---------------------------------------------------------------------------
create table resources (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  region_id     text not null references regions(id),
  type          text not null,                        -- 'boat', 'drone', 'siren_unit'
  label         text,
  quantity      int  not null default 1,
  unit          text not null default 'unit',
  geom          geography(Point, 4326) not null,
  availability  text not null default 'available',    -- available | committed | unavailable
  is_simulated  boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- crisis_events - a real CAP alert, or a district's pre-monsoon mock drill
-- ---------------------------------------------------------------------------
create table crisis_events (
  id          uuid primary key default gen_random_uuid(),
  region_id   text not null references regions(id),
  hazard      text not null,                          -- 'flood', 'thunderstorm'
  source      text not null default 'drill',          -- 'IMD', 'JSDMA', 'drill'
  headline    text,
  is_drill    boolean not null default true,
  districts   text[] not null default '{}',
  severity    int not null default 4 check (severity between 1 and 5),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  started_by  uuid references users(id)
);

-- ---------------------------------------------------------------------------
-- challenges - a verified problem the platform tracks
-- ---------------------------------------------------------------------------
create table challenges (
  id               uuid primary key default gen_random_uuid(),
  ref              text unique,                       -- 'C-112', shown on stage
  region_id        text not null references regions(id),
  title            text not null,
  brief            jsonb not null default '{}'::jsonb, -- the full Compiler output
  category         challenge_category not null,
  dm_phase         dm_phase not null default 'preparedness',
  district         text,
  block            text,
  geom             geography(Point, 4326),
  people_est       int not null default 0,
  severity         int not null default 3 check (severity between 1 and 5),
  severity_source  text not null default 'ai',        -- 'ai' | 'coordinator'
  priority         int not null default 0 check (priority between 0 and 100),
  score_breakdown  jsonb not null default '{}'::jsonb, -- every factor, shown in the UI
  why_critical     text,
  confidence       confidence_level not null default 'unverified',
  status           challenge_status not null default 'REPORTED',
  mode             platform_mode not null default 'peace',
  crisis_id        uuid references crisis_events(id) on delete set null,
  capabilities     text[] not null default '{}',      -- what it needs built
  hazard_tags      text[] not null default '{}',
  sdg_tags         text[] not null default '{}',
  sendai_tags      text[] not null default '{}',
  report_count     int not null default 0,
  reporter_count   int not null default 0,            -- distinct reporters, for confidence
  embedding        vector(768),
  merged_into      uuid references challenges(id) on delete set null,
  is_simulated     boolean not null default true,
  ai_uncertainties text[] not null default '{}',
  created_at       timestamptz not null default now(),
  refined_at       timestamptz,
  verified_at      timestamptz,
  team_formed_at   timestamptz,
  deployed_at      timestamptz,
  closed_at        timestamptz,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reports - every channel lands here, through one intake API
-- ---------------------------------------------------------------------------
create table reports (
  id               uuid primary key default gen_random_uuid(),
  client_id        text not null,                     -- idempotency key from the phone
  region_id        text not null references regions(id),
  reporter_id      uuid references users(id) on delete set null,
  channel          report_channel not null default 'web',
  sms_code         text,                              -- 'K7F2', merges SMS with the full report
  phone_hash       text,                              -- hashed, for rate limiting only
  original_text    text,
  lang             text not null default 'hi',
  translated_text  text,
  audio_url        text,
  photo_urls       text[] not null default '{}',
  geom             geography(Point, 4326),
  location_source  text,                              -- 'gps' | 'village_picker' | 'sms' | 'none'
  district         text,
  village          text,
  people_est       int,
  urgency          int check (urgency between 1 and 5),
  vulnerable       vulnerability_tag[] not null default '{}',
  extracted        jsonb not null default '{}'::jsonb, -- raw Compiler extraction
  embedding        vector(768),
  cluster_id       uuid references challenges(id) on delete set null,
  dedup_similarity real,
  consent          boolean not null default false,
  is_simulated     boolean not null default true,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz,
  unique (region_id, client_id)                        -- a retried report appears once
);

-- ---------------------------------------------------------------------------
-- verifications - the confidence ladder and the community signals
-- ---------------------------------------------------------------------------
create table verifications (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  by_user       uuid references users(id) on delete set null,
  kind          verification_kind not null,
  evidence_url  text,
  note          text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- matches and assignments - recommendations, then the team that accepted
-- ---------------------------------------------------------------------------
create table matches (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  score         int not null check (score between 0 and 100),
  reasons       jsonb not null default '[]'::jsonb,   -- shown next to every recommendation
  status        match_status not null default 'suggested',
  overridden_by uuid references users(id),            -- a coordinator can override, and it is logged
  created_at    timestamptz not null default now(),
  unique (challenge_id, org_id)
);

create table assignments (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  role          text not null,                        -- 'builder' | 'funder' | 'deliverer' | 'mentor'
  accepted_at   timestamptz not null default now(),
  released_at   timestamptz,                          -- auto-release after 14 idle days
  unique (challenge_id, org_id, role)
);

-- The skill-gap team builder writes its roster here.
create table team_members (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  org_id        uuid references organizations(id) on delete set null,
  seat          text not null,                        -- 'ECE', 'CSE', 'Civil', 'Mentor'
  filled        boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- solutions - proposals, each scored for readiness
-- ---------------------------------------------------------------------------
create table solutions (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references challenges(id) on delete cascade,
  org_id          uuid references organizations(id) on delete set null,
  submitted_by    uuid references users(id) on delete set null,
  title           text not null,
  approach        text not null,
  cost_estimate   numeric(12,2),
  deploy_days     int,
  risks           text,
  ratings         jsonb not null default '{}'::jsonb, -- the seven 1-5 human ratings
  readiness       int check (readiness between 0 and 100),
  readiness_notes text,
  status          solution_status not null default 'submitted',
  reviewed_by     uuid references users(id),
  is_simulated    boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Resource Swarm - needs, and the partial pledges that close the gap
-- ---------------------------------------------------------------------------
create table resource_needs (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  solution_id   uuid references solutions(id) on delete set null,
  item          text not null,                        -- '12 siren units'
  qty_needed    numeric(12,2) not null,
  unit          text not null default 'unit',
  kind          pledge_kind not null default 'equipment',
  capability    text,                                 -- used to alert the right partners
  created_at    timestamptz not null default now()
);

create table pledges (
  id            uuid primary key default gen_random_uuid(),
  need_id       uuid not null references resource_needs(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  pledged_by    uuid references users(id) on delete set null,
  qty           numeric(12,2) not null check (qty > 0),
  kind          pledge_kind not null,
  status        pledge_status not null default 'offered',
  note          text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Delivery - milestones, evidence, and the impact record written on closure
-- ---------------------------------------------------------------------------
create table milestones (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  solution_id   uuid references solutions(id) on delete set null,
  title         text not null,
  due           date,
  status        milestone_status not null default 'pending',
  evidence_url  text,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table evidence_files (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references challenges(id) on delete cascade,
  uploaded_by   uuid references users(id) on delete set null,
  url           text not null,
  phase         evidence_phase not null,
  caption       text,
  -- Public copies have their GPS metadata stripped; the original stays private.
  exif_stripped boolean not null default true,
  created_at    timestamptz not null default now()
);

create table impact_records (
  id                     uuid primary key default gen_random_uuid(),
  challenge_id           uuid not null unique references challenges(id) on delete cascade,
  people_served          int not null default 0,
  vulnerable_served      int not null default 0,
  time_to_match_min      int,
  time_to_resolution_min int,
  remaining_need         text,
  verified_by            uuid references users(id),
  community_confirmed    boolean not null default false,
  community_confirmed_at timestamptz,
  follow_up_due          timestamptz,                 -- 'recheck the water supply in 48 hours'
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ledger - audit trail, activity timeline and tamper evidence, in one table
-- ---------------------------------------------------------------------------
create table ledger (
  id          bigserial primary key,
  region_id   text references regions(id),
  entity      text not null,                          -- 'challenge' | 'solution' | 'pledge'
  entity_id   uuid,
  action      text not null,                          -- 'approved' | 'pledged' | 'deployed'
  actor       uuid references users(id),
  actor_role  user_role,
  payload     jsonb not null default '{}'::jsonb,
  prev_hash   text,
  hash        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications - in-app realtime, and SMS to reporters in their own language
-- ---------------------------------------------------------------------------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  phone_hash  text,                                   -- for SMS to a non-account reporter
  channel     notify_channel not null default 'app',
  template    text not null,
  payload     jsonb not null default '{}'::jsonb,
  lang        text not null default 'hi',
  body        text,
  read_at     timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- hazard_cells - the GIS layer behind hazard exposure and silent zones
-- ---------------------------------------------------------------------------
create table hazard_cells (
  id            bigserial primary key,
  region_id     text not null references regions(id),
  hazard        text not null,                        -- 'lightning' | 'flood' | 'drought' | 'mining'
  district      text,
  geom          geography(Polygon, 4326) not null,
  intensity     real not null check (intensity between 0 and 1),
  population    int not null default 0,
  expected_reports int not null default 0             -- silent zone = expected high, actual near zero
);

-- ---------------------------------------------------------------------------
-- scoring_weights - the formulas are public and admin-editable, every change logged
-- ---------------------------------------------------------------------------
create table scoring_weights (
  id          text primary key,                       -- 'priority' | 'match' | 'readiness'
  weights     jsonb not null,
  updated_by  uuid references users(id),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sms_inbox - raw gateway traffic, kept so a parse failure is debuggable on stage
-- ---------------------------------------------------------------------------
create table sms_inbox (
  id           uuid primary key default gen_random_uuid(),
  phone_hash   text not null,
  raw_text     text not null,
  parsed       jsonb,
  parse_ok     boolean not null default false,
  report_id    uuid references reports(id) on delete set null,
  received_at  timestamptz not null default now()
);
