import { createClient } from '@supabase/supabase-js';
import { 
  SEED_CHALLENGES, 
  SEED_REPORTS, 
  SEED_ORGANIZATIONS, 
  SEED_REGIONS, 
  SEED_RESOURCES 
} from '@/data/seedData';
import { Challenge, Report, Organization, Region, ResourceItem } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

/**
 * Server-only client. Writes from the intake route use this: the anon key is
 * subject to row-level security, so inserts were being refused and silently
 * dropped. Never import this into a client component.
 */
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin =
  isSupabaseConfigured && serviceRoleKey
    ? createClient(supabaseUrl!, serviceRoleKey, { auth: { persistSession: false } })
    : null;

// Fallback / Resilient Data Layer
export async function getRegions(): Promise<Region[]> {
  if (isSupabaseConfigured && (supabaseAdmin ?? supabase)) {
    try {
      const { data, error } = await (supabaseAdmin ?? supabase)!.from('regions').select('*');
      if (error) console.error('[supabase] read error:', error.message);
      if (!error && data && data.length > 0) return data as Region[];
    } catch (e) {
      console.warn('Falling back to local regions data', e);
    }
  }
  return SEED_REGIONS;
}

export async function getChallenges(regionId: string = 'jharkhand'): Promise<Challenge[]> {
  if (isSupabaseConfigured && (supabaseAdmin ?? supabase)) {
    try {
      const { data, error } = await (supabaseAdmin ?? supabase)!
        .from('challenges')
        .select('*')
        .eq('region_id', regionId)
        .order('priority', { ascending: false });
      if (error) console.error('[supabase] read error:', error.message);
      if (!error && data && data.length > 0) return data as Challenge[];
    } catch (e) {
      console.warn('Falling back to local challenge data', e);
    }
  }
  return SEED_CHALLENGES.filter(c => c.region_id === regionId);
}

export async function getChallengeById(id: string): Promise<Challenge | null> {
  if (isSupabaseConfigured && (supabaseAdmin ?? supabase)) {
    try {
      const { data, error } = await (supabaseAdmin ?? supabase)!
        .from('challenges')
        .select('*')
        .eq('id', id)
        .single();
      if (error) console.error('[supabase] read error:', error.message);
      if (!error && data) return data as Challenge;
    } catch (e) {
      console.warn('Falling back to local challenge item', e);
    }
  }
  return SEED_CHALLENGES.find(c => c.id === id) || null;
}

export async function getReports(challengeId?: string): Promise<Report[]> {
  if (isSupabaseConfigured && (supabaseAdmin ?? supabase)) {
    try {
      let query = (supabaseAdmin ?? supabase)!.from("reports").select("*");
      if (challengeId) {
        query = query.eq('cluster_id', challengeId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) console.error('[supabase] read error:', error.message);
      if (!error && data && data.length > 0) return data as Report[];
    } catch (e) {
      console.warn('Falling back to local reports data', e);
    }
  }
  return challengeId 
    ? SEED_REPORTS.filter(r => r.cluster_id === challengeId)
    : SEED_REPORTS;
}

export async function getOrganizations(regionId: string = 'jharkhand'): Promise<Organization[]> {
  if (isSupabaseConfigured && (supabaseAdmin ?? supabase)) {
    try {
      const { data, error } = await (supabaseAdmin ?? supabase)!
        .from('organizations')
        .select('*')
        .eq('region_id', regionId);
      if (error) console.error('[supabase] read error:', error.message);
      if (!error && data && data.length > 0) return data as Organization[];
    } catch (e) {
      console.warn('Falling back to local organizations data', e);
    }
  }
  return SEED_ORGANIZATIONS.filter(o => o.region_id === regionId);
}

export async function getResources(): Promise<ResourceItem[]> {
  if (isSupabaseConfigured && (supabaseAdmin ?? supabase)) {
    try {
      const { data, error } = await (supabaseAdmin ?? supabase)!.from('resources').select('*');
      if (error) console.error('[supabase] read error:', error.message);
      if (!error && data && data.length > 0) return data as ResourceItem[];
    } catch (e) {
      console.warn('Falling back to local resources data', e);
    }
  }
  return SEED_RESOURCES;
}
