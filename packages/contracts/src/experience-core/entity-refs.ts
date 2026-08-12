import { z } from "zod";

export const ExperienceEntityRefV1Schema = z
  .object({
    entityType: z.enum([
      "private_inbox_item",
      "work_item",
      "project",
      "workstream",
      "update",
      "evidence",
      "research",
      "continuity",
      "connected_context",
      "evaluation",
    ]),
    entityId: z.string().uuid(),
    version: z.number().int().positive(),
  })
  .strict();

export type ExperienceEntityRefV1 = z.infer<typeof ExperienceEntityRefV1Schema>;

export const FreshnessEnvelopeV1Schema = z
  .object({
    state: z.enum(["fresh", "possibly_stale", "stale", "refresh_required"]),
    evaluatedAt: z.iso.datetime({ offset: true }),
    sourceUpdatedAt: z.iso.datetime({ offset: true }),
    safeReasonCode: z.string().trim().min(1).max(80),
    recoveryMode: z.enum(["none", "reload", "reconnect", "retry", "manual_fallback"]),
    expectedVersion: z.number().int().positive().nullable(),
  })
  .strict();

export type FreshnessEnvelopeV1 = z.infer<typeof FreshnessEnvelopeV1Schema>;
