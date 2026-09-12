-- ===========================================================================
-- JharSetu 0012 - the competition view needs the service role too
-- ===========================================================================
-- 0011 granted proposal_competition_public to anon and authenticated but not
-- to service_role, which is the role every API route actually uses. The
-- college console reads this view to show the window state and the leading
-- score, so it answered 403 for the one caller that matters.
-- ===========================================================================

grant select on proposal_competition_public to service_role;
