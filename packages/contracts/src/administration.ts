import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcSchema = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"));

export const AdminHealthStateSchema = z.enum(["HEALTHY", "DEGRADED", "ACTION_REQUIRED"]);
export const AdminCapabilitySchema = z.enum([
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
]);
export const AdminCommandSchema = z
  .object({
    schemaVersion: z.literal(1),
    idempotencyKey: UuidSchema,
    actorId: UuidSchema,
    capability: AdminCapabilitySchema,
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(2_000).nullable(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();
export const AdminDependencyHealthSchema = z
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
    state: AdminHealthStateSchema,
    checkedAt: UtcSchema,
    nextActionKey: z.string().trim().min(1).max(100).nullable(),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();
export const AdminHealthProjectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    state: AdminHealthStateSchema,
    dependencies: z.array(AdminDependencyHealthSchema).max(20),
    checkedAt: UtcSchema,
  })
  .strict();

export type AdminCommand = z.infer<typeof AdminCommandSchema>;
export type AdminDependencyHealth = z.infer<typeof AdminDependencyHealthSchema>;
export type AdminHealthProjection = z.infer<typeof AdminHealthProjectionSchema>;
