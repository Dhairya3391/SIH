-- ===========================================================================
-- JharSetu 0014 - NGO parity in row-level security
-- ===========================================================================
-- 0013 added the 'ngo' user role and the routes treat NGOs as full partners
-- (adopt, propose, pledge), but 0006's solutions_insert policy still lists
-- the old five roles. Without this, an NGO proposing a solution gets a bare
-- 403 from Postgres. Assignments, evidence and milestones are already
-- role-agnostic (verified-org or assigned checks), so only this policy moves.
-- ===========================================================================

drop policy if exists solutions_insert on solutions;

create policy solutions_insert on solutions for insert
  with check (
    submitted_by = auth.uid()
    and jharsetu_role() in ('university', 'industry', 'ngo', 'volunteer', 'coordinator', 'admin')
  );
