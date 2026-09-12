import { ok, route } from "@/lib/http";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/admin/sla - actual against target, per stage and per district.
 *
 * Timings are computed here from the record rather than read from a cache,
 * because the narrator has to answer timing questions from the same numbers
 * these gauges show. A stage with no completed instances returns null, not
 * zero: "we have never done this" and "we do this in no time" are different
 * statements and the console must not conflate them.
 */
export const GET = route(async () => {
  await requireRole("admin");
  const supabase = supabaseAdmin();

  const { data: targets } = await supabase
    .from("sla_targets")
    .select("stage_key, label, target_hours")
    .order("target_hours");

  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, ref, title, district, priority, created_at, verified_at, closed_at, status");

  const { data: windows } = await supabase
    .from("proposal_windows")
    .select("challenge_id, opened_at, closed_at, state, awarded_proposal_id");

  const { data: updates } = await supabase
    .from("progress_updates")
    .select("challenge_id, created_at")
    .order("created_at");

  const { data: checks } = await supabase
    .from("external_checks")
    .select("challenge_id, checked_at")
    .order("checked_at");

  const byChallenge = new Map((challenges ?? []).map((c) => [c.id as string, c]));
  const windowBy = new Map((windows ?? []).map((w) => [w.challenge_id as string, w]));
  const firstUpdate = new Map<string, string>();
  for (const u of updates ?? []) {
    const k = u.challenge_id as string;
    if (!firstUpdate.has(k)) firstUpdate.set(k, u.created_at as string);
  }
  const firstCheck = new Map<string, string>();
  for (const c of checks ?? []) {
    const k = c.challenge_id as string;
    if (!firstCheck.has(k)) firstCheck.set(k, c.checked_at as string);
  }

  const hours = (a: string | null | undefined, b: string | null | undefined) =>
    a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000 : null;

  /** One measured interval per challenge per stage. */
  interface Sample {
    challenge_id: string;
    ref: string;
    district: string;
    hours: number;
  }
  const samples: Record<string, Sample[]> = {};
  const push = (key: string, c: Record<string, unknown>, h: number | null) => {
    if (h === null || !Number.isFinite(h) || h < 0) return;
    samples[key] = samples[key] ?? [];
    samples[key].push({
      challenge_id: c.id as string,
      ref: c.ref as string,
      district: c.district as string,
      hours: Math.round(h * 10) / 10,
    });
  };

  for (const c of challenges ?? []) {
    const id = c.id as string;
    const w = windowBy.get(id);
    push("to_corroboration", c, hours(c.created_at as string, firstCheck.get(id)));
    push("to_verification", c, hours(c.created_at as string, c.verified_at as string));
    push("to_first_proposal", c, hours(c.verified_at as string, w?.opened_at as string));
    push("to_award", c, hours(w?.opened_at as string, w?.closed_at as string));
    push("to_first_update", c, hours(w?.closed_at as string, firstUpdate.get(id)));
    push("to_closure", c, hours(w?.closed_at as string, c.closed_at as string));
  }

  const median = (xs: number[]) => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    return Math.round(s[Math.floor(s.length / 2)] * 10) / 10;
  };

  const stages = (targets ?? []).map((t) => {
    const key = t.stage_key as string;
    const xs = samples[key] ?? [];
    const target = t.target_hours as number;
    const met = xs.filter((x) => x.hours <= target).length;
    return {
      stage_key: key,
      label: t.label as string,
      target_hours: target,
      sample_size: xs.length,
      median_hours: median(xs.map((x) => x.hours)),
      worst_hours: xs.length > 0 ? Math.max(...xs.map((x) => x.hours)) : null,
      // Attainment of nothing is not 100%; it is unknown.
      attainment_pct: xs.length > 0 ? Math.round((met / xs.length) * 100) : null,
      breaches: xs
        .filter((x) => x.hours > target)
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5),
    };
  });

  // The interesting finding is usually that one district is much slower.
  const districts = new Map<string, { n: number; met: number; total: number }>();
  for (const [key, xs] of Object.entries(samples)) {
    const target = (targets ?? []).find((t) => t.stage_key === key)?.target_hours as number;
    if (!target) continue;
    for (const x of xs) {
      const d = districts.get(x.district) ?? { n: 0, met: 0, total: 0 };
      d.n += 1;
      d.total += x.hours;
      if (x.hours <= target) d.met += 1;
      districts.set(x.district, d);
    }
  }

  return ok({
    stages,
    by_district: [...districts.entries()]
      .map(([district, d]) => ({
        district,
        sample_size: d.n,
        attainment_pct: Math.round((d.met / d.n) * 100),
        mean_hours: Math.round((d.total / d.n) * 10) / 10,
      }))
      .sort((a, b) => a.attainment_pct - b.attainment_pct),
    overall: {
      sample_size: Object.values(samples).reduce((n, xs) => n + xs.length, 0),
      stages_measured: stages.filter((s) => s.sample_size > 0).length,
      stages_total: stages.length,
    },
  });
});
