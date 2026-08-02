import { z } from "zod";

const UuidSchema = z.string().uuid();
const SourceReferenceSchema = z
  .string()
  .min(3)
  .max(256)
  .regex(
    /^[a-z][a-z0-9._-]{0,63}:(?:[0-9]{1,20}|[A-Fa-f0-9-]{36}|[0-9A-HJKMNP-TV-Z]{26}|[A-Fa-f0-9]{32,64})$/iu,
  );
const RevisionSchema = z
  .object({
    employeeId: UuidSchema,
    sourceItemId: UuidSchema,
    revision: z.number().int().positive(),
    schemaVersion: z.string().min(3).max(160),
    promptVersion: z.string().min(3).max(160),
    routeTrace: z
      .object({
        aiRunId: UuidSchema,
        routeKey: z.string().min(3).max(160),
        routeConfigId: UuidSchema,
        routeConfigVersion: z.number().int().positive(),
      })
      .strict(),
    sourceReferences: z.array(SourceReferenceSchema).min(1).max(100),
    reviewStatus: z.enum(["PENDING", "CONFIRMED", "CORRECTED", "REJECTED", "SUPERSEDED"]),
    revisionOrigin: z.enum(["AI", "EMPLOYEE"]),
    correctionReason: z.string().trim().min(1).max(1_000).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ContextProjectSuggestionSchema = RevisionSchema.extend({
  id: UuidSchema,
  analysisId: UuidSchema,
  projectId: UuidSchema.nullable(),
  decision: z.enum(["AUTO_LINK", "REVIEW", "NO_MATCH"]),
  explanation: z.string().trim().min(1).max(4_000),
  anchors: z
    .array(
      z
        .object({
          kind: z.enum([
            "EXPLICIT_USER_MAPPING",
            "CONFIRMED_SENDER_DOMAIN",
            "CALENDAR_CONTEXT",
            "EXPLICIT_PROJECT_REFERENCE",
            "PRIOR_EMPLOYEE_CORRECTION",
            "GOVERNED_REPOSITORY_BINDING",
          ]),
          reference: SourceReferenceSchema,
          conflicts: z.boolean(),
        })
        .strict(),
    )
    .max(20),
  supersedesSuggestionId: UuidSchema.nullable(),
}).strict();

export const ContextTaskDraftSchema = RevisionSchema.extend({
  id: UuidSchema,
  draft: z
    .object({
      title: z.string().min(1).max(240),
      description: z.string().max(8_000),
      projectId: UuidSchema.nullable(),
      workstreamId: UuidSchema.nullable(),
      proposedAssigneeId: UuidSchema.nullable(),
      dueAt: z.iso.datetime({ offset: true }).nullable(),
      acceptanceConditions: z.array(z.string().min(1)).max(12),
      sourceReferences: z.array(SourceReferenceSchema).min(1),
      uncertainties: z.array(z.string()),
    })
    .strict(),
  supersedesTaskDraftId: UuidSchema.nullable(),
  clarification: z
    .object({
      requiredFields: z.array(z.enum(["projectId", "assigneeId"])),
      nextQuestion: z
        .object({ field: z.enum(["projectId", "assigneeId"]), sourceItemId: UuidSchema })
        .strict()
        .nullable(),
    })
    .strict(),
}).strict();

export const ContextReviewQueueSchema = z
  .object({
    items: z.array(
      z.discriminatedUnion("kind", [
        ContextProjectSuggestionSchema.extend({ kind: z.literal("PROJECT_SUGGESTION") }).strict(),
        ContextTaskDraftSchema.extend({ kind: z.literal("TASK_DRAFT") }).strict(),
      ]),
    ),
  })
  .strict();
export const ContextSuggestionInputSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
export const ContextSuggestionCorrectionInputSchema = ContextSuggestionInputSchema.extend({
  projectId: UuidSchema.nullable(),
}).strict();
export const ContextPrepareTaskInputSchema = z.object({ sourceItemId: UuidSchema }).strict();
export const ContextConfirmTaskInputSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1_000),
    draft: z
      .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(8_000),
        projectId: UuidSchema,
        workstreamId: UuidSchema.nullable(),
        assigneeId: UuidSchema,
        dueAt: z.iso.datetime({ offset: true }).nullable(),
        acceptanceConditions: z.array(z.string().trim().min(1).max(500)).max(50),
      })
      .strict(),
  })
  .strict();
export const ContextConfirmTaskResultSchema = z
  .object({
    taskDraftId: UuidSchema,
    confirmedRevision: z.number().int().positive(),
    workItem: z
      .object({ id: UuidSchema, projectId: UuidSchema, assigneeId: UuidSchema.nullable() })
      .passthrough(),
  })
  .strict();

export type ContextProjectSuggestion = z.infer<typeof ContextProjectSuggestionSchema> & {
  readonly kind: "PROJECT_SUGGESTION";
};
export type ContextTaskDraft = z.infer<typeof ContextTaskDraftSchema> & {
  readonly kind: "TASK_DRAFT";
};
