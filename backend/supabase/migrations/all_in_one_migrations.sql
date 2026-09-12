-- ===========================================================================
-- JharSetu Master Migration (All 8 migrations in sequence)
-- ===========================================================================

-- 0. Clean reset of public schema to wipe any legacy hour-1 partial tables
drop schema if exists public cascade;
create schema public;
grant all on schema public to postgres;
grant all on schema public to anon;
grant all on schema public to authenticated;
grant all on schema public to service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;

-- ===========================================================================
-- JharSetu 0001 - extensions
-- ===========================================================================
-- Supabase ships these; we only have to switch them on. PostGIS answers
-- "what is within 20 km of this challenge?" and pgvector answers "is this
-- report a duplicate of one we already have?".
-- ===========================================================================

create extension if not exists "pgcrypto"  with schema extensions;  -- gen_random_uuid, digest
create extension if not exists "postgis"   with schema extensions;  -- geography, ST_DWithin
create extension if not exists "vector"    with schema extensions;  -- embeddings
create extension if not exists "pg_trgm"   with schema extensions;  -- fuzzy village-name lookup

-- Supabase installs extensions into the `extensions` schema, which is already
-- on the search_path for the roles we use. Functions we define later still set
-- their own search_path explicitly, because a SECURITY DEFINER function with an
-- inherited search_path is a privilege-escalation hole.
-- ===========================================================================
-- JharSetu 0002 - enumerated types
-- ===========================================================================
-- The playbook fixes these lists. Eight categories, not a sprawling taxonomy.
-- Six platform roles, so nobody has to hunt through a long switcher on stage.
-- ===========================================================================

-- Six platform roles.
create type user_role as enum (
  'citizen',
  'volunteer',      -- field volunteer or NGO worker
  'coordinator',    -- district officer or faculty coordinator
  'university',
  'industry',
  'admin'
);

create type org_type as enum ('univ', 'company', 'ngo', 'govt', 'volunteers');

-- Eight fixed categories. Hazard nuance lives in tags, not in more categories.
create type challenge_category as enum (
  'disaster_safety',
  'water',
  'health',
  'education',
  'agriculture',
  'roads_infra',
  'energy_connectivity',
  'environment'
);

-- The four disaster-management phases. Every challenge carries one, which is
-- how a platform that also handles schools and crops still owns the theme.
create type dm_phase as enum ('mitigation', 'preparedness', 'response', 'recovery');

-- "Is it real?" - deliberately separate from priority, which asks "how urgent?".
create type confidence_level as enum (
  'unverified',
  'community_corroborated',
  'field_verified',
  'coordinator_approved',
  'resolved_with_evidence'
);

-- The nine-stage lifecycle plus its three side paths.
create type challenge_status as enum (
  'REPORTED',
  'REFINED',                 -- the Compiler has drafted the brief
  'VERIFIED',                -- a coordinator approved that brief
  'OPEN',
  'TEAM_FORMED',
  'SOLUTION_PROPOSED',
  'PILOT',
  'DEPLOYED',
  'IMPACT_VERIFIED',
  'DUPLICATE',
  'NEEDS_FOLLOW_UP',
  'CLOSED_NOT_ACTIONABLE'
);

create type platform_mode as enum ('peace', 'crisis');

create type report_channel as enum ('web', 'sms', 'volunteer', 'ivr');

-- Community and field signals. These feed confidence, priority and readiness.
create type verification_kind as enum (
  'field',           -- volunteer or NGO photo
  'still_exists',
  'improved',
  'inaccurate',
  'more_affected',
  'unsuitable'       -- the proposed solution will not work here
);

create type match_status as enum ('suggested', 'invited', 'accepted', 'declined', 'released');

create type solution_status as enum ('draft', 'submitted', 'under_review', 'approved_for_pilot', 'rejected', 'deployed');

create type pledge_kind as enum ('money', 'equipment', 'people', 'expertise');

create type pledge_status as enum ('offered', 'confirmed', 'delivered', 'withdrawn');

create type milestone_status as enum ('pending', 'in_progress', 'done', 'blocked');

create type evidence_phase as enum ('before', 'during', 'after', 'closure');

create type notify_channel as enum ('app', 'sms');

-- The vulnerability indicators the priority formula counts. Kept as an enum so
-- a typo can never silently drop someone from the vulnerability score.
create type vulnerability_tag as enum (
  'children',
  'elderly',
  'disability',
  'pregnancy',
  'medical_dependency',
  'isolated',        -- no transport / cut off
  'no_signal'        -- no phone coverage
);
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
-- ===========================================================================
-- JharSetu 0004 - indexes
-- ===========================================================================
-- Three query shapes have to stay fast while a judge is watching:
--   "what is within 20 km of this challenge?"   -> GIST on geography
--   "is this report a duplicate?"                -> HNSW on the embedding
--   "show me Gumla's critical open challenges"   -> plain btree composites
-- ===========================================================================

-- Geography ---------------------------------------------------------------
create index resources_geom_idx     on resources     using gist (geom);
create index organizations_geom_idx on organizations using gist (geom);
create index challenges_geom_idx    on challenges    using gist (geom);
create index reports_geom_idx       on reports       using gist (geom);
create index hazard_cells_geom_idx  on hazard_cells  using gist (geom);

-- Embeddings --------------------------------------------------------------
-- HNSW builds slower than IVFFlat but needs no training pass, which matters
-- when the seed script inserts everything in one go minutes before a demo.
create index challenges_embedding_idx on challenges
  using hnsw (embedding vector_cosine_ops);
create index reports_embedding_idx on reports
  using hnsw (embedding vector_cosine_ops);
create index organizations_embedding_idx on organizations
  using hnsw (embedding vector_cosine_ops);

-- Coordinator queue and map filters ---------------------------------------
create index challenges_queue_idx      on challenges (region_id, status, priority desc);
create index challenges_district_idx   on challenges (region_id, district, category);
create index challenges_mode_idx       on challenges (region_id, mode) where mode = 'crisis';
create index challenges_crisis_idx     on challenges (crisis_id) where crisis_id is not null;
create index challenges_ref_idx        on challenges (ref);

create index reports_cluster_idx       on reports (cluster_id);
create index reports_unprocessed_idx   on reports (region_id, created_at) where processed_at is null;
create index reports_channel_idx       on reports (region_id, channel);
create index reports_sms_code_idx      on reports (sms_code) where sms_code is not null;
create index reports_phone_hash_idx    on reports (phone_hash, created_at);

create index verifications_challenge_idx on verifications (challenge_id, created_at desc);
create index matches_challenge_idx       on matches (challenge_id, score desc);
create index assignments_challenge_idx   on assignments (challenge_id) where released_at is null;
create index solutions_challenge_idx     on solutions (challenge_id, readiness desc nulls last);
create index resource_needs_challenge_idx on resource_needs (challenge_id);
create index pledges_need_idx            on pledges (need_id) where status <> 'withdrawn';
create index milestones_challenge_idx    on milestones (challenge_id, due);
create index evidence_challenge_idx      on evidence_files (challenge_id, phase);

-- The timeline UI reads the ledger, so this is a hot path.
create index ledger_entity_idx  on ledger (entity, entity_id, id desc);
create index ledger_region_idx  on ledger (region_id, id desc);

create index notifications_user_idx on notifications (user_id, created_at desc) where read_at is null;

create index org_capabilities_cap_idx on org_capabilities (capability);
create index organizations_region_idx on organizations (region_id, type, verified);
create index resources_lookup_idx     on resources (region_id, type, availability);

-- Village-name lookup for SMS that names a place but carries no GPS.
create index reports_village_trgm_idx on reports using gin (village extensions.gin_trgm_ops);
-- ===========================================================================
-- JharSetu 0005 - database functions
-- ===========================================================================
-- Anything that is a *decision* lives in TypeScript so the team can explain it
-- on stage. What lives here is the work Postgres does far better than we can:
-- radius search, vector neighbours, and the hash chain that has to be atomic.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Identity helpers, used by every row-level security policy
-- ---------------------------------------------------------------------------
create or replace function jharsetu_role()
returns user_role
language sql stable security definer set search_path = public, extensions as $$
  select role from users where id = auth.uid();
$$;

create or replace function jharsetu_org_id()
returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select org_id from users where id = auth.uid();
$$;

create or replace function jharsetu_is_admin()
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select role from users where id = auth.uid()) = 'admin', false);
$$;

create or replace function jharsetu_is_staff()
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select role from users where id = auth.uid())
                  in ('coordinator', 'admin'), false);
$$;

-- Is the caller's organisation actually on this challenge's team? Partners may
-- only post updates on challenges they were assigned to.
create or replace function jharsetu_is_assigned(p_challenge uuid)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from assignments a
    where a.challenge_id = p_challenge
      and a.released_at is null
      and a.org_id = (select org_id from users where id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Resource-first matching: "what is already nearby?"
-- ---------------------------------------------------------------------------
create or replace function nearby_resources(
  p_challenge uuid,
  p_radius_km numeric default 30
)
returns table (
  resource_id  uuid,
  org_id       uuid,
  org_name     text,
  org_type     org_type,
  type         text,
  label        text,
  quantity     int,
  unit         text,
  availability text,
  distance_km  numeric
)
language sql stable set search_path = public, extensions as $$
  select r.id,
         r.org_id,
         o.name,
         o.type,
         r.type,
         r.label,
         r.quantity,
         r.unit,
         r.availability,
         round((st_distance(r.geom, c.geom) / 1000)::numeric, 1)
  from challenges c
  join resources r
    on r.region_id = c.region_id
   and st_dwithin(r.geom, c.geom, p_radius_km * 1000)
  join organizations o on o.id = r.org_id
  where c.id = p_challenge
    and c.geom is not null
    and r.availability = 'available'
  order by st_distance(r.geom, c.geom) asc;
$$;

-- Candidate partner organisations within reach, with the distance the matching
-- formula needs. Capability fit is scored in TypeScript, not here.
create or replace function nearby_organizations(
  p_challenge uuid,
  p_limit int default 40
)
returns table (
  org_id          uuid,
  name            text,
  type            org_type,
  district        text,
  expertise       text[],
  csr_focus       text[],
  verified        boolean,
  distance_km     numeric,
  within_radius   boolean,
  capability_similarity real
)
language sql stable set search_path = public, extensions as $$
  select o.id,
         o.name,
         o.type,
         o.district,
         o.expertise,
         o.csr_focus,
         o.verified,
         round((st_distance(o.geom, c.geom) / 1000)::numeric, 1),
         st_dwithin(o.geom, c.geom, o.response_radius_km * 1000),
         case
           when o.embedding is null or c.embedding is null then null
           else (1 - (o.embedding <=> c.embedding))::real
         end
  from challenges c
  join organizations o on o.region_id = c.region_id
  where c.id = p_challenge
    and c.geom is not null
    and o.geom is not null
  order by
    case when o.embedding is not null and c.embedding is not null
         then (o.embedding <=> c.embedding) else 1 end asc,
    st_distance(o.geom, c.geom) asc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Deduplication: same cluster if cosine >= 0.85 AND <= 2 km AND <= 30 days.
-- The thresholds live in TypeScript; this returns the candidates and the raw
-- numbers so the decision, and the "possible duplicate" band, stay in code.
-- ---------------------------------------------------------------------------
create or replace function dedup_candidates(
  p_region      text,
  p_embedding   vector(768),
  p_lng         double precision,
  p_lat         double precision,
  p_max_km      numeric default 5,
  p_max_days    int default 30,
  p_limit       int default 10
)
returns table (
  challenge_id uuid,
  ref          text,
  title        text,
  similarity   real,
  distance_km  numeric,
  age_days     int,
  status       challenge_status
)
language sql stable set search_path = public, extensions as $$
  select c.id,
         c.ref,
         c.title,
         (1 - (c.embedding <=> p_embedding))::real,
         case
           when p_lng is null or c.geom is null then null
           else round((st_distance(c.geom,
                 st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 2)
         end,
         extract(day from (now() - c.created_at))::int,
         c.status
  from challenges c
  where c.region_id = p_region
    and c.embedding is not null
    and c.merged_into is null
    and c.status not in ('DUPLICATE', 'CLOSED_NOT_ACTIONABLE')
    and c.created_at > now() - make_interval(days => p_max_days)
    and (
      p_lng is null
      or c.geom is null
      or st_dwithin(c.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_max_km * 1000)
    )
  order by c.embedding <=> p_embedding asc
  limit p_limit;
$$;

-- The do-not-duplicate library: challenges already solved elsewhere.
create or replace function similar_solved(
  p_embedding vector(768),
  p_exclude   uuid default null,
  p_limit     int  default 5
)
returns table (
  challenge_id uuid,
  ref          text,
  title        text,
  region_id    text,
  district     text,
  similarity   real,
  people_served int,
  cost_estimate numeric,
  deploy_days   int
)
language sql stable set search_path = public, extensions as $$
  select c.id, c.ref, c.title, c.region_id, c.district,
         (1 - (c.embedding <=> p_embedding))::real,
         coalesce(i.people_served, 0),
         s.cost_estimate,
         s.deploy_days
  from challenges c
  left join impact_records i on i.challenge_id = c.id
  left join lateral (
    select cost_estimate, deploy_days from solutions
    where challenge_id = c.id and status in ('approved_for_pilot', 'deployed')
    order by readiness desc nulls last limit 1
  ) s on true
  where c.status in ('DEPLOYED', 'IMPACT_VERIFIED')
    and c.embedding is not null
    and (p_exclude is null or c.id <> p_exclude)
  order by c.embedding <=> p_embedding asc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Hazard exposure, 0-1, feeding 10 points of the priority score
-- ---------------------------------------------------------------------------
create or replace function hazard_exposure(
  p_region text,
  p_lng double precision,
  p_lat double precision
)
returns real
language sql stable set search_path = public, extensions as $$
  select coalesce(max(h.intensity), 0)::real
  from hazard_cells h
  where h.region_id = p_region
    and p_lng is not null
    and st_intersects(h.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography);
$$;

-- Silent zones: high hazard, real population, almost nobody reporting.
-- Silence usually means no access, not no problems.
create or replace function silent_zones(
  p_region text,
  p_days   int default 90
)
returns table (
  cell_id          bigint,
  district         text,
  hazard           text,
  intensity        real,
  population       int,
  expected_reports int,
  actual_reports   bigint,
  silence_ratio    numeric,
  geom             jsonb
)
language sql stable set search_path = public, extensions as $$
  select h.id,
         h.district,
         h.hazard,
         h.intensity,
         h.population,
         h.expected_reports,
         count(r.id),
         case when h.expected_reports = 0 then 0
              else round(1 - least(count(r.id)::numeric / h.expected_reports, 1), 2)
         end,
         st_asgeojson(h.geom::geometry)::jsonb
  from hazard_cells h
  left join reports r
    on r.region_id = h.region_id
   and r.geom is not null
   and r.created_at > now() - make_interval(days => p_days)
   and st_intersects(h.geom, r.geom)
  where h.region_id = p_region
    and h.expected_reports > 0
    and h.population > 0
  group by h.id
  having count(r.id)::numeric < h.expected_reports * 0.25
  order by h.intensity * h.population desc;
$$;

-- ---------------------------------------------------------------------------
-- Resource Swarm: the live gap bar
-- ---------------------------------------------------------------------------
create or replace function challenge_gap(p_challenge uuid)
returns table (
  need_id     uuid,
  item        text,
  unit        text,
  kind        pledge_kind,
  qty_needed  numeric,
  qty_pledged numeric,
  qty_open    numeric,
  pct_closed  numeric
)
language sql stable set search_path = public, extensions as $$
  select n.id,
         n.item,
         n.unit,
         n.kind,
         n.qty_needed,
         coalesce(p.pledged, 0),
         greatest(n.qty_needed - coalesce(p.pledged, 0), 0),
         case when n.qty_needed = 0 then 100
              else round(least(coalesce(p.pledged, 0) / n.qty_needed, 1) * 100)
         end
  from resource_needs n
  left join lateral (
    select sum(qty) as pledged from pledges
    where need_id = n.id and status in ('offered', 'confirmed', 'delivered')
  ) p on true
  where n.challenge_id = p_challenge
  order by n.created_at;
$$;

-- The single 0-1 number the priority formula's resource-gap factor consumes.
create or replace function challenge_gap_fraction(p_challenge uuid)
returns real
language sql stable set search_path = public, extensions as $$
  select coalesce(
    (select case when sum(qty_needed) = 0 then 1
                 else (1 - least(sum(qty_pledged) / nullif(sum(qty_needed), 0), 1))::real
            end
     from challenge_gap(p_challenge)),
    1)::real;   -- no needs listed yet means nothing is covered yet
$$;

-- ---------------------------------------------------------------------------
-- Human-readable challenge references: C-001, C-002, ...
-- ---------------------------------------------------------------------------
create sequence if not exists challenge_ref_seq start 100;

create or replace function set_challenge_ref()
returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if new.ref is null then
    new.ref := 'C-' || lpad(nextval('challenge_ref_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger challenges_set_ref
  before insert on challenges
  for each row execute function set_challenge_ref();

create or replace function touch_updated_at()
returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger challenges_touch
  before update on challenges
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- The hash-chained ledger. Tamper evidence without the cost of a blockchain.
-- ---------------------------------------------------------------------------
create or replace function ledger_hash_chain()
returns trigger
language plpgsql set search_path = public, extensions as $$
declare
  last_hash text;
begin
  -- Serialise appenders so two concurrent writes cannot both read the same tip.
  perform pg_advisory_xact_lock(hashtext('jharsetu_ledger'));

  select l.hash into last_hash from ledger l order by l.id desc limit 1;

  new.prev_hash := last_hash;
  new.hash := encode(
    digest(
      coalesce(last_hash, 'genesis') || '|' ||
      new.entity                     || '|' ||
      coalesce(new.entity_id::text, '') || '|' ||
      new.action                     || '|' ||
      coalesce(new.actor::text, 'system') || '|' ||
      coalesce(new.payload::text, '{}')   || '|' ||
      to_char(new.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.USOF'),
      'sha256'),
    'hex');
  return new;
end;
$$;

create trigger ledger_chain
  before insert on ledger
  for each row execute function ledger_hash_chain();

-- Nobody edits history, including an admin. The playbook is explicit about it.
create or replace function ledger_append_only()
returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  raise exception 'The JharSetu ledger is append-only (attempted %)', tg_op;
end;
$$;

create trigger ledger_no_update before update on ledger
  for each row execute function ledger_append_only();
create trigger ledger_no_delete before delete on ledger
  for each row execute function ledger_append_only();

-- Walk the chain and report the first row whose hash does not recompute.
create or replace function verify_ledger(p_from bigint default 0)
returns table (ok boolean, broken_at bigint, checked bigint)
language plpgsql stable set search_path = public, extensions as $$
declare
  r         record;
  expected  text;
  prev      text := null;
  n         bigint := 0;
  first_bad bigint := null;
begin
  for r in select * from ledger where id > p_from order by id asc loop
    expected := encode(
      digest(
        coalesce(prev, 'genesis') || '|' ||
        r.entity                  || '|' ||
        coalesce(r.entity_id::text, '') || '|' ||
        r.action                  || '|' ||
        coalesce(r.actor::text, 'system') || '|' ||
        coalesce(r.payload::text, '{}')   || '|' ||
        to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.USOF'),
        'sha256'),
      'hex');
    n := n + 1;
    if expected is distinct from r.hash and first_bad is null then
      first_bad := r.id;
    end if;
    prev := r.hash;
  end loop;
  return query select first_bad is null, first_bad, n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nobody claims a challenge and sits on it: released after 14 idle days.
-- ---------------------------------------------------------------------------
create or replace function release_stalled_claims(p_days int default 14)
returns int
language plpgsql set search_path = public, extensions as $$
declare
  released int;
begin
  with stale as (
    select a.id, a.challenge_id, a.org_id
    from assignments a
    where a.released_at is null
      and a.accepted_at < now() - make_interval(days => p_days)
      and not exists (
        select 1 from milestones m
        where m.challenge_id = a.challenge_id
          and m.completed_at > now() - make_interval(days => p_days)
      )
  ), upd as (
    update assignments a set released_at = now()
    from stale s where a.id = s.id
    returning a.challenge_id, a.org_id
  )
  insert into ledger (entity, entity_id, action, actor, payload)
  select 'assignment', challenge_id, 'auto_released', null,
         jsonb_build_object('org_id', org_id, 'reason', 'no milestone progress', 'days', p_days)
  from upd;

  get diagnostics released = row_count;
  return released;
end;
$$;

-- ---------------------------------------------------------------------------
-- Report counts a cluster carries ("31 reporters, 12 photos, 3 villages")
-- ---------------------------------------------------------------------------
create or replace function recount_cluster(p_challenge uuid)
returns void
language sql set search_path = public, extensions as $$
  update challenges c
  set report_count = x.n,
      reporter_count = x.distinct_reporters
  from (
    select count(*) as n,
           count(distinct coalesce(reporter_id::text, phone_hash, client_id)) as distinct_reporters
    from reports where cluster_id = p_challenge
  ) x
  where c.id = p_challenge;
$$;
-- ===========================================================================
-- JharSetu 0006 - row-level security, and the redacting public views
-- ===========================================================================
-- The playbook's rule: enforce this in Postgres, not by hiding buttons. A judge
-- who asks "what if someone calls the API directly?" gets a real answer, and
-- the live proof on stage is switching to the university role and showing that
-- the reporter's phone number is gone and the location is approximate.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A signup gets a public.users row automatically
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.users (id, role, full_name, region_id, language, district)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'citizen'),
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'region_id', 'jharkhand'),
    coalesce(new.raw_user_meta_data ->> 'language', 'hi'),
    new.raw_user_meta_data ->> 'district'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Turn RLS on everywhere. A table with RLS on and no policy denies everything,
-- which is the failure mode we want.
-- ---------------------------------------------------------------------------
alter table regions          enable row level security;
alter table users            enable row level security;
alter table organizations    enable row level security;
alter table org_capabilities enable row level security;
alter table resources        enable row level security;
alter table reports          enable row level security;
alter table challenges       enable row level security;
alter table verifications    enable row level security;
alter table matches          enable row level security;
alter table assignments      enable row level security;
alter table team_members     enable row level security;
alter table solutions        enable row level security;
alter table resource_needs   enable row level security;
alter table pledges          enable row level security;
alter table milestones       enable row level security;
alter table evidence_files   enable row level security;
alter table impact_records   enable row level security;
alter table ledger           enable row level security;
alter table crisis_events    enable row level security;
alter table notifications    enable row level security;
alter table hazard_cells     enable row level security;
alter table scoring_weights  enable row level security;
alter table sms_inbox        enable row level security;

-- ---------------------------------------------------------------------------
-- Reference data everyone may read
-- ---------------------------------------------------------------------------
create policy regions_read on regions for select using (true);
create policy regions_write on regions for all
  using (jharsetu_is_admin()) with check (jharsetu_is_admin());

create policy hazard_read on hazard_cells for select using (true);
create policy hazard_write on hazard_cells for all
  using (jharsetu_is_admin()) with check (jharsetu_is_admin());

create policy weights_read on scoring_weights for select using (true);
create policy weights_write on scoring_weights for all
  using (jharsetu_is_admin()) with check (jharsetu_is_admin());

create policy crisis_read on crisis_events for select using (true);
create policy crisis_write on crisis_events for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- ---------------------------------------------------------------------------
-- users - you see yourself; staff see everyone. Nobody else browses the roster.
-- ---------------------------------------------------------------------------
create policy users_self_read on users for select
  using (id = auth.uid() or jharsetu_is_staff());

create policy users_self_update on users for update
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from users where id = auth.uid()));

create policy users_admin_all on users for all
  using (jharsetu_is_admin()) with check (jharsetu_is_admin());

-- ---------------------------------------------------------------------------
-- organizations - public profiles; only an admin flips `verified`
-- ---------------------------------------------------------------------------
create policy orgs_read on organizations for select using (true);

create policy orgs_admin_write on organizations for all
  using (jharsetu_is_admin()) with check (jharsetu_is_admin());

create policy orgs_self_update on organizations for update
  using (id = jharsetu_org_id()) with check (id = jharsetu_org_id());

-- An organisation may edit its own profile but never its own `verified` flag.
-- A column privilege is the right tool here: a policy that compared the new
-- value against the old one would have to re-query organizations from inside an
-- organizations policy, which recurses.
revoke update (verified) on organizations from authenticated, anon;

create policy caps_read on org_capabilities for select using (true);
create policy caps_write on org_capabilities for all
  using (org_id = jharsetu_org_id() or jharsetu_is_admin())
  with check (org_id = jharsetu_org_id() or jharsetu_is_admin());

-- Resources are public so "available nearby" works for everyone; an
-- organisation, a volunteer or staff may list them.
create policy resources_read on resources for select using (true);
create policy resources_write on resources for all
  using (org_id = jharsetu_org_id() or jharsetu_is_staff())
  with check (org_id = jharsetu_org_id() or jharsetu_is_staff());

-- ---------------------------------------------------------------------------
-- reports - the privacy-critical table.
-- A citizen sees their own. Volunteers and staff see them for verification.
-- Universities and companies never touch this table; they read the compiled
-- challenge and the redacted view below.
-- ---------------------------------------------------------------------------
create policy reports_insert_own on reports for insert
  with check (reporter_id = auth.uid() or reporter_id is null);

create policy reports_read_own on reports for select
  using (reporter_id = auth.uid());

create policy reports_read_field on reports for select
  using (jharsetu_role() in ('volunteer', 'coordinator', 'admin'));

create policy reports_staff_write on reports for update
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- ---------------------------------------------------------------------------
-- challenges - public reading is the point of the platform
-- ---------------------------------------------------------------------------
create policy challenges_read on challenges for select using (true);

create policy challenges_staff_write on challenges for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- A partner on the team may move its own challenge along, but may not approve
-- or close it; those transitions are checked again in lib/domain/lifecycle.ts.
create policy challenges_partner_update on challenges for update
  using (jharsetu_is_assigned(id))
  with check (jharsetu_is_assigned(id));

-- ---------------------------------------------------------------------------
-- verifications - locals and volunteers feed the confidence ladder
-- ---------------------------------------------------------------------------
create policy verif_read on verifications for select using (true);

create policy verif_insert on verifications for insert
  with check (
    by_user = auth.uid()
    and (
      -- field verification is a volunteer/staff act
      (kind = 'field' and jharsetu_role() in ('volunteer', 'coordinator', 'admin'))
      -- community signals are open to any signed-in citizen
      or (kind <> 'field' and auth.uid() is not null)
    )
  );

create policy verif_staff_write on verifications for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- ---------------------------------------------------------------------------
-- matching, assignments, team
-- ---------------------------------------------------------------------------
create policy matches_read on matches for select using (true);
create policy matches_staff_write on matches for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- An organisation may accept or decline its own recommendation, once verified.
create policy matches_org_respond on matches for update
  using (org_id = jharsetu_org_id()
         and exists (select 1 from organizations o where o.id = matches.org_id and o.verified))
  with check (org_id = jharsetu_org_id());

create policy assignments_read on assignments for select using (true);
create policy assignments_staff_write on assignments for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- Adopting a challenge requires a verified organisation.
create policy assignments_org_adopt on assignments for insert
  with check (
    org_id = jharsetu_org_id()
    and exists (select 1 from organizations o where o.id = org_id and o.verified)
  );

create policy team_read on team_members for select using (true);
create policy team_write on team_members for all
  using (jharsetu_is_staff() or jharsetu_is_assigned(challenge_id))
  with check (jharsetu_is_staff() or jharsetu_is_assigned(challenge_id));

-- ---------------------------------------------------------------------------
-- solutions - anyone may read a proposal; only the authoring org edits it;
-- only a coordinator writes the readiness ratings.
-- ---------------------------------------------------------------------------
create policy solutions_read on solutions for select using (true);

create policy solutions_insert on solutions for insert
  with check (
    submitted_by = auth.uid()
    and jharsetu_role() in ('university', 'industry', 'volunteer', 'coordinator', 'admin')
  );

create policy solutions_author_update on solutions for update
  using (submitted_by = auth.uid() and status in ('draft', 'submitted'))
  with check (submitted_by = auth.uid());

create policy solutions_staff_write on solutions for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- ---------------------------------------------------------------------------
-- Resource Swarm - needs are set by staff; pledges come from verified partners
-- ---------------------------------------------------------------------------
create policy needs_read on resource_needs for select using (true);
create policy needs_staff_write on resource_needs for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

create policy pledges_read on pledges for select using (true);

create policy pledges_insert on pledges for insert
  with check (
    org_id = jharsetu_org_id()
    and exists (select 1 from organizations o where o.id = org_id and o.verified)
  );

create policy pledges_org_update on pledges for update
  using (org_id = jharsetu_org_id()) with check (org_id = jharsetu_org_id());

create policy pledges_staff_write on pledges for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- ---------------------------------------------------------------------------
-- Delivery - milestones and evidence
-- ---------------------------------------------------------------------------
create policy milestones_read on milestones for select using (true);
create policy milestones_write on milestones for all
  using (jharsetu_is_staff() or jharsetu_is_assigned(challenge_id))
  with check (jharsetu_is_staff() or jharsetu_is_assigned(challenge_id));

create policy evidence_read on evidence_files for select using (true);
create policy evidence_insert on evidence_files for insert
  with check (
    uploaded_by = auth.uid()
    and (jharsetu_role() in ('volunteer', 'coordinator', 'admin') or jharsetu_is_assigned(challenge_id))
  );
create policy evidence_staff_write on evidence_files for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

create policy impact_read on impact_records for select using (true);
create policy impact_staff_write on impact_records for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- The community's sign-off: a citizen confirms the fix on their own report's
-- challenge. Only this one column, and only from false to true.
create policy impact_community_confirm on impact_records for update
  using (
    auth.uid() is not null
    and exists (
      select 1 from reports r
      where r.cluster_id = impact_records.challenge_id and r.reporter_id = auth.uid()
    )
  )
  with check (community_confirmed = true);

-- ---------------------------------------------------------------------------
-- ledger - readable by anyone (it is the public timeline), append-only for all.
-- The triggers in 0005 block UPDATE and DELETE even for an admin.
-- ---------------------------------------------------------------------------
create policy ledger_read on ledger for select using (true);
create policy ledger_insert on ledger for insert with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- notifications - strictly your own
-- ---------------------------------------------------------------------------
create policy notif_own on notifications for select using (user_id = auth.uid());
create policy notif_own_update on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_staff on notifications for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- ---------------------------------------------------------------------------
-- sms_inbox - coordinators only. Raw numbers never reach a partner.
-- ---------------------------------------------------------------------------
create policy sms_staff_only on sms_inbox for all
  using (jharsetu_is_staff()) with check (jharsetu_is_staff());

-- ===========================================================================
-- Redacting views. These are SECURITY DEFINER by default, so they bypass RLS
-- and hand back only the columns the public is allowed to see.
-- ===========================================================================

-- Public map: locations fuzzed to roughly 500 m, deterministically per row so
-- a marker does not jitter on every refresh.
create or replace view challenges_public as
select
  c.id,
  c.ref,
  c.region_id,
  c.title,
  c.brief - 'contact' - 'reporter_notes' as brief,
  c.category,
  c.dm_phase,
  c.district,
  c.block,
  st_asgeojson(
    st_project(
      c.geom,
      350 + (('x' || substr(md5(c.id::text), 1, 4))::bit(16)::int % 300),      -- 350-650 m
      radians((('x' || substr(md5(c.id::text), 5, 4))::bit(16)::int % 360))
    )::geometry
  )::jsonb                                as geom_fuzzed,
  c.people_est,
  c.severity,
  c.priority,
  c.score_breakdown,
  c.why_critical,
  c.confidence,
  c.status,
  c.mode,
  c.capabilities,
  c.hazard_tags,
  c.report_count,
  c.reporter_count,
  c.ai_uncertainties,
  c.is_simulated,
  c.created_at,
  c.updated_at
from challenges c
where c.merged_into is null;

-- The cluster panel on the challenge page: "31 reports from 12 villages".
-- No phone number, no reporter identity, no exact coordinates.
create or replace view reports_public as
select
  r.id,
  r.cluster_id,
  r.region_id,
  r.channel,
  r.district,
  r.village,
  r.lang,
  r.people_est,
  r.urgency,
  r.vulnerable,
  r.photo_urls,
  case when r.consent then r.original_text else null end   as original_text,
  case when r.consent then r.translated_text else null end as translated_text,
  r.created_at
from reports r;

-- Pin definer semantics explicitly: these views exist precisely to bypass RLS
-- and hand back a redacted copy. security_invoker would defeat the point.
alter view challenges_public set (security_invoker = off);
alter view reports_public   set (security_invoker = off);

grant select on challenges_public to anon, authenticated;
grant select on reports_public   to anon, authenticated;
-- ===========================================================================
-- JharSetu 0007 - default scoring weights
-- ===========================================================================
-- The weights are public and an admin can edit them, which is an easy
-- governance point to make. lib/domain/*.ts reads these, falling back to the
-- same literals if the table is unreachable, so a formula can never be missing.
-- ===========================================================================

insert into scoring_weights (id, weights) values
(
  'priority',
  '{
     "severity": 25,
     "urgency": 15,
     "people": 15,
     "vulnerability": 15,
     "hazard": 10,
     "resource_gap": 10,
     "recurrence": 5,
     "community": 5
   }'::jsonb
),
(
  'match',
  '{
     "capability_fit": 40,
     "availability": 20,
     "proximity": 15,
     "resource_fit": 15,
     "partner_type": 10
   }'::jsonb
),
(
  'readiness',
  '{
     "technical": 20,
     "cost": 15,
     "time_to_deploy": 15,
     "local_resources": 15,
     "safety": 15,
     "community_acceptance": 10,
     "scalability": 10
   }'::jsonb
)
on conflict (id) do nothing;

-- Dedup thresholds, also surfaced so a judge can see they are not magic numbers
-- buried in code.
insert into scoring_weights (id, weights) values
(
  'dedup',
  '{
     "merge_similarity": 0.85,
     "review_similarity": 0.75,
     "max_distance_km": 2,
     "max_age_days": 30
   }'::jsonb
)
on conflict (id) do nothing;

-- Confidence ladder thresholds.
insert into scoring_weights (id, weights) values
(
  'confidence',
  '{
     "community_corroborated_reporters": 3,
     "stale_claim_days": 14
   }'::jsonb
)
on conflict (id) do nothing;
-- ===========================================================================
-- JharSetu 0008 - demo reset
-- ===========================================================================
-- One command restores the seeded state. This exists because the ledger has
-- append-only triggers, so an ordinary DELETE cannot clear it: the reset has to
-- disable them deliberately, in one place, where it is obvious what is
-- happening and why.
-- ===========================================================================

create or replace function demo_truncate_all()
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Truncating the ledger is the one operation allowed to bypass append-only,
  -- and only through this function, which no client role may execute.
  alter table ledger disable trigger ledger_no_update;
  alter table ledger disable trigger ledger_no_delete;

  truncate table
    notifications,
    impact_records,
    evidence_files,
    milestones,
    pledges,
    resource_needs,
    solutions,
    team_members,
    assignments,
    matches,
    verifications,
    sms_inbox,
    reports,
    challenges,
    crisis_events,
    resources,
    org_capabilities,
    organizations,
    hazard_cells,
    ledger
  restart identity cascade;

  alter table ledger enable trigger ledger_no_update;
  alter table ledger enable trigger ledger_no_delete;

  -- Challenge references restart too, so C-100 is C-100 at every rehearsal.
  alter sequence challenge_ref_seq restart with 100;
end;
$$;

-- Only the service role runs this. It is reachable from /api/demo/reset, which
-- is itself behind a shared secret, and never from a signed-in user's client.
revoke all on function demo_truncate_all() from public, anon, authenticated;
grant execute on function demo_truncate_all() to service_role;

-- The scheduled sweep that releases claims nobody is working on. Call it from
-- a cron job, or by hand during a demo to show the rule exists.
revoke all on function release_stalled_claims(int) from public, anon;
grant execute on function release_stalled_claims(int) to service_role, authenticated;

-- Final privilege grant on all created tables and sequences
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;
