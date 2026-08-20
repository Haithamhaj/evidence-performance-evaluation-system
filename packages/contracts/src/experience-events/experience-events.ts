import { z } from "zod";

import { ExperienceEntityRefV1Schema } from "../experience-core/entity-refs.js";

export const ExperienceWorkflowEventTypeSchema = z.enum([
  "experience.confirm",
  "experience.correct",
  "experience.dismiss",
  "experience.retry",
  "experience.submit",
  "experience.recovery",
]);

export const ExperienceWorkflowEventV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.string().uuid(),
    type: ExperienceWorkflowEventTypeSchema,
    actorId: z.string().uuid(),
    recipientId: z.string().uuid(),
    entityRef: ExperienceEntityRefV1Schema,
    operationId: z.string().uuid().nullable(),
    idempotencyKey: z.string().trim().min(1).max(200),
    expectedVersion: z.number().int().positive().nullable(),
    safeReasonCode: z.string().trim().min(1).max(80),
    correlationId: z.string().uuid(),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((event, context) => {
    if (event.actorId !== event.recipientId) {
      context.addIssue({
        code: "custom",
        path: ["recipientId"],
        message: "Phase 1 workflow events are owner-scoped",
      });
    }
    if (event.type === "experience.retry" && event.operationId === null) {
      context.addIssue({
        code: "custom",
        path: ["operationId"],
        message: "Retry events require an operation id",
      });
    }
    if (
      [
        "experience.confirm",
        "experience.correct",
        "experience.dismiss",
        "experience.submit",
      ].includes(event.type) &&
      event.expectedVersion === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedVersion"],
        message: "Mutating workflow decisions require an expected version",
      });
    }
  });

export type ExperienceWorkflowEventV1 = z.infer<typeof ExperienceWorkflowEventV1Schema>;

export const ExperienceDeliveryJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    jobType: z.literal("experience.deliver"),
    receiptId: z.string().uuid(),
    correlationId: z.string().uuid(),
  })
  .strict();

export type ExperienceDeliveryJob = z.infer<typeof ExperienceDeliveryJobSchema>;
