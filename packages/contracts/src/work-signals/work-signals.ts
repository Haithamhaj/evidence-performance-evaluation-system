import { z } from "zod";

import {
  ExperienceEntityRefV1Schema,
  FreshnessEnvelopeV1Schema,
} from "../experience-core/entity-refs.js";

export const WorkSignalTypeSchema = z.enum([
  "domain.work_item_changed",
  "domain.project_context_changed",
  "domain.update_confirmed",
  "domain.evidence_state_changed",
  "domain.research_lifecycle_changed",
  "domain.continuity_state_changed",
  "connector.google_context_changed",
  "connector.github_fact_verified",
  "scheduled.today_refresh_due",
  "scheduled.checkin_or_readiness_due",
  "scheduled.responsibility_expiry_due",
  "user.capture_submitted",
  "user.domain_command_requested",
  "user.assistance_requested",
]);

export type WorkSignalType = z.infer<typeof WorkSignalTypeSchema>;

export const WorkSignalSourceClassSchema = z.enum([
  "domain",
  "connector",
  "scheduled_work_check",
  "user_domain_action",
]);

export const WorkSignalV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    signalId: z.string().uuid(),
    type: WorkSignalTypeSchema,
    sourceClass: WorkSignalSourceClassSchema,
    originatingDomain: z.enum([
      "work_items",
      "projects",
      "updates_evidence",
      "research_experiments",
      "continuity",
      "connected_work_context",
      "github_integration",
      "evaluation",
      "operations",
    ]),
    entityRefs: z.array(ExperienceEntityRefV1Schema).min(1).max(5),
    actor: z
      .object({ kind: z.enum(["human", "trusted_source", "schedule"]), id: z.string().min(1) })
      .strict(),
    occurredAt: z.iso.datetime({ offset: true }),
    receivedAt: z.iso.datetime({ offset: true }),
    idempotencyKey: z.string().trim().min(1).max(200),
    visibility: z.object({ kind: z.literal("owner"), recipientId: z.string().uuid() }).strict(),
    correlationId: z.string().uuid(),
    freshness: FreshnessEnvelopeV1Schema,
  })
  .strict()
  .superRefine((signal, context) => {
    if (sourceClassFor(signal.type) !== signal.sourceClass) {
      context.addIssue({
        code: "custom",
        path: ["sourceClass"],
        message: "Work Signal source class does not match its closed taxonomy",
      });
    }
  });

export type WorkSignalV1 = z.infer<typeof WorkSignalV1Schema>;

function sourceClassFor(type: WorkSignalType): z.infer<typeof WorkSignalSourceClassSchema> {
  if (type.startsWith("domain.")) return "domain";
  if (type.startsWith("connector.")) return "connector";
  if (type.startsWith("scheduled.")) return "scheduled_work_check";
  return "user_domain_action";
}
