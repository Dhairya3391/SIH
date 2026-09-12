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
