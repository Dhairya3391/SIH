import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The college on the other end of a conversation about a challenge.
 *
 * After an award that is the winning proposal's college. Before one, a
 * university that adopted the challenge through the older assignment flow can
 * still be talked to. Anything else has nobody to answer, and says so.
 */
export async function collegeForChallenge(
  supabase: SupabaseClient,
  challengeId: string,
): Promise<string | null> {
  const { data: winner } = await supabase
    .from("proposals")
    .select("org_id")
    .eq("challenge_id", challengeId)
    .eq("state", "winner")
    .limit(1)
    .maybeSingle();
  if (winner?.org_id) return winner.org_id as string;

  const { data: assigned } = await supabase
    .from("assignments")
    .select("org_id, organizations!inner(type)")
    .eq("challenge_id", challengeId)
    .eq("organizations.type", "univ")
    .is("released_at", null)
    .limit(1);
  return (assigned?.[0]?.org_id as string) ?? null;
}

/**
 * Opens the one thread between a college and a contributor about a challenge,
 * or returns it. Idempotent, so "message the college" clicked twice - or a
 * pledge that opens the thread automatically - never makes two conversations.
 */
export async function ensureThread(
  supabase: SupabaseClient,
  input: { challengeId: string; collegeOrgId: string; contributorOrgId: string },
): Promise<{ id: string; created: boolean }> {
  const find = () =>
    supabase
      .from("threads")
      .select("id")
      .eq("challenge_id", input.challengeId)
      .eq("college_org_id", input.collegeOrgId)
      .eq("contributor_org_id", input.contributorOrgId)
      .maybeSingle();

  const { data: existing } = await find();
  if (existing) return { id: existing.id as string, created: false };

  const { data, error } = await supabase
    .from("threads")
    .insert({
      challenge_id: input.challengeId,
      college_org_id: input.collegeOrgId,
      contributor_org_id: input.contributorOrgId,
    })
    .select("id")
    .single();
  if (error) {
    // Two requests at once: the unique constraint caught the second insert.
    if (error.code === "23505") {
      const { data: again } = await find();
      if (again) return { id: again.id as string, created: false };
    }
    throw error;
  }
  return { id: data.id as string, created: true };
}
