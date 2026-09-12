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
