import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcSchema = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"));

export const ExportStateSchema = z.enum([
  "REQUESTED",
  "GENERATING",
  "READY",
  "FAILED",
  "EXPIRED",
  "REVOKED",
]);
export const ExportReportTypeSchema = z.enum([
  "EMPLOYEE_EVALUATION",
  "DEPARTMENT_EVALUATION",
  "MANAGER_UPWARD_FEEDBACK",
  "COACHING_PLAN",
  "PROJECT_OPERATIONAL",
  "CONTINUITY_OPERATIONAL",
  "DAILY_WORK_OPERATIONAL",
]);
export const ExportAudienceSchema = z.enum([
  "EMPLOYEE_SELF",
  "MANAGER_DEPARTMENT",
  "MANAGER_IDENTIFIED_UPWARD",
  "SYSTEM_ADMIN_OPERATIONAL",
]);
export const ExportFormatSchema = z.enum(["HTML", "PDF"]);
export const ExportManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    requestId: UuidSchema,
    reportType: ExportReportTypeSchema,
    audience: ExportAudienceSchema,
    format: ExportFormatSchema,
    locale: z.enum(["en", "ar"]),
    projectionVersion: z.number().int().positive(),
    rendererVersion: z.number().int().positive(),
    cycleId: UuidSchema.nullable(),
    sourceVersions: z
      .array(
        z
          .object({
            source: z.string().trim().min(1).max(100),
            snapshotId: z.string().trim().min(1).max(200),
            version: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
    createdAt: UtcSchema,
  })
  .strict();
export const ExportRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    requesterId: UuidSchema,
    idempotencyKey: UuidSchema,
    reportType: ExportReportTypeSchema,
    audience: ExportAudienceSchema,
    format: ExportFormatSchema,
    locale: z.enum(["en", "ar"]),
    cycleId: UuidSchema.nullable(),
    timezone: z.string().trim().min(1).max(100),
  })
  .strict();
export const ExportArtifactDescriptorSchema = z
  .object({
    schemaVersion: z.literal(1),
    artifactId: UuidSchema,
    storageKey: z.string().trim().min(1).max(500),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z.number().int().nonnegative(),
    contentType: z.enum(["text/html", "application/pdf"]),
    encrypted: z.literal(true),
    expiresAt: UtcSchema,
  })
  .strict();

export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type ExportManifest = z.infer<typeof ExportManifestSchema>;
