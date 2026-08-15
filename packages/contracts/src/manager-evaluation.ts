import { z } from "zod";

import { AppError } from "./errors.js";

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
const normalizedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalComment = z.string().trim().max(8_000);

const EvaluationPeriodSchema = z
  .object({
    startsAt: UtcInstantSchema,
    endsAt: UtcInstantSchema,
  })
  .strict()
  .superRefine((period, context) => {
    if (Date.parse(period.endsAt) <= Date.parse(period.startsAt)) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Manager evaluation period must end after it starts.",
      });
    }
  });

export const ManagerEvaluationVisibilitySchema = z.enum([
  "IDENTIFIED",
  "MANAGER_BLINDED",
  "ANONYMOUS_AGGREGATED",
]);

export const ManagerEvaluatorStateSchema = z.enum([
  "ELIGIBLE_PENDING",
  "SUBMITTED",
  "APPROVED_LEAVE",
  "POSTPONED",
  "EXCLUDED_BY_AUTHORIZED_MANAGER",
]);

const ManagerEligibilityDecisionStateSchema = z.enum([
  "APPROVED_LEAVE",
  "POSTPONED",
  "EXCLUDED_BY_AUTHORIZED_MANAGER",
]);

const IdentifiedVisibilityPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    policyVersion: PositiveVersionSchema,
    mode: z.literal("IDENTIFIED"),
    enabled: z.literal(true),
    managerCanReadIdentity: z.literal(true),
    managerCanReadOriginals: z.literal(true),
    immediateVisibility: z.literal(true),
  })
  .strict();

const DisabledManagerBlindedPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    policyVersion: PositiveVersionSchema,
    mode: z.literal("MANAGER_BLINDED"),
    enabled: z.literal(false),
    managerCanReadIdentity: z.literal(false),
    managerCanReadOriginals: z.literal(false),
    immediateVisibility: z.literal(false),
  })
  .strict();

const DisabledAnonymousAggregatedPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    policyVersion: PositiveVersionSchema,
    mode: z.literal("ANONYMOUS_AGGREGATED"),
    enabled: z.literal(false),
    managerCanReadIdentity: z.literal(false),
    managerCanReadOriginals: z.literal(false),
    immediateVisibility: z.literal(false),
  })
  .strict();

export const ManagerEvaluationVisibilityPolicySchema = z.discriminatedUnion("mode", [
  IdentifiedVisibilityPolicySchema,
  DisabledManagerBlindedPolicySchema,
  DisabledAnonymousAggregatedPolicySchema,
]);

export const PilotManagerEvaluationProjectionPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    policyVersion: PositiveVersionSchema,
    mode: z.literal("IDENTIFIED"),
  })
  .strict();

export function createPilotManagerEvaluationProjectionPolicy(
  mode: z.infer<typeof ManagerEvaluationVisibilitySchema>,
  policyVersion: number,
): z.infer<typeof PilotManagerEvaluationProjectionPolicySchema> {
  if (mode !== "IDENTIFIED") {
    throw new AppError(
      "MANAGER_EVALUATION_VISIBILITY_DISABLED",
      "errors.managerEvaluation.visibilityDisabled",
      403,
    );
  }

  return PilotManagerEvaluationProjectionPolicySchema.parse({
    schemaVersion: 1,
    policyVersion,
    mode,
  });
}

export const OpenManagerEvaluationCycleInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    employeeEvaluationCycleId: UuidSchema,
    departmentId: UuidSchema,
    managerId: UuidSchema,
    rubricVersionId: UuidSchema,
    visibilityPolicyVersion: PositiveVersionSchema,
    visibilityMode: z.literal("IDENTIFIED"),
    startsAt: UtcInstantSchema,
    endsAt: UtcInstantSchema,
    actorId: UuidSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: UuidSchema,
    reason: normalizedText(1_000),
  })
  .strict()
  .superRefine((input, context) => {
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Manager evaluation cycle endsAt must follow startsAt.",
      });
    }
  });

export const RecordManagerEvaluationEligibilityDecisionInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    cycleId: UuidSchema,
    evaluatorId: UuidSchema,
    actorId: UuidSchema,
    state: ManagerEligibilityDecisionStateSchema,
    effectiveAt: UtcInstantSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: UuidSchema,
    reason: normalizedText(1_000),
  })
  .strict();

export const ManagerCriterionResponseSchema = z
  .object({
    criterionId: UuidSchema,
    rating: RatingSchema,
    comment: optionalComment,
  })
  .strict();

export const ManagerCriterionResponsesSchema = z
  .array(ManagerCriterionResponseSchema)
  .length(5)
  .superRefine((responses, context) => {
    const criterionIds = responses.map(({ criterionId }) => criterionId);
    if (new Set(criterionIds).size !== criterionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Manager evaluation responses must contain five unique criterion IDs.",
      });
    }
  });

export const SubmitManagerEvaluationInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    cycleId: UuidSchema,
    evaluatorId: UuidSchema,
    expectedVersion: PositiveVersionSchema,
    idempotencyKey: UuidSchema,
    identifiedNoticeConfirmed: z.literal(true),
    confirmedAt: UtcInstantSchema,
    responses: ManagerCriterionResponsesSchema,
  })
  .strict();

export const SubmitManagerEvaluationReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    responseId: UuidSchema,
    cycleId: UuidSchema,
    evaluatorId: UuidSchema,
    state: z.literal("SUBMITTED"),
    submittedAt: UtcInstantSchema,
  })
  .strict();

export const IdentifiedManagerResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    responseId: UuidSchema,
    cycleId: UuidSchema,
    managerId: UuidSchema,
    submitterId: UuidSchema,
    submitterDisplayName: normalizedText(500),
    visibilityMode: z.literal("IDENTIFIED"),
    state: z.literal("SUBMITTED"),
    responses: ManagerCriterionResponsesSchema,
    submittedAt: UtcInstantSchema,
  })
  .strict();

const ManagerEvaluationAnchorSchema = z
  .object({ rating: RatingSchema, text: normalizedText(8_000) })
  .strict();

export const ManagerEvaluationParticipantJourneySchema = z
  .object({
    schemaVersion: z.literal(1),
    cycle: z
      .object({
        id: UuidSchema,
        state: z.enum(["OPEN", "CLOSED", "CANCELLED"]),
        visibilityMode: z.literal("IDENTIFIED"),
        startsAt: UtcInstantSchema,
        endsAt: UtcInstantSchema,
      })
      .strict(),
    manager: z.object({ id: UuidSchema, displayName: normalizedText(500) }).strict(),
    eligibility: z
      .object({
        id: UuidSchema,
        state: ManagerEvaluatorStateSchema,
        version: PositiveVersionSchema,
      })
      .strict(),
    criteria: z
      .array(
        z
          .object({
            criterionId: UuidSchema,
            stableCriterionId: z.enum(["MGR-01", "MGR-02", "MGR-03", "MGR-04", "MGR-05"]),
            commentRequired: z.boolean(),
            anchors: z.array(ManagerEvaluationAnchorSchema).length(5),
          })
          .strict(),
      )
      .length(5),
    submittedResponse: IdentifiedManagerResponseSchema.nullable(),
  })
  .strict();

export const ManagerEvaluationCompletionEntrySchema = z
  .object({
    evaluatorId: UuidSchema,
    evaluatorDisplayName: normalizedText(500),
    state: ManagerEvaluatorStateSchema,
    responseId: UuidSchema.nullable(),
    submittedAt: UtcInstantSchema.nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    const submitted = entry.state === "SUBMITTED";
    if (submitted !== (entry.responseId !== null && entry.submittedAt !== null)) {
      context.addIssue({
        code: "custom",
        message: "Only submitted completion entries may contain a response and timestamp.",
      });
    }
  });

export const ManagerEvaluationCompletionProjectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    cycleId: UuidSchema,
    managerId: UuidSchema,
    visibilityMode: z.literal("IDENTIFIED"),
    eligible: z.number().int().nonnegative(),
    submitted: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    approvedLeave: z.number().int().nonnegative(),
    postponed: z.number().int().nonnegative(),
    excluded: z.number().int().nonnegative(),
    entries: z.array(ManagerEvaluationCompletionEntrySchema).max(10_000),
    generatedAt: UtcInstantSchema,
  })
  .strict()
  .superRefine((projection, context) => {
    const evaluatorIds = projection.entries.map(({ evaluatorId }) => evaluatorId);
    if (new Set(evaluatorIds).size !== evaluatorIds.length) {
      context.addIssue({ code: "custom", message: "Completion entries must be unique." });
    }

    const expected = {
      eligible: projection.entries.length,
      submitted: projection.entries.filter(({ state }) => state === "SUBMITTED").length,
      pending: projection.entries.filter(({ state }) => state === "ELIGIBLE_PENDING").length,
      approvedLeave: projection.entries.filter(({ state }) => state === "APPROVED_LEAVE").length,
      postponed: projection.entries.filter(({ state }) => state === "POSTPONED").length,
      excluded: projection.entries.filter(({ state }) => state === "EXCLUDED_BY_AUTHORIZED_MANAGER")
        .length,
    };

    for (const [field, value] of Object.entries(expected)) {
      if (projection[field as keyof typeof expected] !== value) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `Completion ${field} must match the frozen eligibility entries.`,
        });
      }
    }
  });

const ManagerRatingDistributionSchema = z
  .object({
    criterionId: UuidSchema,
    buckets: z
      .array(
        z
          .object({
            rating: RatingSchema,
            count: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .length(5),
    totalResponses: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((distribution, context) => {
    const ratings = distribution.buckets.map(({ rating }) => rating);
    if (new Set(ratings).size !== 5) {
      context.addIssue({
        code: "custom",
        path: ["buckets"],
        message: "A distribution must contain one bucket for each rating.",
      });
    }
    const total = distribution.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    if (total !== distribution.totalResponses) {
      context.addIssue({
        code: "custom",
        path: ["totalResponses"],
        message: "Distribution totalResponses must equal the bucket total.",
      });
    }
  });

export const ManagerThemeSchema = z
  .object({
    themeId: UuidSchema,
    kind: z.enum(["STRENGTH", "IMPROVEMENT", "CROSS_CYCLE"]),
    title: normalizedText(500),
    summary: normalizedText(8_000),
    criterionIds: z.array(UuidSchema).min(1).max(5),
    sourceResponseIds: z.array(UuidSchema).min(2).max(10_000),
    supportCount: z.number().int().min(2).max(10_000),
    period: EvaluationPeriodSchema,
    limitations: z.array(normalizedText(2_000)).max(20),
  })
  .strict()
  .superRefine((theme, context) => {
    if (new Set(theme.criterionIds).size !== theme.criterionIds.length) {
      context.addIssue({ code: "custom", message: "Theme criterion IDs must be unique." });
    }
    const uniqueResponseIds = new Set(theme.sourceResponseIds);
    if (uniqueResponseIds.size !== theme.sourceResponseIds.length) {
      context.addIssue({ code: "custom", message: "Theme source response IDs must be unique." });
    }
    if (theme.supportCount !== uniqueResponseIds.size) {
      context.addIssue({
        code: "custom",
        path: ["supportCount"],
        message: "Theme supportCount must equal its distinct source response count.",
      });
    }
  });

export const ManagerEvaluationSummaryRevisionSchema = z
  .object({
    schemaVersion: z.literal("manager-evaluation-summary.v1"),
    id: UuidSchema,
    cycleId: UuidSchema,
    revision: PositiveVersionSchema,
    visibilityMode: z.literal("IDENTIFIED"),
    period: EvaluationPeriodSchema,
    sourceResponseIds: z.array(UuidSchema).min(1).max(10_000),
    distributions: z.array(ManagerRatingDistributionSchema).max(5),
    themes: z.array(ManagerThemeSchema).max(100),
    limitations: z.array(normalizedText(2_000)).max(20),
    promptVersion: z.literal("manager-evaluation-summary.v1"),
    outputSchemaVersion: z.literal("manager-evaluation-summary.v1"),
    aiRunId: UuidSchema,
    createdAt: UtcInstantSchema,
  })
  .strict()
  .superRefine((summary, context) => {
    const summarySources = new Set(summary.sourceResponseIds);
    if (summarySources.size !== summary.sourceResponseIds.length) {
      context.addIssue({ code: "custom", message: "Summary source response IDs must be unique." });
    }
    const distributionCriteria = summary.distributions.map(({ criterionId }) => criterionId);
    if (new Set(distributionCriteria).size !== distributionCriteria.length) {
      context.addIssue({ code: "custom", message: "Summary distributions must be unique." });
    }
    for (const theme of summary.themes) {
      if (theme.sourceResponseIds.some((responseId) => !summarySources.has(responseId))) {
        context.addIssue({
          code: "custom",
          path: ["themes"],
          message: "Every theme source must be declared by the summary revision.",
        });
      }
    }
  });

export const IdentifiedManagerEvaluationReportProjectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    cycleId: UuidSchema,
    managerId: UuidSchema,
    visibilityMode: z.literal("IDENTIFIED"),
    period: EvaluationPeriodSchema,
    completion: ManagerEvaluationCompletionProjectionSchema,
    responses: z.array(IdentifiedManagerResponseSchema).max(10_000),
    summaryRevision: ManagerEvaluationSummaryRevisionSchema.nullable(),
    generatedAt: UtcInstantSchema,
  })
  .strict()
  .superRefine((report, context) => {
    if (
      report.completion.cycleId !== report.cycleId ||
      report.completion.managerId !== report.managerId
    ) {
      context.addIssue({
        code: "custom",
        path: ["completion"],
        message: "Completion must belong to the report cycle and manager.",
      });
    }

    const responseIds = report.responses.map(({ responseId }) => responseId);
    if (new Set(responseIds).size !== responseIds.length) {
      context.addIssue({ code: "custom", message: "Report responses must be unique." });
    }
    if (
      report.responses.some(
        (response) =>
          response.cycleId !== report.cycleId || response.managerId !== report.managerId,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["responses"],
        message: "Every response must belong to the report cycle and manager.",
      });
    }
    if (report.summaryRevision && report.summaryRevision.cycleId !== report.cycleId) {
      context.addIssue({
        code: "custom",
        path: ["summaryRevision"],
        message: "Summary revision must belong to the report cycle.",
      });
    }
  });

const FuturePrivateVisibilitySchema = z.enum(["MANAGER_BLINDED", "ANONYMOUS_AGGREGATED"]);

export const ManagerEvaluationSensitiveAccessRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    cycleId: UuidSchema,
    responseId: UuidSchema,
    actorId: UuidSchema,
    mode: FuturePrivateVisibilitySchema,
    reason: normalizedText(1_000),
    correlationId: UuidSchema,
    requestedAt: UtcInstantSchema,
  })
  .strict();

export const ManagerEvaluationSensitiveAccessResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    decision: z.literal("DENIED_UNSUPPORTED_MODE"),
    auditEventId: UuidSchema,
    decidedAt: UtcInstantSchema,
  })
  .strict();

export type ManagerEvaluationVisibility = z.infer<typeof ManagerEvaluationVisibilitySchema>;
export type ManagerEvaluatorState = z.infer<typeof ManagerEvaluatorStateSchema>;
export type ManagerEvaluationVisibilityPolicy = z.infer<
  typeof ManagerEvaluationVisibilityPolicySchema
>;
export type PilotManagerEvaluationProjectionPolicy = z.infer<
  typeof PilotManagerEvaluationProjectionPolicySchema
>;
export type OpenManagerEvaluationCycleInput = z.infer<typeof OpenManagerEvaluationCycleInputSchema>;
export type RecordManagerEvaluationEligibilityDecisionInput = z.infer<
  typeof RecordManagerEvaluationEligibilityDecisionInputSchema
>;
export type ManagerCriterionResponse = z.infer<typeof ManagerCriterionResponseSchema>;
export type ManagerCriterionResponses = z.infer<typeof ManagerCriterionResponsesSchema>;
export type SubmitManagerEvaluationInput = z.infer<typeof SubmitManagerEvaluationInputSchema>;
export type SubmitManagerEvaluationReceipt = z.infer<typeof SubmitManagerEvaluationReceiptSchema>;
export type ManagerEvaluationParticipantJourney = z.infer<
  typeof ManagerEvaluationParticipantJourneySchema
>;
export type IdentifiedManagerResponse = z.infer<typeof IdentifiedManagerResponseSchema>;
export type ManagerEvaluationCompletionEntry = z.infer<
  typeof ManagerEvaluationCompletionEntrySchema
>;
export type ManagerEvaluationCompletionProjection = z.infer<
  typeof ManagerEvaluationCompletionProjectionSchema
>;
export type ManagerTheme = z.infer<typeof ManagerThemeSchema>;
export type ManagerEvaluationSummaryRevision = z.infer<
  typeof ManagerEvaluationSummaryRevisionSchema
>;
export type IdentifiedManagerEvaluationReportProjection = z.infer<
  typeof IdentifiedManagerEvaluationReportProjectionSchema
>;
export type ManagerEvaluationSensitiveAccessRequest = z.infer<
  typeof ManagerEvaluationSensitiveAccessRequestSchema
>;
export type ManagerEvaluationSensitiveAccessResult = z.infer<
  typeof ManagerEvaluationSensitiveAccessResultSchema
>;
