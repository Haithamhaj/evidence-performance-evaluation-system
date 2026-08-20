import { z } from "zod";

const UuidSchema = z.uuid();

export const WebNotificationItemSchema = z
  .object({
    id: UuidSchema,
    category: z.enum([
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
    ]),
    urgency: z.enum(["INFORMATION", "ACTION", "ACTION_REQUIRED", "CRITICAL"]),
    actionKind: z.enum([
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
    actionResourceId: z.string().trim().min(1).max(200),
    dedupeKey: z.string().trim().min(1).max(2_000),
    readAt: z.iso.datetime({ offset: true }).nullable(),
    resolvedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .passthrough();

export const WebNotificationInboxSchema = z.array(WebNotificationItemSchema).max(100);
export const WebNotificationOpenResultSchema = z.discriminatedUnion("allowed", [
  z.object({ allowed: z.literal(false), reason: z.string() }).strict(),
  z
    .object({
      allowed: z.literal(true),
      action: z
        .object({ kind: WebNotificationItemSchema.shape.actionKind, resourceId: z.string() })
        .strict(),
    })
    .strict(),
]);
export const WebNotificationResolveResultSchema = z.object({ resolved: z.boolean() }).strict();

export type WebNotificationItem = z.infer<typeof WebNotificationItemSchema>;
export type WebNotificationOpenResult = z.infer<typeof WebNotificationOpenResultSchema>;
