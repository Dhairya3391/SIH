-- ===========================================================================
-- JharSetu 0011 - table privileges for the objects 0010 created
-- ===========================================================================
-- 0010 created its tables through the session pooler, whose role is not the
-- one whose ALTER DEFAULT PRIVILEGES the original bootstrap set. The result:
-- every new table existed but PostgREST answered 403 with
--   42501: permission denied for table proposal_window_policy
-- even for the service role, which is what every API route uses.
--
-- Row-level security is still the thing that decides WHO sees WHICH rows; a
-- grant only opens the table to the API at all. The policies from 0010 stay
-- in force, so this does not widen what a signed-in user can read.
-- ===========================================================================

-- Service role runs every API route and bypasses RLS by design.
grant select, insert, update, delete on
  proposals,
  proposal_windows,
  proposal_leader_history,
  proposal_window_policy,
  progress_stages,
  progress_updates,
  external_checks,
  threads,
  messages,
  sla_targets,
  challenge_timings
to service_role;

-- Signed-in users and anonymous readers get SELECT only, filtered by the
-- policies 0010 installed. Writes go through the API, never straight from a
-- browser, so no insert or update here.
grant select on
  proposal_windows,
  proposal_leader_history,
  proposal_window_policy,
  progress_stages,
  progress_updates,
  external_checks,
  sla_targets,
  challenge_timings,
  proposal_competition_public
to anon, authenticated;

-- proposals, threads and messages are readable only through their policies:
-- a college's document before the window closes, and a private message
-- thread, are not public reading.
grant select on proposals, threads, messages to authenticated;

-- Sequences, for the bigserial keys.
grant usage, select on all sequences in schema public to service_role;

-- The functions 0010 added.
grant execute on function
  severity_band_of(numeric),
  proposal_leader(uuid),
  open_proposal_window(uuid),
  refresh_proposal_leader(uuid),
  record_timing(uuid, text, timestamptz, timestamptz),
  days_since_last_update(uuid)
to service_role, authenticated, anon;

-- And make the next migration's tables inherit this, so the same 403 does not
-- happen again the next time somebody adds a table through the pooler.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
