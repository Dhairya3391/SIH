import { NextResponse } from 'next/server';
import { getChallenges } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get('region_id') || 'jharkhand';
    
    const challenges = await getChallenges(regionId);
    return NextResponse.json({
      success: true,
      count: challenges.length,
      data: challenges,
    });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
