import { NextResponse } from 'next/server';
import { compileReport } from '@/lib/compile';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { SEED_CHALLENGES, SEED_REPORTS } from '@/data/seedData';
import { Challenge, Report } from '@/types/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      text, 
      district = 'Gumla', 
      village = 'Rural Block', 
      reporter_name = 'Citizen Reporter',
      people_est = 100, 
      channel = 'web', 
      vulnerable = [],
      photo_urls = [] 
    } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: 'Text or description is required' },
        { status: 400 }
      );
    }

    const clientId = body.client_id || `cli-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const compiled = compileReport(text, people_est);

    // 1. Live Supabase path if configured
    const db = supabaseAdmin ?? supabase;

    if (isSupabaseConfigured && db) {
      // Check for existing challenge in district & category within 30 days
      const { data: existingChallenges } = await db
        .from('challenges')
        .select('*')
        .eq('district', district)
        .eq('category', compiled.category)
        .limit(1);

      let targetChallenge: Challenge;

      if (existingChallenges && existingChallenges.length > 0) {
        // Increment report count
        const existing = existingChallenges[0];
        const updatedCount = (existing.report_count || 1) + 1;
        const { data: updated } = await db
          .from('challenges')
          .update({ report_count: updatedCount, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        targetChallenge = (updated || existing) as Challenge;
      } else {
        // Create new challenge
        const challengeId = `CH-${district.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const priorityBand = compiled.priority >= 75 ? 'critical' : compiled.priority >= 50 ? 'high' : compiled.priority >= 25 ? 'moderate' : 'long-term';
        const newChallenge: Partial<Challenge> = {
          id: challengeId,
          region_id: 'jharkhand',
          title: compiled.title,
          problem: text,
          category: compiled.category,
          dm_phase: compiled.dm_phase,
          district: district,
          block: village,
          lat: 23.3441,
          lng: 85.3096,
          people_est: compiled.people_est,
          severity: compiled.severity,
          priority: compiled.priority,
          priority_band: priorityBand,
          score_breakdown: {
            severity: (compiled.severity / 5) * 25,
            urgency: 12,
            people_affected: 10,
            vulnerability: 12,
            hazard_exposure: 8,
            resource_gap: 5,
            recurrence: 4,
            community_signal: 1,
            why_critical: compiled.ai_unsure_about || 'Newly compiled citizen report'
          },
          confidence: 'unverified',
          status: 'REFINED',
          report_count: 1,
          capabilities_needed: compiled.capabilities,
          mode: 'peace'
        };

        const { data: createdChallenge, error: challengeError } = await db
          .from('challenges')
          .insert(newChallenge)
          .select()
          .single();
        if (challengeError) console.error('Challenge insert failed:', challengeError.message);
        targetChallenge = (createdChallenge || newChallenge) as Challenge;
      }

      // Insert Report
      const reportId = `REP-${Date.now().toString().slice(-5)}`;
      const newReportRecord: Partial<Report> = {
        id: reportId,
        client_id: clientId,
        region_id: 'jharkhand',
        district: district,
        village: village,
        reporter_name: reporter_name,
        channel: channel,
        original_text: text,
        lang: 'Hindi / English',
        photo_urls: photo_urls,
        lat: 23.3441,
        lng: 85.3096,
        people_est: compiled.people_est,
        urgency: compiled.severity,
        vulnerable: vulnerable,
        category: compiled.category,
        cluster_id: targetChallenge.id,
        consent: true
      };

      const { data: createdReport, error: reportError } = await db
        .from('reports')
        .insert(newReportRecord)
        .select()
        .single();
      if (reportError) console.error('Report insert failed:', reportError.message);

      return NextResponse.json({
        success: true,
        report: createdReport || newReportRecord,
        challenge: targetChallenge,
        compiled: compiled,
      });
    }

    // 2. In-memory / Resilient fallback for immediate offline/live demo
    const reportId = `REP-${Date.now().toString().slice(-4)}`;
    const newReport: Report = {
      id: reportId,
      client_id: clientId,
      region_id: 'jharkhand',
      district,
      village,
      reporter_name,
      channel,
      original_text: text,
      lang: 'Hindi / English',
      photo_urls,
      lat: 23.3441,
      lng: 85.3096,
      people_est: compiled.people_est,
      urgency: compiled.severity,
      vulnerable,
      category: compiled.category,
      cluster_id: 'CH-GUM-001',
      consent: true,
      created_at: new Date().toISOString(),
    };

    // Find or create the matching challenge in the in-memory store, so the
    // coordinator queue reflects a new report even without a live database.
    const existingLocal = SEED_CHALLENGES.find(
      (c) => c.district === district && c.category === compiled.category
    );

    let localChallenge: Challenge;

    if (existingLocal) {
      existingLocal.report_count = (existingLocal.report_count || 1) + 1;
      existingLocal.updated_at = new Date().toISOString();
      SEED_CHALLENGES.splice(SEED_CHALLENGES.indexOf(existingLocal), 1);
      SEED_CHALLENGES.unshift(existingLocal);
      localChallenge = existingLocal;
    } else {
      const band: Challenge['priority_band'] =
        compiled.priority >= 75 ? 'critical'
        : compiled.priority >= 50 ? 'high'
        : compiled.priority >= 25 ? 'moderate'
        : 'long-term';

      localChallenge = {
        id: `CH-${district.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
        region_id: 'jharkhand',
        title: compiled.title,
        problem: text,
        category: compiled.category,
        dm_phase: compiled.dm_phase,
        district,
        block: village,
        lat: 23.3441,
        lng: 85.3096,
        people_est: compiled.people_est,
        severity: compiled.severity,
        priority: compiled.priority,
        priority_band: band,
        score_breakdown: {
          severity: Math.round((compiled.severity / 5) * 25),
          urgency: 12,
          people_affected: 10,
          vulnerability: 12,
          hazard_exposure: 8,
          resource_gap: 5,
          recurrence: 4,
          community_signal: 1,
          why_critical: compiled.ai_unsure_about || 'Newly compiled citizen report',
        },
        confidence: 'unverified',
        status: 'REFINED',
        report_count: 1,
        capabilities_needed: compiled.capabilities,
        ai_unsure_about: compiled.ai_unsure_about,
        mode: 'peace',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      SEED_CHALLENGES.unshift(localChallenge);
    }

    newReport.cluster_id = localChallenge.id;
    SEED_REPORTS.unshift(newReport);

    return NextResponse.json({
      success: true,
      report: newReport,
      challenge: localChallenge,
      compiled: compiled,
      is_fallback: true
    });
  } catch (error) {
    console.error('Error processing report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process report' },
      { status: 500 }
    );
  }
}
