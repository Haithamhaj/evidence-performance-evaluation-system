import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcSchema = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"));
const RequiredTextSchema = z.string().trim().min(1).max(2_000);

export const DeliveryChannelSchema = z.enum(["IN_APP", "EMAIL"]);
export const NotificationUrgencySchema = z.enum([
  "INFORMATION",
  "ACTION",
  "ACTION_REQUIRED",
  "CRITICAL",
]);
export const NotificationCategorySchema = z.enum([
  "CHECK_IN_DUE",
  "MONTHLY_READINESS",
  "DOCUMENT_REVIEW",
  "CRITERIA_REVIEW",
  "EVIDENCE_ACTION",
  "ATTRIBUTION_ACTION",
  "EVALUATION_STAGE",
  "UPWARD_SUBMISSION",
  "COACHING_ACTION",
  "SHARED_PLAN_ACTION",
  "LEAVE_ACTION",
  "HANDOVER_ACTION",
  "DELEGATION_ACTION",
  "RETURN_ACTION",
  "REASSIGNMENT_ACTION",
  "CONNECTOR_STATE",
  "AI_RECOVERY",
  "EXPORT_READY",
  "SYSTEM_HEALTH",
  "SECURITY_ALERT",
]);
export const NotificationDeliveryStateSchema = z.enum([
  "PENDING",
  "READY",
  "SENT",
  "RETRY_SCHEDULED",
  "FAILED",
  "MUTED",
]);
export const NotificationActionSchema = z
  .object({
    kind: z.enum([
      "CHECK_IN",
      "REVIEW_DOCUMENT",
      "REVIEW_CRITERIA",
      "CONFIRM_EVIDENCE",
      "OPEN_EVALUATION",
      "OPEN_COACHING",
      "OPEN_CONTINUITY",
      "RECONNECT",
      "RETRY_AI",
      "DOWNLOAD_EXPORT",
      "OPEN_ADMIN_HEALTH",
    ]),
    resourceId: z.string().trim().min(1).max(200),
  })
  .strict();
export const NotificationTemplateSchema = z
  .object({
    version: z.number().int().positive(),
    key: z.string().regex(/^[a-z0-9_]{1,100}$/),
    arguments: z.record(z.string(), z.string().max(500)).default({}),
  })
  .strict();
export const NotificationIntentSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    recipientId: UuidSchema,
    category: NotificationCategorySchema,
    urgency: NotificationUrgencySchema,
    template: NotificationTemplateSchema,
    action: NotificationActionSchema,
    source: z
      .object({ eventId: RequiredTextSchema, eventVersion: z.number().int().positive() })
      .strict(),
    dedupeKey: RequiredTextSchema,
    channels: z.array(DeliveryChannelSchema).min(1).max(2),
    deliverAfter: UtcSchema,
    createdAt: UtcSchema,
  })
  .strict();
export const NotificationPreferenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    recipientId: UuidSchema,
    category: NotificationCategorySchema,
    emailEnabled: z.boolean(),
    version: z.number().int().positive(),
  })
  .strict();
export const NotificationDeliveryAttemptSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    intentId: UuidSchema,
    channel: DeliveryChannelSchema,
    state: NotificationDeliveryStateSchema,
    attempt: z.number().int().positive(),
    providerReceipt: z.string().trim().max(500).nullable(),
    failureCategory: z.enum(["TRANSIENT", "PERMANENT"]).nullable(),
    nextRetryAt: UtcSchema.nullable(),
    correlationId: RequiredTextSchema,
    createdAt: UtcSchema,
  })
  .strict();
export const NotificationScheduleSchema = z
  .object({
    schemaVersion: z.literal(1),
    key: z.enum(["THURSDAY_CHECK_IN", "MONTHLY_READINESS"]),
    timezone: z.literal("Asia/Riyadh"),
    cron: z.string().trim().min(1).max(100),
    version: z.number().int().positive(),
  })
  .strict();
export const NotificationDeliveryJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    jobType: z.literal("notifications.deliver"),
    intentId: UuidSchema,
    correlationId: UuidSchema,
  })
  .strict();
export const NotificationDomainEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("CHECK_IN_DUE"),
      eventId: RequiredTextSchema,
      eventVersion: z.number().int().positive(),
      recipientId: UuidSchema,
      obligationId: UuidSchema,
      dueAt: UtcSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("REASSIGNMENT_REQUIRED"),
      eventId: RequiredTextSchema,
      eventVersion: z.number().int().positive(),
      recipientId: UuidSchema,
      caseId: UuidSchema,
      occurredAt: UtcSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("EXPORT_READY"),
      eventId: RequiredTextSchema,
      eventVersion: z.number().int().positive(),
      recipientId: UuidSchema,
      artifactId: UuidSchema,
      occurredAt: UtcSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("SYSTEM_HEALTH_ACTION_REQUIRED"),
      eventId: RequiredTextSchema,
      eventVersion: z.number().int().positive(),
      recipientId: UuidSchema,
      dependency: z.enum([
        "WORKER",
        "QUEUE",
        "OBJECT_STORAGE",
        "OIDC",
        "AI_ROUTE",
        "CONNECTOR",
        "EMAIL",
        "BACKUP",
      ]),
      occurredAt: UtcSchema,
    })
    .strict(),
]);

export type NotificationIntent = z.infer<typeof NotificationIntentSchema>;
export type NotificationCategory = z.infer<typeof NotificationCategorySchema>;
export type NotificationDeliveryJob = z.infer<typeof NotificationDeliveryJobSchema>;
export type NotificationDomainEvent = z.infer<typeof NotificationDomainEventSchema>;
