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
