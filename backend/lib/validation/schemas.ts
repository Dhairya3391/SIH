import { z } from "zod";
import {
  CATEGORIES,
  CHALLENGE_STATUSES,
  DM_PHASES,
  PLEDGE_KINDS,
  VULNERABILITY_TAGS,
} from "@/lib/domain/types";

/**
 * Every request body is validated here before it reaches a service. Uploads are
 * checked for type and size, coordinates are checked for range, and free text
 * is bounded, because "zod validation, upload type and size limits, rate
 * limiting" is a line on the H18-H20 security pass.
 */

const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);

export const vulnerabilityTag = z.enum(VULNERABILITY_TAGS);
export const category = z.enum(CATEGORIES);
export const dmPhase = z.enum(DM_PHASES);
export const challengeStatus = z.enum(CHALLENGE_STATUSES);
export const pledgeKind = z.enum(PLEDGE_KINDS);

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export const submitReportSchema = z.object({
  /**
   * Generated on the phone. The server ignores repeats of the same value, so a
   * report retried five times from an offline queue appears once.
   */
  client_id: z.string().min(8).max(64),
  region_id: z.string().min(2).max(40).default("jharkhand"),
  text: z.string().max(4000).optional(),
  lang: z.string().max(8).default("hi"),
  /** Storage paths, uploaded separately so text and location arrive first. */
  audio_url: z.string().max(500).optional(),
  photo_urls: z.array(z.string().max(500)).max(6).default([]),
  lat: lat.nullish(),
  lng: lng.nullish(),
  location_source: z.enum(["gps", "village_picker", "sms", "none"]).default("none"),
  district: z.string().max(80).nullish(),
  village: z.string().max(120).nullish(),
  people_est: z.coerce.number().int().min(0).max(1_000_000).nullish(),
  urgency: z.coerce.number().int().min(1).max(5).nullish(),
  vulnerable: z.array(vulnerabilityTag).max(7).default([]),
  consent: z.boolean().default(false),
  /** Set when the full report is catching up with an SMS already received. */
  sms_code: z.string().length(4).optional(),
  /** The phone recorded this while offline; the server keeps the original time. */
  captured_at: z.string().datetime().optional(),
});
export type SubmitReportInput = z.infer<typeof submitReportSchema>;

export const smsInboundSchema = z.object({
  from: z.string().min(4).max(24),
  text: z.string().min(1).max(1600),
  received_at: z.string().datetime().optional(),
  /** Shared secret, so the endpoint is not an open door for anyone to post to. */
  secret: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Coordinator actions
// ---------------------------------------------------------------------------

export const approveBriefSchema = z.object({
  /** A coordinator may correct the model's severity before approving. */
  severity: z.coerce.number().int().min(1).max(5).optional(),
  title: z.string().min(6).max(200).optional(),
  category: category.optional(),
  dm_phase: dmPhase.optional(),
  note: z.string().max(1000).optional(),
});

export const validateSchema = z.object({
  kind: z.enum(["field", "still_exists", "improved", "inaccurate", "more_affected", "unsuitable"]),
  evidence_url: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
});

export const transitionSchema = z.object({
  to: challengeStatus,
  reason: z.string().max(1000).optional(),
});

export const closeNotActionableSchema = z.object({
  /** Long enough to be a real explanation: the reporter is told why. */
  reason: z.string().min(10).max(1000),
});

// ---------------------------------------------------------------------------
// Matching and the team
// ---------------------------------------------------------------------------

export const adoptSchema = z.object({
  org_id: z.string().uuid(),
  role: z.enum(["builder", "funder", "deliverer", "mentor"]).default("builder"),
});

export const nearbyQuerySchema = z.object({
  radius_km: z.coerce.number().min(1).max(200).default(30),
});

export const matchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  refresh: z.coerce.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Proposals and readiness
// ---------------------------------------------------------------------------

export const solutionSchema = z.object({
  org_id: z.string().uuid().nullish(),
  title: z.string().min(6).max(200),
  approach: z.string().min(20).max(6000),
  cost_estimate: z.coerce.number().min(0).max(1_000_000_000).nullish(),
  deploy_days: z.coerce.number().int().min(1).max(3650).nullish(),
  risks: z.string().max(3000).nullish(),
});

export const reviewSchema = z.object({
  ratings: z.object({
    technical: z.coerce.number().int().min(1).max(5),
    cost: z.coerce.number().int().min(1).max(5),
    time_to_deploy: z.coerce.number().int().min(1).max(5),
    local_resources: z.coerce.number().int().min(1).max(5),
    safety: z.coerce.number().int().min(1).max(5),
    community_acceptance: z.coerce.number().int().min(1).max(5),
    scalability: z.coerce.number().int().min(1).max(5),
  }),
  notes: z.string().max(2000).optional(),
});

export const approvePilotSchema = z.object({
  needs: z
    .array(
      z.object({
        item: z.string().min(2).max(200),
        qty_needed: z.coerce.number().min(0.01).max(1_000_000),
        unit: z.string().max(30).default("unit"),
        kind: pledgeKind.default("equipment"),
        capability: z.string().max(80).optional(),
      }),
    )
    .min(1)
    .max(20),
});

// ---------------------------------------------------------------------------
// Resource Swarm
// ---------------------------------------------------------------------------

export const pledgeSchema = z.object({
  need_id: z.string().uuid(),
  /** Only an admin pledging on an organisation's behalf sends this; everyone else pledges as their own. */
  org_id: z.string().uuid().optional(),
  /** Rupees for a funding line, the line's own unit for materials. */
  qty: z.coerce.number().min(0.01).max(100_000_000),
  /** Ignored: the kind always comes from the need itself. Accepted for older clients. */
  kind: pledgeKind.optional(),
  note: z.string().max(500).optional(),
  expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").optional(),
});

export const dispatchSchema = z.object({
  expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").optional(),
  note: z.string().max(500).optional(),
});

export const receiveSchema = z.object({
  receipt_note: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// College projects
// ---------------------------------------------------------------------------

export const requirementsSchema = z.object({
  /** Rupees. Omit or 0 when the project needs no money, only materials. */
  funding_amount: z.coerce.number().min(0).max(100_000_000).nullish(),
  materials: z
    .array(
      z.object({
        item: z.string().trim().min(2).max(120),
        qty: z.coerce.number().min(0.01).max(10_000_000),
        unit: z.string().trim().max(30).nullish(),
      }),
    )
    .max(30)
    .default([]),
  note: z.string().max(1000).nullish(),
});

export const stageUpdateSchema = z.object({
  status: z.enum(["pending", "in_progress", "done", "blocked"]),
  note: z.string().trim().max(2000).nullish(),
  photo_paths: z.array(z.string().max(500)).max(10).default([]),
});

export const progressUpdateSchema = z.object({
  note: z.string().trim().min(5, "Say what happened, in a sentence.").max(3000),
  stage_id: z.string().uuid().nullish(),
  photo_paths: z.array(z.string().max(500)).max(10).default([]),
});

// ---------------------------------------------------------------------------
// Delivery and closure
// ---------------------------------------------------------------------------

export const evidenceSchema = z.object({
  url: z.string().min(3).max(500),
  phase: z.enum(["before", "during", "after", "closure"]),
  caption: z.string().max(300).optional(),
});

export const deploySchema = z.object({
  completion_note: z.string().min(10).max(3000),
  people_served: z.coerce.number().int().min(0).max(10_000_000),
  vulnerable_served: z.coerce.number().int().min(0).max(10_000_000).default(0),
  remaining_need: z.string().max(1000).optional(),
  follow_up_hours: z.coerce.number().int().min(0).max(8760).optional(),
});

export const confirmSchema = z.object({
  confirmed: z.boolean(),
  note: z.string().max(1000).optional(),
});

export const updateSchema = z.object({
  note: z.string().min(3).max(3000).optional(),
  milestone_id: z.string().uuid().optional(),
  milestone_status: z.enum(["pending", "in_progress", "done", "blocked"]).optional(),
});

// ---------------------------------------------------------------------------
// Crisis Mode
// ---------------------------------------------------------------------------

export const crisisStartSchema = z.object({
  region_id: z.string().min(2).max(40).default("jharkhand"),
  hazard: z.string().min(2).max(60),
  /** Labelled as a drill everywhere it appears, including the SMS call-up. */
  drill: z.boolean().default(true),
  source: z.string().max(60).default("drill"),
  headline: z.string().max(300).optional(),
  districts: z.array(z.string().max(80)).min(1).max(24),
  severity: z.coerce.number().int().min(1).max(5).default(4),
});

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export const challengeListSchema = z.object({
  region_id: z.string().max(40).optional(),
  district: z.string().max(80).optional(),
  category: category.optional(),
  status: challengeStatus.optional(),
  band: z.enum(["critical", "high", "moderate", "long_term"]).optional(),
  mode: z.enum(["peace", "crisis"]).optional(),
  org_id: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export const UPLOAD_LIMITS = {
  photo: { maxBytes: 8 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "image/heic"] },
  audio: { maxBytes: 10 * 1024 * 1024, types: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a"] },
  document: { maxBytes: 12 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] },
} as const;

export function checkUpload(
  file: File,
  kind: keyof typeof UPLOAD_LIMITS,
): string | null {
  const limit = UPLOAD_LIMITS[kind];
  if (file.size > limit.maxBytes) {
    return `That file is larger than ${Math.round(limit.maxBytes / 1024 / 1024)} MB.`;
  }
  const type = file.type.split(";")[0].toLowerCase();
  if (!(limit.types as readonly string[]).includes(type)) {
    return `Unsupported file type: ${type || "unknown"}.`;
  }
  return null;
}
