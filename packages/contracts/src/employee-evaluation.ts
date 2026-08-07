import { z } from "zod";

import {
  CheckInFactSchema,
  ConfirmedEvidenceFactSchema,
  CriterionVersionFactSchema,
  ProjectContributionFactSchema,
  ResearchEvaluationFactSchema,
  ResponsibilityWindowFactSchema,
  SourceCoverageNoteSchema,
} from "./evaluation-fact-view.js";

const UuidSchema = z.string().uuid();
const PositiveVersionSchema = z.number().int().positive();
const RatingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const UtcInstantSchema = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"), {
  message: "timestamp must use UTC Z notation",
});
const normalizedText = (max: number) => z.string().trim().min(1).max(max);
const OptionalReasonSchema = z.string().trim().min(1).max(4_000).nullable();
const IdempotencyKeySchema = UuidSchema;

export const EvaluationCycleStateSchema = z.enum([
  "DRAFT",
  "OPEN_PREPARATION",
  "SELF_ASSESSMENT",
  "MANAGER_ASSESSMENT",
  "COMPARISON",
  "FINALIZATION",
  "ACKNOWLEDGMENT",
  "CLOSED",
  "CANCELLED",
]);

export const EvaluationCycleTypeSchema = z.enum(["CALIBRATION_NON_BASELINE", "STANDARD"]);
export const AssessmentKindSchema = z.enum(["SELF", "MANAGER_INITIAL"]);
export const AcknowledgmentKindSchema = z.enum([
  "ACKNOWLEDGED",
  "ACKNOWLEDGED_WITH_RESERVATION",
  "NO_RESPONSE",
]);

export const AssessmentEntrySchema = z
  .object({
    criterionId: UuidSchema,
    rating: RatingSchema,
    justification: normalizedText(8_000),
    sourceReferences: z.array(UuidSchema).max(100),
    directObservationBasis: z.string().trim().min(1).max(4_000).nullable(),
  })
  .strict();

export const ActivateEvaluationTemplateVersionInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    versionId: UuidSchema,
    actorId: UuidSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
    reason: normalizedText(1_000),
  })
  .strict();

export const OpenEmployeeEvaluationCycleInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: UuidSchema,
    departmentId: UuidSchema,
    templateVersionId: UuidSchema,
    actorId: UuidSchema,
    cycleType: EvaluationCycleTypeSchema,
    startsAt: UtcInstantSchema,
    endsAt: UtcInstantSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
    reason: normalizedText(1_000),
  })
  .strict()
  .superRefine((input, context) => {
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Evaluation cycle endsAt must follow startsAt.",
      });
    }
  });

export const TransitionEmployeeEvaluationCycleInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    cycleId: UuidSchema,
    actorId: UuidSchema,
    fromState: EvaluationCycleStateSchema,
    toState: EvaluationCycleStateSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
    reason: normalizedText(1_000),
  })
  .strict();

export const EvaluationEligibilityStateSchema = z.enum([
  "ELIGIBLE",
  "EXCLUDED",
  "APPROVED_LEAVE",
  "PENDING_REVIEW",
]);

export const RecordEvaluationEligibilityDecisionInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    assignmentId: UuidSchema,
    employeeId: UuidSchema,
    actorId: UuidSchema,
    state: EvaluationEligibilityStateSchema,
    effectiveAt: UtcInstantSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
    reason: normalizedText(1_000),
  })
  .strict();

export const SaveAssessmentDraftInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    assignmentId: UuidSchema,
    actorId: UuidSchema,
    kind: AssessmentKindSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
    entries: z.array(AssessmentEntrySchema).min(1).max(100),
  })
  .strict()
  .superRefine((input, context) => {
    const criterionIds = input.entries.map((entry) => entry.criterionId);
    if (new Set(criterionIds).size !== criterionIds.length) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Assessment entries must contain unique criterion IDs.",
      });
    }
  });

export const EvaluationAiWordingRequestSchema = z
  .object({
    schemaVersion: z.literal("evaluation-justification.v1"),
    assignmentId: UuidSchema,
    actorId: UuidSchema,
    criterionId: UuidSchema,
    selectedRating: RatingSchema,
    selectedAnchor: normalizedText(8_000),
    sourceReferences: z.array(UuidSchema).max(100),
    userDraft: z.string().trim().max(8_000),
    locale: z.literal("en"),
  })
  .strict();

export const EvaluationAiWordingOutputSchema = z
  .object({
    schemaVersion: z.literal("evaluation-justification.v1"),
    draft: normalizedText(8_000),
    sourceReferences: z.array(UuidSchema).max(100),
    limitations: z.array(normalizedText(2_000)).max(20),
  })
  .strict();

export const SubmitAssessmentInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    assignmentId: UuidSchema,
    actorId: UuidSchema,
    kind: AssessmentKindSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
    confirmedAt: UtcInstantSchema,
  })
  .strict();

export const AddEvaluationDiscussionEntryInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    assignmentId: UuidSchema,
    actorId: UuidSchema,
    body: normalizedText(8_000),
    sourceReferences: z.array(UuidSchema).max(100),
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();

export const FinalEvaluationEntrySchema = z
  .object({
    criterionId: UuidSchema,
    rating: RatingSchema,
    justification: normalizedText(8_000),
    sourceReferences: z.array(UuidSchema).max(100),
    managerInitialChangeReason: OptionalReasonSchema,
  })
  .strict();

export const FinalizeEmployeeEvaluationInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    assignmentId: UuidSchema,
    managerId: UuidSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
    entries: z.array(FinalEvaluationEntrySchema).min(1).max(100),
    finalComment: z.string().trim().max(8_000).nullable(),
  })
  .strict();

export const EvaluationAcknowledgmentInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    assignmentId: UuidSchema,
    actorId: UuidSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
    kind: AcknowledgmentKindSchema,
    reservation: z.string().trim().min(1).max(8_000).nullable().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.kind === "ACKNOWLEDGED_WITH_RESERVATION" && !input.reservation) {
      context.addIssue({
        code: "custom",
        path: ["reservation"],
        message: "A reservation is required for acknowledgment with reservation.",
      });
    }
    if (input.kind !== "ACKNOWLEDGED_WITH_RESERVATION" && input.reservation) {
      context.addIssue({
        code: "custom",
        path: ["reservation"],
        message: "A reservation is allowed only for acknowledgment with reservation.",
      });
    }
  });

export const CloseEmployeeEvaluationCycleInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    cycleId: UuidSchema,
    actorId: UuidSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: IdempotencyKeySchema,
    reason: normalizedText(1_000),
  })
  .strict();

export const AssessmentDraftSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UuidSchema,
    assignmentId: UuidSchema,
    kind: AssessmentKindSchema,
    version: PositiveVersionSchema,
    entries: z.array(AssessmentEntrySchema).max(100),
    updatedAt: UtcInstantSchema,
    submittedAt: UtcInstantSchema.nullable(),
  })
  .strict();

export const EvaluationComparisonEntrySchema = z
  .object({
    criterionId: UuidSchema,
    selfRating: RatingSchema,
    managerRating: RatingSchema,
    gap: z.number().int().min(-4).max(4),
    effectiveWeight: z.number().min(0).max(100),
    highWeightGap: z.boolean(),
    selfSourceReferences: z.array(UuidSchema).max(100),
    managerSourceReferences: z.array(UuidSchema).max(100),
    sourceDifference: z
      .object({
        selfOnly: z.array(UuidSchema).max(100),
        managerOnly: z.array(UuidSchema).max(100),
      })
      .strict(),
    missingRationale: z.object({ self: z.boolean(), manager: z.boolean() }).strict(),
    responsibilityDurationInterpretation: z.array(
      z
        .object({
          sourceId: UuidSchema,
          responsibilityType: z.enum([
            "original_owner",
            "acting_owner",
            "permanent_owner",
            "contributor",
          ]),
          startedAt: UtcInstantSchema,
          endedAt: UtcInstantSchema.nullable(),
        })
        .strict(),
    ),
    disputedAttributionSourceIds: z.array(UuidSchema).max(100),
    discussionRequired: z.boolean(),
  })
  .strict();

export const EvaluationComparisonSchema = z
  .object({
    schemaVersion: z.literal(2),
    assignmentId: UuidSchema,
    entries: z.array(EvaluationComparisonEntrySchema).min(1).max(100),
    discussionEntries: z.array(
      z
        .object({
          id: UuidSchema,
          body: normalizedText(8_000),
          sourceReferences: z.array(UuidSchema).max(100),
          createdAt: UtcInstantSchema,
        })
        .strict(),
    ),
    generatedAt: UtcInstantSchema,
  })
  .strict();

const EvaluationPeriodSchema = z
  .object({ startsAt: UtcInstantSchema, endsAt: UtcInstantSchema })
  .strict()
  .superRefine((period, context) => {
    if (Date.parse(period.endsAt) <= Date.parse(period.startsAt)) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Evaluation period must end after it starts.",
      });
    }
  });

const ImmutableAssessmentProjectionSchema = z
  .object({
    submittedAt: UtcInstantSchema,
    entries: z.array(AssessmentEntrySchema).min(1).max(100),
  })
  .strict();

const EvaluationWorkFactSchema = z.union([
  ProjectContributionFactSchema,
  ConfirmedEvidenceFactSchema,
  CheckInFactSchema,
  CriterionVersionFactSchema,
]);

const DevelopmentPlanReferenceSchema = z
  .object({ developmentPlanId: UuidSchema, version: PositiveVersionSchema })
  .strict();

export const FinalEvaluationReportContextSchema = z
  .object({
    period: EvaluationPeriodSchema,
    responsibilityWindows: z.array(ResponsibilityWindowFactSchema).max(1_000),
    workFacts: z.array(EvaluationWorkFactSchema).max(10_000),
    researchFacts: z.array(ResearchEvaluationFactSchema).max(10_000),
    sourceCoverageNotes: z.array(SourceCoverageNoteSchema).max(1_000),
    selfAssessment: ImmutableAssessmentProjectionSchema,
    managerInitialAssessment: ImmutableAssessmentProjectionSchema,
    comparison: EvaluationComparisonSchema,
    developmentPlanReference: DevelopmentPlanReferenceSchema.nullable(),
  })
  .strict();

export const FinalEvaluationSnapshotSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: UuidSchema,
    assignmentId: UuidSchema,
    cycleId: UuidSchema,
    employeeId: UuidSchema,
    managerId: UuidSchema,
    templateVersionId: UuidSchema,
    cycleType: EvaluationCycleTypeSchema,
    ...FinalEvaluationReportContextSchema.shape,
    entries: z.array(FinalEvaluationEntrySchema).min(1).max(100),
    finalComment: z.string().trim().max(8_000).nullable(),
    finalizedAt: UtcInstantSchema,
    closedAt: UtcInstantSchema.nullable(),
    version: PositiveVersionSchema,
  })
  .strict();

export const EmployeeEvaluationReportProjectionSchema = z
  .object({
    schemaVersion: z.literal(2),
    assignmentId: UuidSchema,
    employeeId: UuidSchema,
    cycleId: UuidSchema,
    cycleType: EvaluationCycleTypeSchema,
    state: EvaluationCycleStateSchema,
    period: EvaluationPeriodSchema,
    finalSnapshot: FinalEvaluationSnapshotSchema.nullable(),
    acknowledgment: z
      .object({
        kind: AcknowledgmentKindSchema,
        reservation: z.string().trim().min(1).max(8_000).nullable(),
        recordedAt: UtcInstantSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();

const RatingDistributionSchema = z
  .object({
    criterionStableId: z.string().trim().min(1).max(100),
    buckets: z
      .array(z.object({ rating: RatingSchema, count: z.number().int().nonnegative() }).strict())
      .length(5),
  })
  .strict()
  .superRefine((distribution, context) => {
    const ratings = distribution.buckets.map(({ rating }) => rating);
    if (new Set(ratings).size !== 5) {
      context.addIssue({
        code: "custom",
        path: ["buckets"],
        message: "A rating distribution must contain one bucket for each rating.",
      });
    }
  });

const DepartmentEvaluationTrendSchema = z
  .object({
    sequence: PositiveVersionSchema,
    cycleType: EvaluationCycleTypeSchema,
    period: EvaluationPeriodSchema,
    ratingDistributions: z.array(RatingDistributionSchema).max(100),
  })
  .strict();

export const DepartmentEvaluationReportProjectionSchema = z
  .object({
    schemaVersion: z.literal(2),
    departmentId: UuidSchema,
    cycleId: UuidSchema,
    cycleType: EvaluationCycleTypeSchema,
    state: EvaluationCycleStateSchema,
    period: EvaluationPeriodSchema,
    ratingDistributions: z.array(RatingDistributionSchema).max(100),
    trends: z.array(DepartmentEvaluationTrendSchema).max(100),
  })
  .strict();

export type EvaluationCycleState = z.infer<typeof EvaluationCycleStateSchema>;
export type EvaluationCycleType = z.infer<typeof EvaluationCycleTypeSchema>;
export type AssessmentKind = z.infer<typeof AssessmentKindSchema>;
export type AcknowledgmentKind = z.infer<typeof AcknowledgmentKindSchema>;
export type AssessmentEntry = z.infer<typeof AssessmentEntrySchema>;
export type ActivateEvaluationTemplateVersionInput = z.infer<
  typeof ActivateEvaluationTemplateVersionInputSchema
>;
export type OpenEmployeeEvaluationCycleInput = z.infer<
  typeof OpenEmployeeEvaluationCycleInputSchema
>;
export type TransitionEmployeeEvaluationCycleInput = z.infer<
  typeof TransitionEmployeeEvaluationCycleInputSchema
>;
export type RecordEvaluationEligibilityDecisionInput = z.infer<
  typeof RecordEvaluationEligibilityDecisionInputSchema
>;
export type SaveAssessmentDraftInput = z.infer<typeof SaveAssessmentDraftInputSchema>;
export type EvaluationAiWordingRequest = z.infer<typeof EvaluationAiWordingRequestSchema>;
export type EvaluationAiWordingOutput = z.infer<typeof EvaluationAiWordingOutputSchema>;
export type SubmitAssessmentInput = z.infer<typeof SubmitAssessmentInputSchema>;
export type AddEvaluationDiscussionEntryInput = z.infer<
  typeof AddEvaluationDiscussionEntryInputSchema
>;
export type FinalEvaluationEntry = z.infer<typeof FinalEvaluationEntrySchema>;
export type FinalizeEmployeeEvaluationInput = z.infer<typeof FinalizeEmployeeEvaluationInputSchema>;
export type EvaluationAcknowledgmentInput = z.infer<typeof EvaluationAcknowledgmentInputSchema>;
export type CloseEmployeeEvaluationCycleInput = z.infer<
  typeof CloseEmployeeEvaluationCycleInputSchema
>;
export type AssessmentDraft = z.infer<typeof AssessmentDraftSchema>;
export type EvaluationComparison = z.infer<typeof EvaluationComparisonSchema>;
export type FinalEvaluationSnapshot = z.infer<typeof FinalEvaluationSnapshotSchema>;
export type EmployeeEvaluationReportProjection = z.infer<
  typeof EmployeeEvaluationReportProjectionSchema
>;
export type DepartmentEvaluationReportProjection = z.infer<
  typeof DepartmentEvaluationReportProjectionSchema
>;
