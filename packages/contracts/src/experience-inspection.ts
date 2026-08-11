import { z } from "zod";

import { AnalysisSourceReferenceSchema } from "./document-analysis.js";

const UuidSchema = z.string().uuid();
const VersionTagSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[a-z][a-z0-9.-]*\.v[1-9][0-9]*$/u);
const AuditEventIdSchema = UuidSchema;

export const InspectionEnvironmentSchema = z.enum(["LOCAL", "TEST", "PRODUCTION"]);
export const InspectionExecutionKindSchema = z.enum([
  "DETERMINISTIC",
  "AGENT",
  "STATUS_RECOVERY",
  "MANUAL",
]);
export const InspectionAssistanceModeSchema = z.enum([
  "DETERMINISTIC_ASSISTANCE",
  "AGENT_ASSISTANCE",
  "STATUS_RECOVERY",
  "MANUAL_ONLY",
]);
export const InspectionFallbackStateSchema = z.enum([
  "NOT_APPLICABLE",
  "PRIMARY_USED",
  "FALLBACK_USED",
  "RECOVERY_REQUIRED",
]);
export const InspectionCommandDispositionSchema = z.enum([
  "NOT_APPLICABLE",
  "NOT_EXECUTED",
  "COMPLETED",
  "RECOVERY_REQUIRED",
]);

export const InspectionAccessSchema = z
  .object({
    environment: InspectionEnvironmentSchema,
    serverAuthorization: z
      .object({
        disposition: z.literal("SYSTEM_ADMINISTRATOR_LOCAL_TEST"),
        authorizationDecisionId: UuidSchema,
      })
      .strict(),
    privateModeSourceAccess: z.boolean(),
    auditEventId: AuditEventIdSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.environment === "PRODUCTION") {
      context.addIssue({
        code: "custom",
        path: ["environment"],
        message: "Inspection access is disabled in production by default",
      });
    }
    if (value.privateModeSourceAccess && value.auditEventId === null) {
      context.addIssue({
        code: "custom",
        path: ["auditEventId"],
        message: "Private-mode source access requires an audit event recorded with an audit reason",
      });
    }
    if (!value.privateModeSourceAccess && value.auditEventId !== null) {
      context.addIssue({
        code: "custom",
        path: ["auditEventId"],
        message: "An audit event is only accepted for private-mode source access",
      });
    }
  });

export const InspectionSourceReferenceSchema = z
  .object({
    reference: AnalysisSourceReferenceSchema,
    sourceAuthorizationDecisionId: UuidSchema,
  })
  .strict();

export const LocalizedInspectionSummarySchema = z
  .object({
    locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/u),
    messageKey: z
      .string()
      .min(3)
      .max(160)
      .regex(/^experience-inspection\.[a-z][a-z0-9.-]*$/u),
  })
  .strict();

export const ExperienceInspectionTraceSchema = z
  .object({
    access: InspectionAccessSchema,
    capabilityId: z.string().regex(/^CAP-\d{3}$/u),
    assistanceMode: InspectionAssistanceModeSchema,
    executionKind: InspectionExecutionKindSchema,
    sourceReferences: z.array(InspectionSourceReferenceSchema).min(1).max(100),
    summaries: z
      .object({
        why: LocalizedInspectionSummarySchema,
        freshness: LocalizedInspectionSummarySchema,
        consequence: LocalizedInspectionSummarySchema,
      })
      .strict(),
    schemaVersion: VersionTagSchema,
    promptVersion: VersionTagSchema.nullable(),
    aiRouterRunId: UuidSchema.nullable(),
    fallbackState: InspectionFallbackStateSchema,
    correlationId: UuidSchema,
    command: z
      .object({
        disposition: InspectionCommandDispositionSchema,
        safeRecoveryAction: LocalizedInspectionSummarySchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedModeByKind = {
      DETERMINISTIC: "DETERMINISTIC_ASSISTANCE",
      AGENT: "AGENT_ASSISTANCE",
      STATUS_RECOVERY: "STATUS_RECOVERY",
      MANUAL: "MANUAL_ONLY",
    } as const;
    if (value.assistanceMode !== expectedModeByKind[value.executionKind]) {
      context.addIssue({
        code: "custom",
        path: ["assistanceMode"],
        message: `${value.executionKind.toLowerCase()} execution must use its matching assistance mode`,
      });
    }
  });

export type InspectionAccess = z.infer<typeof InspectionAccessSchema>;
export type InspectionSourceReference = z.infer<typeof InspectionSourceReferenceSchema>;
export type LocalizedInspectionSummary = z.infer<typeof LocalizedInspectionSummarySchema>;
export type ExperienceInspectionTrace = z.infer<typeof ExperienceInspectionTraceSchema>;
