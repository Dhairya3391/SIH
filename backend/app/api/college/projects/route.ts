import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listCollegeProjects } from "@/lib/services/projects";
import { opportunisticTick } from "@/lib/services/tick";

/**
 * GET /api/college/projects - the problems this college won.
 *
 * Each one with whether its requirements are published, how much is pledged,
 * what is waiting for the college to confirm, how many stages are done, and
 * how long since the last progress update. Staff see every college's.
 */
export const GET = route(async () => {
  const actor = await requireRole("university", "coordinator", "admin");
  const supabase = supabaseAdmin();
  // An award that is due should appear here without waiting for the daily cron.
  await opportunisticTick(supabase);

  const projects = await listCollegeProjects(supabase, actor.orgId, actor.role !== "university");
  projects.sort((a, b) => {
    const order = (s: string) => (s === "SOLUTION_PROPOSED" ? 0 : s === "PILOT" ? 1 : 2);
    return order(a.status) - order(b.status) || b.priority - a.priority;
  });
  return ok({ projects, count: projects.length });
});
