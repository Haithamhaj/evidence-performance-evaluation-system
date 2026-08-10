import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"), {
  message: "timestamp must use UTC Z notation",
});
const positiveText = z.string().trim().min(1).max(1_000);

export const RetentionDataTypeSchema = z.enum([
  "PROJECT_HISTORY",
  "EVALUATION_HISTORY",
  "AUDIT_HISTORY",
  "CONNECTED_CONTEXT",
  "EXPORT_ARTIFACT",
  "OPERATIONAL_RECORD",
]);

export const RetentionPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: UuidSchema,
    dataType: RetentionDataTypeSchema,
    policyVersion: z.number().int().positive(),
    status: z.enum(["DRAFT", "ACTIVE", "RETIRED"]),
    archiveAfterDays: z.number().int().positive().nullable(),
    hideAfterDays: z.number().int().positive().nullable(),
    autoDeleteProtectedHistory: z.literal(false),
    effectiveAt: UtcInstantSchema,
    createdById: UuidSchema,
    reason: positiveText,
  })
  .strict()
  .superRefine((policy, context) => {
    if (
      policy.archiveAfterDays !== null &&
      policy.hideAfterDays !== null &&
      policy.hideAfterDays < policy.archiveAfterDays
    ) {
      context.addIssue({
        code: "custom",
        path: ["hideAfterDays"],
        message: "hideAfterDays cannot precede archiveAfterDays",
      });
    }
  });

export const RetentionHoldSchema = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: UuidSchema,
    dataType: RetentionDataTypeSchema,
    resourceType: z.string().trim().min(1).max(200),
    resourceId: UuidSchema,
    status: z.enum(["ACTIVE", "RELEASED"]),
    reason: positiveText,
    placedById: UuidSchema,
    placedAt: UtcInstantSchema,
    releasedById: UuidSchema.optional(),
    releasedAt: UtcInstantSchema.optional(),
    releaseReason: positiveText.optional(),
  })
  .strict()
  .superRefine((hold, context) => {
    const releaseFields = [hold.releasedById, hold.releasedAt, hold.releaseReason];
    const expectsRelease = hold.status === "RELEASED";
    if (
      releaseFields.some(Boolean) !== expectsRelease ||
      (expectsRelease && !releaseFields.every(Boolean))
    ) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "release fields must be complete only for a released hold",
      });
    }
  });

export type RetentionDataType = z.infer<typeof RetentionDataTypeSchema>;
export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;
export type RetentionHold = z.infer<typeof RetentionHoldSchema>;
