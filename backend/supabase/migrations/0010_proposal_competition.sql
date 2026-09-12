-- ===========================================================================
-- JharSetu 0010 - the proposal competition, external corroboration,
--                 execution tracking, messaging and SLA
-- ===========================================================================
-- This is the schema for stages 2 through 6 of the lifecycle:
--
--   2  AI corroboration (weather / news / web) + a human verifier desk
--   3  colleges compete: first PDF opens a window, AI scores each proposal
--      independently, the highest viable score leads, displaced colleges are
--      told, the window closes and awards
--   4  companies and NGOs contribute fractions of a need, then dispatch
--   5  AI-generated progress stages, receipts, progress updates
--   6  stage timings and SLA attainment for the system owner
--
-- Money needs no new type: pledge_kind already carries 'money', so a funding
-- pledge is a pledge whose kind is money and whose qty is rupees. Recorded in
-- docs/DECISIONS.md.
--
-- Run order note: the ALTER TYPE statements come first and are committed
-- before anything uses the new values.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Enum additions
-- ---------------------------------------------------------------------------

-- A verifier is a desk role: it reviews evidence and corroboration. That is a
-- different job from 'volunteer', who goes to the village and takes the photo.
alter type user_role add value if not exists 'verifier';

-- What the AI corroboration engine can conclude on its own. Deliberately its
-- own rung, below every human one: a model that cites a page which does not
-- actually confirm the event must never be able to mint field verification.
alter type confidence_level add value if not exists 'externally_corroborated' after 'unverified';


-- ---------------------------------------------------------------------------
-- 2. New enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type external_provider as enum ('weather', 'news', 'web');
exception when duplicate_object then null; end $$;

do $$ begin
  create type external_verdict as enum ('supports', 'contradicts', 'inconclusive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_method as enum ('ai_external', 'community', 'field', 'coordinator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type proposal_state as enum (
    'submitted',            -- uploaded, waiting for the scorer
    'scoring',              -- claimed by the scoring job
    'scored',               -- has a score and a rubric
    'rejected_not_viable',  -- below the viability floor, never leads
    'withdrawn',
    'winner',
    'runner_up',
    'lapsed'                -- window closed and this was not the winner
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type proposal_verdict as enum ('viable', 'needs_changes', 'not_viable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type window_state as enum ('open', 'closed', 'awarded', 'reopened');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leader_change_reason as enum (
    'higher_score', 'leader_withdrawn', 'leader_disqualified', 'window_awarded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type severity_band as enum ('critical', 'high', 'moderate', 'long_term');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contribution_state as enum (
    'offered', 'committed', 'dispatched', 'received', 'withdrawn'
  );
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 3. External corroboration  (stage 2a)
-- ---------------------------------------------------------------------------
-- One row per provider call. The raw response is kept so a judge or an
-- auditor can see exactly what was fetched, when, and what came back - the
-- claim "the AI verified this" has to be inspectable.

create table if not exists external_checks (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references challenges(id) on delete cascade,
  provider        external_provider not null,
  query_sent      text not null,
  raw_response    jsonb,
  verdict         external_verdict not null default 'inconclusive',
  confidence      real not null default 0 check (confidence between 0 and 1),
  -- [{ url, title, publisher, published_at, snippet, supports }]
  citations       jsonb not null default '[]'::jsonb,
  reasoning       text,
  model           text,
  provider_error  text,          -- set when the provider failed, distinct from "found nothing"
  ms              int,
  checked_at      timestamptz not null default now()
);

create index if not exists external_checks_challenge_idx
  on external_checks (challenge_id, checked_at desc);


-- ---------------------------------------------------------------------------
-- 4. Verification, extended  (stage 2b)
-- ---------------------------------------------------------------------------
-- The original table held one evidence_url and no notion of HOW something was
-- verified, so an AI corroboration and a volunteer's field photo were
-- indistinguishable. They must not be.

alter table verifications add column if not exists method verification_method not null default 'community';
alter table verifications add column if not exists source_urls text[] not null default '{}';
alter table verifications add column if not exists photo_paths text[] not null default '{}';
alter table verifications add column if not exists rejected_reason text;

create index if not exists verifications_method_idx on verifications (challenge_id, method);


-- ---------------------------------------------------------------------------
-- 5. Proposals  (stage 3)
-- ---------------------------------------------------------------------------

create table if not exists proposals (
  id                 uuid primary key default gen_random_uuid(),
  challenge_id       uuid not null references challenges(id) on delete cascade,
  org_id             uuid not null references organizations(id) on delete cascade,
  author_id          uuid references users(id) on delete set null,
  version            int not null default 1,

  document_path      text,                -- private storage path, not a URL
  document_name      text,
  document_pages     int,
  extracted_text     text,

  state              proposal_state not null default 'submitted',

  -- Scored ONCE, at submission. Never recomputed on read: re-running a
  -- non-deterministic model would silently reshuffle the leaderboard and a
  -- displaced college would have a dispute nobody could answer.
  ai_score           numeric(5,2) check (ai_score is null or ai_score between 0 and 100),
  ai_verdict         proposal_verdict,
  ai_rubric          jsonb,               -- per-criterion points, reasons, page refs
  ai_model           text,
  ai_rubric_version  text,
  ai_error           text,
  scored_at          timestamptz,

  -- Extracted from the document so the college is not retyping it.
  funding_required   numeric(14,2),
  currency           text not null default 'INR',
  duration_days      int,

  submitted_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),

  unique (challenge_id, org_id, version)
);

create index if not exists proposals_challenge_idx on proposals (challenge_id, state);
create index if not exists proposals_org_idx on proposals (org_id, submitted_at desc);
-- The leaderboard query: viable, scored, best first, earliest wins a tie.
create index if not exists proposals_leaderboard_idx
  on proposals (challenge_id, ai_score desc, submitted_at asc)
  where state = 'scored' and ai_verdict = 'viable';


-- ---------------------------------------------------------------------------
-- 6. The proposal window  (stage 3b)
-- ---------------------------------------------------------------------------
-- Opens on the FIRST accepted proposal, not when the challenge is verified.
-- Length comes from severity: a problem the platform itself calls "immediate
-- threat to life" cannot sit open for ten days waiting for a better PDF.

create table if not exists proposal_window_policy (
  band          severity_band primary key,
  window_days   int not null check (window_days > 0),
  note          text
);

insert into proposal_window_policy (band, window_days, note) values
  ('critical',   2, 'Immediate threat to life. Two days, then award the best we have.'),
  ('high',       5, 'Serious harm. Five days.'),
  ('moderate',  10, 'Ten days, the default.'),
  ('long_term', 14, 'Planning-horizon problems can wait for a better proposal.')
on conflict (band) do nothing;

create table if not exists proposal_windows (
  challenge_id         uuid primary key references challenges(id) on delete cascade,
  opened_at            timestamptz not null default now(),
  window_days          int not null,        -- frozen at open; a later severity change does not move the deadline
  closes_at            timestamptz not null,
  state                window_state not null default 'open',
  leader_proposal_id   uuid references proposals(id) on delete set null,
  leader_score         numeric(5,2),
  leader_changed_at    timestamptz,
  awarded_proposal_id  uuid references proposals(id) on delete set null,
  closed_at            timestamptz,
  reopen_count         int not null default 0
);

create index if not exists proposal_windows_due_idx
  on proposal_windows (closes_at) where state = 'open';

-- Every lead change, kept for audit and for answering a displaced college.
create table if not exists proposal_leader_history (
  id                uuid primary key default gen_random_uuid(),
  challenge_id      uuid not null references challenges(id) on delete cascade,
  from_proposal_id  uuid references proposals(id) on delete set null,
  to_proposal_id    uuid references proposals(id) on delete set null,
  from_score        numeric(5,2),
  to_score          numeric(5,2),
  reason            leader_change_reason not null,
  changed_at        timestamptz not null default now()
);

create index if not exists leader_history_challenge_idx
  on proposal_leader_history (challenge_id, changed_at desc);


-- ---------------------------------------------------------------------------
-- 7. Execution: progress stages and updates  (stage 5)
-- ---------------------------------------------------------------------------
-- Generated by the model from the winning document, then edited and locked by
-- the college. Named after what the proposal actually does - never a generic
-- 25 / 50 / 75.

create table if not exists progress_stages (
  id                  uuid primary key default gen_random_uuid(),
  proposal_id         uuid not null references proposals(id) on delete cascade,
  challenge_id        uuid not null references challenges(id) on delete cascade,
  seq                 int not null,
  title               text not null,
  definition_of_done  text,
  expected_days       int,
  status              milestone_status not null default 'pending',
  -- A stage can be blocked on a contribution that has not arrived, which is
  -- what connects stage 4 to stage 5.
  blocked_on_need_id  uuid references resource_needs(id) on delete set null,
  started_at          timestamptz,
  completed_at        timestamptz,
  expected_start      timestamptz,
  expected_end        timestamptz,
  ai_generated        boolean not null default true,
  locked_at           timestamptz,
  version             int not null default 1,
  created_at          timestamptz not null default now(),
  unique (proposal_id, seq, version)
);

create index if not exists progress_stages_challenge_idx on progress_stages (challenge_id, seq);

create table if not exists progress_updates (
  id            uuid primary key default gen_random_uuid(),
  stage_id      uuid not null references progress_stages(id) on delete cascade,
  challenge_id  uuid not null references challenges(id) on delete cascade,
  author_id     uuid references users(id) on delete set null,
  note          text not null,
  photo_paths   text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- The admin console measures the GAPS between these rows, so the index is on time.
create index if not exists progress_updates_challenge_idx
  on progress_updates (challenge_id, created_at desc);


-- ---------------------------------------------------------------------------
-- 8. Contributions: the delivery lifecycle  (stage 4)
-- ---------------------------------------------------------------------------
-- pledges already carries qty and org_id, which is what makes 5 kg + 7 kg
-- work. What it lacked was everything after the offer.

alter table pledges add column if not exists state contribution_state not null default 'offered';
alter table pledges add column if not exists expected_delivery_date date;
alter table pledges add column if not exists dispatched_at timestamptz;
alter table pledges add column if not exists received_at timestamptz;
alter table pledges add column if not exists received_by uuid references users(id) on delete set null;
alter table pledges add column if not exists receipt_note text;

create index if not exists pledges_state_idx on pledges (state, created_at desc);
create index if not exists pledges_org_idx on pledges (org_id, created_at desc);


-- ---------------------------------------------------------------------------
-- 9. Messaging: college <-> contributor  (stage 4)
-- ---------------------------------------------------------------------------

create table if not exists threads (
  id                   uuid primary key default gen_random_uuid(),
  challenge_id         uuid not null references challenges(id) on delete cascade,
  college_org_id       uuid not null references organizations(id) on delete cascade,
  contributor_org_id   uuid not null references organizations(id) on delete cascade,
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz,
  unique (challenge_id, college_org_id, contributor_org_id)
);

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references threads(id) on delete cascade,
  author_id   uuid references users(id) on delete set null,
  author_org_id uuid references organizations(id) on delete set null,
  body        text not null check (length(body) between 1 and 4000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create index if not exists messages_thread_idx on messages (thread_id, created_at);


-- ---------------------------------------------------------------------------
-- 10. Stage timings and SLA  (stage 6)
-- ---------------------------------------------------------------------------
-- Computed and stored rather than derived in the UI, because the narrator has
-- to answer timing questions from the same numbers the gauges show.

create table if not exists sla_targets (
  stage_key     text primary key,
  label         text not null,
  target_hours  int not null check (target_hours > 0)
);

insert into sla_targets (stage_key, label, target_hours) values
  ('to_corroboration',  'Report to AI corroboration',        1),
  ('to_verification',   'Report to human verification',     48),
  ('to_first_proposal', 'Verified to first proposal',       72),
  ('to_award',          'Window open to award',            240),
  ('to_requirements',   'Award to requirements published',  48),
  ('to_fully_funded',   'Requirements to fully funded',    336),
  ('to_first_update',   'Funded to first progress update', 168),
  ('to_closure',        'Award to closure',               2160)
on conflict (stage_key) do nothing;

create table if not exists challenge_timings (
  challenge_id  uuid not null references challenges(id) on delete cascade,
  stage_key     text not null references sla_targets(stage_key),
  started_at    timestamptz not null,
  ended_at      timestamptz,
  hours         numeric(10,2),
  met_sla       boolean,
  primary key (challenge_id, stage_key)
);

create index if not exists challenge_timings_stage_idx on challenge_timings (stage_key, met_sla);


-- ---------------------------------------------------------------------------
-- 11. Functions
-- ---------------------------------------------------------------------------

-- Severity band from the priority score, matching the bands the UI already
-- shows on its chips.
create or replace function severity_band_of(p_priority numeric)
returns severity_band
language sql immutable as $$
  select case
    when p_priority >= 75 then 'critical'::severity_band
    when p_priority >= 55 then 'high'::severity_band
    when p_priority >= 35 then 'moderate'::severity_band
    else 'long_term'::severity_band
  end;
$$;

-- The leaderboard, deterministic. Highest viable score; a tie goes to the
-- earlier submission; a remaining tie goes to the lower id. Without the last
-- two rules the leader is non-reproducible and a dispute is unanswerable.
create or replace function proposal_leader(p_challenge uuid)
returns uuid
language sql stable set search_path = public as $$
  select id from proposals
   where challenge_id = p_challenge
     and state in ('scored', 'winner', 'runner_up')
     and ai_verdict = 'viable'
   order by ai_score desc, submitted_at asc, id asc
   limit 1;
$$;

-- Opens the window on first submission, or returns the existing one.
-- window_days is frozen here on purpose.
create or replace function open_proposal_window(p_challenge uuid)
returns proposal_windows
language plpgsql set search_path = public as $$
declare
  w proposal_windows;
  days int;
  pri numeric;
begin
  select * into w from proposal_windows where challenge_id = p_challenge;
  if found then
    return w;
  end if;

  select priority into pri from challenges where id = p_challenge;
  select window_days into days
    from proposal_window_policy
   where band = severity_band_of(coalesce(pri, 40));

  insert into proposal_windows (challenge_id, window_days, closes_at)
  values (p_challenge, days, now() + make_interval(days => days))
  returning * into w;

  return w;
end;
$$;

-- Recomputes the leader and records a change. Returns true when the leader moved,
-- so the caller knows to notify the displaced college.
create or replace function refresh_proposal_leader(p_challenge uuid)
returns boolean
language plpgsql set search_path = public as $$
declare
  new_leader uuid;
  new_score  numeric(5,2);
  old_leader uuid;
  old_score  numeric(5,2);
begin
  select leader_proposal_id, leader_score into old_leader, old_score
    from proposal_windows where challenge_id = p_challenge for update;

  new_leader := proposal_leader(p_challenge);
  if new_leader is null then
    return false;
  end if;
  select ai_score into new_score from proposals where id = new_leader;

  if old_leader is distinct from new_leader then
    update proposal_windows
       set leader_proposal_id = new_leader,
           leader_score = new_score,
           leader_changed_at = now()
     where challenge_id = p_challenge;

    insert into proposal_leader_history
      (challenge_id, from_proposal_id, to_proposal_id, from_score, to_score, reason)
    values (p_challenge, old_leader, new_leader, old_score, new_score, 'higher_score');

    return true;
  end if;

  -- Same leader, but its score may have changed on a resubmission.
  update proposal_windows set leader_score = new_score where challenge_id = p_challenge;
  return false;
end;
$$;

-- Records one interval against an SLA target, idempotently.
create or replace function record_timing(
  p_challenge uuid, p_stage text, p_started timestamptz, p_ended timestamptz
) returns void
language plpgsql set search_path = public as $$
declare
  hrs numeric(10,2);
  tgt int;
begin
  if p_started is null or p_ended is null then return; end if;
  hrs := extract(epoch from (p_ended - p_started)) / 3600.0;
  select target_hours into tgt from sla_targets where stage_key = p_stage;
  if tgt is null then return; end if;

  insert into challenge_timings (challenge_id, stage_key, started_at, ended_at, hours, met_sla)
  values (p_challenge, p_stage, p_started, p_ended, hrs, hrs <= tgt)
  on conflict (challenge_id, stage_key) do update
    set started_at = excluded.started_at,
        ended_at   = excluded.ended_at,
        hours      = excluded.hours,
        met_sla    = excluded.met_sla;
end;
$$;

-- Days since the last progress update, for the quiet-projects signal.
create or replace function days_since_last_update(p_challenge uuid)
returns numeric
language sql stable set search_path = public as $$
  select coalesce(
    extract(epoch from (now() - max(created_at))) / 86400.0,
    null)
  from progress_updates where challenge_id = p_challenge;
$$;


-- ---------------------------------------------------------------------------
-- 12. Row-level security
-- ---------------------------------------------------------------------------
-- Service role bypasses all of this; these rules are for anon and signed-in
-- users reading through PostgREST. The API routes are the main enforcement
-- point, but a table with RLS off and no policy is a table anyone can read.

alter table external_checks         enable row level security;
alter table proposals               enable row level security;
alter table proposal_windows        enable row level security;
alter table proposal_leader_history enable row level security;
alter table proposal_window_policy  enable row level security;
alter table progress_stages         enable row level security;
alter table progress_updates        enable row level security;
alter table threads                 enable row level security;
alter table messages                enable row level security;
alter table sla_targets             enable row level security;
alter table challenge_timings       enable row level security;

-- Corroboration, windows, leader history, stages, updates and timings are
-- public reading: the whole point is that anyone can audit the chain.
do $$ begin
  create policy "public read" on external_checks for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read" on proposal_windows for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read" on proposal_leader_history for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read" on proposal_window_policy for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read" on progress_stages for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read" on progress_updates for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read" on sla_targets for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read" on challenge_timings for select using (true);
exception when duplicate_object then null; end $$;

-- A proposal DOCUMENT is a college's own work. Before the window closes,
-- nobody outside that college may read the row - otherwise a competitor
-- copies the approach, or lobbies against it.
do $$ begin
  create policy "own college or awarded" on proposals for select using (
    jharsetu_is_admin()
    or jharsetu_is_staff()
    or org_id = jharsetu_org_id()
    or state in ('winner', 'runner_up')
  );
exception when duplicate_object then null; end $$;

-- Threads and messages: participants and admin only.
do $$ begin
  create policy "participants only" on threads for select using (
    jharsetu_is_admin()
    or college_org_id = jharsetu_org_id()
    or contributor_org_id = jharsetu_org_id()
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "participants only" on messages for select using (
    jharsetu_is_admin()
    or exists (
      select 1 from threads t
       where t.id = messages.thread_id
         and (t.college_org_id = jharsetu_org_id()
              or t.contributor_org_id = jharsetu_org_id())
    )
  );
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 13. Redacting public view for proposals
-- ---------------------------------------------------------------------------
-- What a competing college is allowed to see while the window is open: the
-- leading SCORE, never the leading document and never the leading college.
-- Showing the number motivates a better proposal; showing the rest invites
-- copying and off-platform pressure.

create or replace view proposal_competition_public as
select w.challenge_id,
       w.state,
       w.opened_at,
       w.closes_at,
       w.window_days,
       w.leader_score,
       w.leader_changed_at,
       w.reopen_count,
       (select count(*) from proposals p
         where p.challenge_id = w.challenge_id
           and p.state in ('scored', 'winner', 'runner_up', 'lapsed')) as proposal_count
  from proposal_windows w;

grant select on proposal_competition_public to anon, authenticated;
