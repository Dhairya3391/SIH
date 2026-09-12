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
