import { z } from "zod";

const UuidSchema = z.string().uuid();
const VersionSchema = z.number().int().positive();
const UtcSchema = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"), {
  message: "timestamp must use UTC Z notation",
});
const text = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
const PeriodSchema = z.object({ startsAt: UtcSchema, endsAt: UtcSchema }).strict();

export const CoachingInsightDecisionSchema = z.enum([
  "ACCEPT",
  "EDIT_AND_ACCEPT",
  "DEFER",
  "REJECT",
  "SUPERSEDE",
]);
export const CoachingInsightStateSchema = z.enum(["DRAFT", "REVIEW_REQUIRED", "DECIDED"]);
export const CoachingConfidenceSchema = z.enum(["SUPPORTED", "REVIEW_REQUIRED", "LIMITED"]);
export const CoachingSourceKindSchema = z.enum([
  "EVIDENCE",
  "UPDATE",
  "RESEARCH",
  "EXPERIMENT",
  "EVALUATION_FACT",
  "MANAGER_FEEDBACK_THEME",
]);
export const CoachingInsightSourceSchema = z
  .object({ sourceId: UuidSchema, kind: CoachingSourceKindSchema, excerpt: text(2_000).optional() })
  .strict();
export const CoachingInsightSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    employeeId: UuidSchema,
    state: CoachingInsightStateSchema,
    pattern: text(4_000),
    period: PeriodSchema,
    sources: z.array(CoachingInsightSourceSchema).min(1).max(100),
    confidence: CoachingConfidenceSchema,
    confidenceBasis: text(2_000),
    limitations: z.array(text(2_000)).min(1).max(20),
    conflicts: z.array(text(2_000)).max(20).optional(),
    cannotConclude: text(2_000),
    actionDraft: z
      .object({ title: text(500), objective: text(4_000), activity: text(4_000) })
      .strict()
      .optional(),
    aiRunId: UuidSchema.optional(),
    version: VersionSchema,
    createdAt: UtcSchema,
  })
  .strict();

export const DevelopmentActionStateSchema = z.enum([
  "DRAFT",
  "ACCEPTED",
  "ACTIVE",
  "COMPLETED",
  "DEFERRED",
  "CANCELLED",
  "SUPERSEDED",
]);
export const DevelopmentActionPrivacySchema = z.enum(["PRIVATE", "SHARED"]);
export const DevelopmentActionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    employeeId: UuidSchema,
    title: text(500),
    objective: text(4_000),
    expectedBenefit: text(4_000),
    activity: text(4_000),
    completionEvidenceDefinition: text(4_000),
    targetDate: UtcSchema.nullable(),
    privacy: DevelopmentActionPrivacySchema,
    state: DevelopmentActionStateSchema,
    projectId: UuidSchema.nullable().optional(),
    researchId: UuidSchema.nullable().optional(),
    workItemId: UuidSchema.nullable().optional(),
    version: VersionSchema,
  })
  .strict();

export const ManagerSupportKindSchema = z.enum([
  "COMMENT",
  "RESOURCE",
  "APPLICATION_OPPORTUNITY",
  "DISCUSSION_REQUEST",
]);
export const ManagerSupportSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    actionId: UuidSchema,
    managerId: UuidSchema,
    kind: ManagerSupportKindSchema,
    body: text(4_000),
    resourceUrl: z.url().nullable(),
    createdAt: UtcSchema,
  })
  .strict();

export const FormalPlanStateSchema = z.enum([
  "DRAFT",
  "EMPLOYEE_APPROVED",
  "MANAGER_AGREED",
  "ACTIVE",
  "COMPLETED",
  "CLOSED",
  "WITHDRAWN",
]);
export const FormalDevelopmentPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    employeeId: UuidSchema,
    managerId: UuidSchema,
    state: FormalPlanStateSchema,
    developmentArea: text(1_000),
    reason: text(4_000),
    expectedBehavior: text(4_000),
    activities: z.array(text(4_000)).min(1).max(20),
    followUpOwnerId: UuidSchema,
    targetDate: UtcSchema.nullable(),
    completionEvidenceDefinition: text(4_000),
    sourceEvaluationAssignmentId: UuidSchema.nullable(),
    sourceActionId: UuidSchema.nullable(),
    version: VersionSchema,
  })
  .strict();

const command = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ schemaVersion: z.literal(1), ...shape, expectedVersion: VersionSchema, idempotencyKey: UuidSchema }).strict();
export const DecideCoachingInsightInputSchema = command({
  insightId: UuidSchema,
  employeeId: UuidSchema,
  decision: CoachingInsightDecisionSchema,
  privateReason: optionalText(4_000),
  personalNote: optionalText(8_000),
});
export const CreateDevelopmentActionInputSchema = command({
  employeeId: UuidSchema,
  insightId: UuidSchema.nullable().optional(),
  title: text(500), objective: text(4_000), expectedBenefit: text(4_000), activity: text(4_000),
  completionEvidenceDefinition: text(4_000), targetDate: UtcSchema.nullable(),
  privacy: DevelopmentActionPrivacySchema, projectId: UuidSchema.nullable().optional(),
  researchId: UuidSchema.nullable().optional(), workItemId: UuidSchema.nullable().optional(),
});
export const TransitionDevelopmentActionInputSchema = command({
  actionId: UuidSchema, employeeId: UuidSchema, toState: DevelopmentActionStateSchema,
});
export const AddManagerSupportInputSchema = command({
  actionId: UuidSchema, managerId: UuidSchema, kind: ManagerSupportKindSchema,
  body: text(4_000), resourceUrl: z.url().nullable(),
});
export const ApproveFormalPlanInputSchema = command({ planId: UuidSchema, employeeId: UuidSchema });
export const AgreeFormalPlanInputSchema = command({ planId: UuidSchema, managerId: UuidSchema });

export type CoachingInsight = z.infer<typeof CoachingInsightSchema>;
export type DevelopmentAction = z.infer<typeof DevelopmentActionSchema>;
export type FormalDevelopmentPlan = z.infer<typeof FormalDevelopmentPlanSchema>;
