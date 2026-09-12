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
