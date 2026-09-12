-- ---------------------------------------------------------------------------
-- 0009 - challenge_gap_fraction returned 0 where it meant 1
-- ---------------------------------------------------------------------------
-- The original guard was:
--
--   case when sum(qty_needed) = 0 then 1
--        else (1 - least(sum(qty_pledged) / nullif(sum(qty_needed), 0), 1))
--   end
--
-- With no needs listed, sum() is NULL, so `sum(qty_needed) = 0` is NULL rather
-- than true and the ELSE branch runs. There, Postgres `least()` IGNORES NULL
-- arguments, so `least(NULL, 1)` is 1 and the whole expression collapses to
-- `1 - 1 = 0`. The outer coalesce(.., 1) never sees a NULL and never fires.
--
-- The effect: every challenge with no resource_needs rows scored 0 out of 10 on
-- resource gap - the exact opposite of "nothing is pledged, so the gap is
-- total". That suppressed exactly the brand-new critical reports the platform
-- exists to surface.
--
-- Guard on NULL explicitly. Verified against the live data: challenges with no
-- needs now return 1, and a challenge with 8 of 12 units pledged returns 0.33.
create or replace function challenge_gap_fraction(p_challenge uuid)
returns real
language sql stable set search_path = public, extensions as $$
  select coalesce(
    (select case
              when coalesce(sum(qty_needed), 0) = 0 then 1::real
              else (1 - least(coalesce(sum(qty_pledged), 0) / sum(qty_needed), 1))::real
            end
     from challenge_gap(p_challenge)),
    1)::real;   -- no needs listed yet means nothing is covered yet
$$;

-- lib/services/scoring.ts no longer depends on this function: it reads
-- challenge_gap() and sums in code, so the scorer is correct whether or not
-- this migration has been applied. This keeps the SQL honest for anything else
-- that calls it.
