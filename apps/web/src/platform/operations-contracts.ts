import { z } from "zod";

const UuidSchema = z.uuid();
const UtcSchema = z.iso.datetime({ offset: true });

export const WebExportHistoryItemSchema = z
  .object({
    id: UuidSchema,
    reportType: z.enum([
      "EMPLOYEE_EVALUATION",
      "DEPARTMENT_EVALUATION",
      "MANAGER_UPWARD_FEEDBACK",
      "COACHING_PLAN",
      "PROJECT_OPERATIONAL",
      "CONTINUITY_OPERATIONAL",
      "DAILY_WORK_OPERATIONAL",
    ]),
    audience: z.enum([
      "EMPLOYEE_SELF",
      "MANAGER_DEPARTMENT",
      "MANAGER_IDENTIFIED_UPWARD",
      "SYSTEM_ADMIN_OPERATIONAL",
    ]),
    format: z.enum(["HTML", "PDF"]),
    locale: z.enum(["en", "ar"]),
    state: z.enum(["REQUESTED", "GENERATING", "READY", "FAILED", "EXPIRED", "REVOKED"]),
    artifactId: UuidSchema.nullable(),
    expiresAt: UtcSchema.nullable(),
    createdAt: UtcSchema,
  })
  .strict();

export const WebExportHistorySchema = z.array(WebExportHistoryItemSchema).max(100);
export const WebArtifactOpenSchema = z.discriminatedUnion("allowed", [
  z.object({ allowed: z.literal(false), reason: z.string() }).strict(),
  z
    .object({ allowed: z.literal(true), descriptor: z.string(), expiresInSeconds: z.number() })
    .strict(),
]);
export const WebArtifactRevocationSchema = z.object({ id: UuidSchema }).passthrough();

export const WebAdminHealthSchema = z
  .object({
    schemaVersion: z.literal(1),
    state: z.enum(["HEALTHY", "DEGRADED", "ACTION_REQUIRED"]),
    dependencies: z
      .array(
        z
          .object({
            dependency: z.enum([
              "API",
              "WORKER",
              "DATABASE",
              "QUEUE",
              "OBJECT_STORAGE",
              "OIDC",
              "AI_ROUTE",
              "CONNECTOR",
              "EMAIL",
              "BACKUP",
            ]),
            state: z.enum(["HEALTHY", "DEGRADED", "ACTION_REQUIRED"]),
            checkedAt: UtcSchema,
            nextActionKey: z.string().nullable(),
            correlationId: z.string().trim().min(1).max(200),
          })
          .strict(),
      )
      .max(20),
    checkedAt: UtcSchema,
  })
  .strip();

export const WebAdminCapabilitySchema = z
  .object({
    capability: z.enum([
      "USERS_MANAGE",
      "TECHNICAL_ROLES_MANAGE",
      "ORGANIZATION_CONFIG_MANAGE",
      "ORGANIZATION_TEMPLATES_MANAGE",
      "LOCALIZATION_VERSIONS_MANAGE",
      "INTEGRATIONS_MANAGE",
      "AI_ROUTES_MANAGE",
      "NOTIFICATION_CONFIG_MANAGE",
      "RETENTION_POLICIES_MANAGE",
      "AUDIT_QUERY",
      "EXPORT_OPERATIONS_MANAGE",
      "SYSTEM_HEALTH_READ",
    ]),
    available: z.boolean(),
  })
  .strict();

export const WebAdminCapabilitiesSchema = z.array(WebAdminCapabilitySchema).max(20);

export type WebExportHistoryItem = z.infer<typeof WebExportHistoryItemSchema>;
export type WebAdminHealth = z.infer<typeof WebAdminHealthSchema>;
export type WebAdminCapability = z.infer<typeof WebAdminCapabilitySchema>;
