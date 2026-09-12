import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { 
  SEED_REGIONS, 
  SEED_ORGANIZATIONS, 
  SEED_RESOURCES, 
  SEED_CHALLENGES, 
  SEED_REPORTS 
} from '../supabase/seed/seed_data';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function runSeed() {
  console.log('--- JharSetu Seed Pipeline ---');
  console.log(`Checking Supabase connection: ${supabaseUrl ? 'URL Present' : 'No URL'}`);

  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️  No Supabase credentials found in .env.local.');
    console.log('ℹ️  The app is configured to seamlessly use the rich in-memory seed dataset (10 challenges, 25 reports) on local and production Vercel builds.');
    console.log('👉  To seed a live Supabase PostgreSQL database:');
    console.log('    1. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local');
    console.log('    2. Execute supabase/schema.sql in your Supabase SQL Editor');
    console.log('    3. Run `npm run seed` again.');
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Seeding Regions...');
  for (const region of SEED_REGIONS) {
    const { error } = await supabase.from('regions').upsert({
      id: region.id,
      name: region.name,
      state: region.state,
      center_lat: region.center[0],
      center_lng: region.center[1],
      zoom: region.zoom,
      languages: region.languages,
      total_districts: region.total_districts,
    });
    if (error) console.error(`Error seeding region ${region.id}:`, error.message);
  }

  console.log('Seeding Organizations...');
  for (const org of SEED_ORGANIZATIONS) {
    const { error } = await supabase.from('organizations').upsert({
      id: org.id,
      region_id: org.region_id,
      type: org.type,
      name: org.name,
      district: org.district,
      lat: org.lat,
      lng: org.lng,
      response_radius_km: org.response_radius_km,
      csr_focus: org.csr_focus || [],
      csr_budget: org.csr_budget || 0,
      verified: org.verified,
      capabilities: org.capabilities,
    });
    if (error) console.error(`Error seeding org ${org.id}:`, error.message);
  }

  console.log('Seeding Resources...');
  for (const res of SEED_RESOURCES) {
    const { error } = await supabase.from('resources').upsert({
      id: res.id,
      org_id: res.org_id,
      type: res.type,
      quantity: res.quantity,
      unit: res.unit,
      lat: res.lat,
      lng: res.lng,
      availability: res.availability,
    });
    if (error) console.error(`Error seeding resource ${res.id}:`, error.message);
  }

  console.log('Seeding Challenges (10 realistic cases across Gumla, Sahebganj, Dhanbad, Palamu, Ranchi)...');
  for (const c of SEED_CHALLENGES) {
    const { error } = await supabase.from('challenges').upsert({
      id: c.id,
      region_id: c.region_id,
      title: c.title,
      problem: c.problem,
      category: c.category,
      dm_phase: c.dm_phase,
      district: c.district,
      block: c.block,
      lat: c.lat,
      lng: c.lng,
      people_est: c.people_est,
      severity: c.severity,
      priority: c.priority,
      priority_band: c.priority_band,
      score_breakdown: c.score_breakdown,
      confidence: c.confidence,
      status: c.status,
      report_count: c.report_count,
      capabilities_needed: c.capabilities_needed,
      available_nearby: c.available_nearby || [],
      suggested_partners: c.suggested_partners || [],
      ai_unsure_about: c.ai_unsure_about,
      outcome: c.outcome,
      success_metric: c.success_metric,
      mode: c.mode,
      crisis_id: c.crisis_id,
      created_at: c.created_at,
      updated_at: c.updated_at,
    });
    if (error) console.error(`Error seeding challenge ${c.id}:`, error.message);
  }

  console.log('Seeding Reports (25 linked reports across web, sms, volunteer)...');
  for (const r of SEED_REPORTS) {
    const { error } = await supabase.from('reports').upsert({
      id: r.id,
      client_id: r.client_id,
      region_id: r.region_id,
      district: r.district,
      village: r.village,
      reporter_name: r.reporter_name,
      channel: r.channel,
      phone_hash: r.phone_hash,
      original_text: r.original_text,
      lang: r.lang,
      photo_urls: r.photo_urls,
      lat: r.lat,
      lng: r.lng,
      people_est: r.people_est,
      urgency: r.urgency,
      vulnerable: r.vulnerable,
      translated_text: r.translated_text,
      category: r.category,
      cluster_id: r.cluster_id,
      consent: r.consent,
      created_at: r.created_at,
    });
    if (error) console.error(`Error seeding report ${r.id}:`, error.message);
  }

  console.log('✅ Seeding completed successfully!');
}

runSeed().catch(console.error);
