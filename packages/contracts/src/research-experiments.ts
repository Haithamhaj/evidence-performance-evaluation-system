import { z } from "zod";

import { ExecutionModeSchema } from "./updates-evidence.js";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const PositiveVersionSchema = z.number().int().positive();
const ReasonSchema = z.string().trim().min(1).max(1_000);
const SourceReferenceSchema = z.string().trim().min(3).max(500);
const normalizedText = (max: number) => z.string().trim().min(1).max(max);

export const ResearchStateSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "CONCLUDED",
  "CANCELLED",
  "SUPERSEDED",
]);

export const ExperimentStateSchema = z.enum([
  "DRAFT",
  "READY",
  "RUNNING",
  "RESULT_RECORDED",
  "CONCLUDED",
  "ABANDONED",
  "SUPERSEDED",
]);

export const ResearchSourceReviewStateSchema = z.enum([
  "PENDING_RETRIEVAL",
  "READY_FOR_REVIEW",
  "PARTIAL",
  "BLOCKED",
  "CONFIRMED",
  "DISMISSED",
  "STALE",
]);

export const ResearchScopeSchema = z
  .object({
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    workItemId: UuidSchema.nullable(),
  })
  .strict();

const UrlResearchSourceSchema = z
  .object({ kind: z.literal("URL"), url: z.url().max(2_000) })
  .strict();
const ConnectedContextResearchSourceSchema = z
  .object({ kind: z.literal("CONNECTED_CONTEXT"), sourceItemId: UuidSchema })
  .strict();
const DocumentVersionResearchSourceSchema = z
  .object({ kind: z.literal("DOCUMENT_VERSION"), documentVersionId: UuidSchema })
  .strict();

export const ResearchSourceInputSchema = z.union([
  UrlResearchSourceSchema,
  ConnectedContextResearchSourceSchema,
  DocumentVersionResearchSourceSchema,
]);

export const CreateResearchSourceReviewInputSchema = z
  .object({
    scope: ResearchScopeSchema,
    idempotencyKey: UuidSchema,
    source: ResearchSourceInputSchema,
  })
  .strict();

export const ResearchCitationSchema = z
  .object({
    sourceReference: SourceReferenceSchema,
    locator: normalizedText(1_000),
  })
  .strict();

export const ResearchProposalKindSchema = z.enum(["RESEARCH", "EXPERIMENT", "WORK_ITEM"]);

const ResearchProposalBaseSchema = z
  .object({
    id: UuidSchema,
    kind: ResearchProposalKindSchema,
    title: normalizedText(500),
    rationale: normalizedText(4_000),
    sourceReferences: z.array(SourceReferenceSchema).min(1).max(100),
  })
  .strict();

const ResearchProposalSchema = z.discriminatedUnion("kind", [
  ResearchProposalBaseSchema.extend({
    kind: z.literal("RESEARCH"),
    question: normalizedText(4_000),
    objective: normalizedText(4_000),
  }).strict(),
  ResearchProposalBaseSchema.extend({
    kind: z.literal("EXPERIMENT"),
    question: normalizedText(4_000),
    baseline: normalizedText(4_000).nullable(),
    measureNames: z.array(normalizedText(500)).max(20),
  }).strict(),
  ResearchProposalBaseSchema.extend({
    kind: z.literal("WORK_ITEM"),
    description: normalizedText(8_000),
    proposedAssigneeId: UuidSchema.nullable(),
    acceptanceConditions: z.array(normalizedText(2_000)).min(1).max(12),
  }).strict(),
]);

export const ResearchSourceReviewProposalSchema = ResearchProposalSchema;

export const ResearchSourceReviewDispositionSchema = z.enum([
  "ADD_RESEARCH_SOURCE",
  "OPEN_OR_REFINE_RESEARCH",
  "DRAFT_EXPERIMENT",
  "PREPARE_WORK_ITEM",
  "RETAIN_PRIVATE",
  "DISMISS",
]);

export const ResearchSourceReviewOutputSchema = z
  .object({
    schemaVersion: z.literal("research-source-review-output.v1"),
    summary: normalizedText(8_000),
    relevance: normalizedText(4_000),
    citations: z.array(ResearchCitationSchema).min(1).max(100),
    benefits: z.array(normalizedText(2_000)).max(50),
    risks: z.array(normalizedText(2_000)).max(50),
    mismatches: z.array(normalizedText(2_000)).max(50),
    uncertainties: z.array(normalizedText(2_000)).max(50),
    disposition: ResearchSourceReviewDispositionSchema,
    proposals: z.array(ResearchProposalSchema).max(20),
  })
  .strict();

const ResearchSourceReviewRecoverySchema = z
  .object({
    kind: z.enum(["UPLOAD_DOCUMENT", "ADD_MANUAL_CITATION", "TRY_AGAIN"]),
    explanation: normalizedText(2_000),
  })
  .strict();

export const ResearchSourceReviewDetailSchema = z
  .object({
    id: UuidSchema,
    scope: ResearchScopeSchema,
    ownerId: UuidSchema,
    state: ResearchSourceReviewStateSchema,
    version: PositiveVersionSchema,
    source: ResearchSourceInputSchema,
    displayUrl: z.url().max(2_000).nullable(),
    retrievalState: z.enum(["PENDING", "RETRIEVED", "PARTIAL", "BLOCKED", "STALE"]),
    retrievalReason: normalizedText(2_000).nullable(),
    contentFingerprint: z.string().trim().min(1).max(256).nullable(),
    output: ResearchSourceReviewOutputSchema.nullable(),
    recoveryOptions: z.array(ResearchSourceReviewRecoverySchema).max(3),
    createdAt: UtcInstantSchema,
    updatedAt: UtcInstantSchema,
  })
  .strict();

export const ConfirmResearchSourceDispositionInputSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    disposition: z.enum(["CONFIRM", "DISMISS"]),
    reason: ReasonSchema,
    proposalIds: z.array(UuidSchema).max(20),
  })
  .strict();

export const ResearchHypothesisSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("TESTABLE"), statement: normalizedText(4_000) }).strict(),
  z.object({ kind: z.literal("NO_HYPOTHESIS"), reason: ReasonSchema }).strict(),
]);

const ResearchRevisionContentSchema = z
  .object({
    problemStatement: normalizedText(8_000),
    context: normalizedText(8_000),
    question: normalizedText(4_000),
    objective: normalizedText(4_000),
    hypothesis: ResearchHypothesisSchema,
    assumptions: z.array(normalizedText(2_000)).max(50),
    constraints: z.array(normalizedText(2_000)).max(50),
    knownUncertainty: z.array(normalizedText(2_000)).max(50),
    alternatives: z.array(normalizedText(2_000)).max(50),
    decisionQuestion: normalizedText(4_000),
    sourceReferences: z.array(SourceReferenceSchema).max(100),
    executionMode: ExecutionModeSchema,
  })
  .strict();

export const CreateResearchInputSchema = ResearchRevisionContentSchema.extend({
  scope: ResearchScopeSchema,
  idempotencyKey: UuidSchema,
}).strict();

export const ReviseResearchInputSchema = ResearchRevisionContentSchema.extend({
  expectedVersion: PositiveVersionSchema,
}).strict();

export const TransitionResearchInputSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    state: ResearchStateSchema,
    reason: ReasonSchema.nullable(),
    successorResearchId: UuidSchema.nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    if (["CANCELLED", "SUPERSEDED"].includes(input.state) && input.reason === null) {
      context.addIssue({ code: "custom", path: ["reason"], message: "A reason is required." });
    }
    if (input.state === "SUPERSEDED" && input.successorResearchId === null) {
      context.addIssue({
        code: "custom",
        path: ["successorResearchId"],
        message: "A successor Research Record is required.",
      });
    }
  });

export const TransferResearchOwnerInputSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    toUserId: UuidSchema,
    effectiveAt: UtcInstantSchema,
    reason: ReasonSchema,
  })
  .strict();

export const ExperimentMeasureKindSchema = z.enum([
  "NUMERIC",
  "CATEGORICAL",
  "BOOLEAN",
  "QUALITATIVE",
]);
export const ExperimentMeasureDirectionSchema = z.enum([
  "HIGHER",
  "LOWER",
  "TARGET_RANGE",
  "MATCH",
  "DESCRIPTIVE",
]);

export const ExperimentMeasureSchema = z
  .object({
    stableId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z][a-z0-9_]*$/u),
    name: normalizedText(500),
    kind: ExperimentMeasureKindSchema,
    unit: z.string().trim().min(1).max(100).nullable(),
    direction: ExperimentMeasureDirectionSchema,
    baselineValue: z.string().trim().min(1).max(2_000).nullable(),
    baselineReference: SourceReferenceSchema.nullable(),
    interpretationRule: normalizedText(2_000),
  })
  .strict();

export const ExperimentTestCaseSchema = z
  .object({
    id: UuidSchema,
    inputIdentity: normalizedText(2_000),
    expectedObservation: normalizedText(2_000).nullable(),
    category: normalizedText(500),
    inclusionReason: normalizedText(2_000),
  })
  .strict();

export const ExperimentControlSchema = z
  .object({
    comparisonTarget: normalizedText(2_000),
    constantConditions: normalizedText(4_000),
  })
  .strict();

export const ExperimentBaselineSchema = z
  .object({
    description: normalizedText(4_000),
    value: z.string().trim().min(1).max(2_000).nullable(),
    sourceReference: SourceReferenceSchema.nullable(),
  })
  .strict();

const ExperimentMethodContentSchema = z
  .object({
    question: normalizedText(4_000),
    baseline: ExperimentBaselineSchema,
    measures: z.array(ExperimentMeasureSchema).min(1).max(50),
    testCases: z.array(ExperimentTestCaseSchema).min(1).max(500),
    controls: z.array(ExperimentControlSchema).max(100),
    conditions: z.array(normalizedText(2_000)).min(1).max(100),
    reproducibilityInstructions: normalizedText(8_000),
    knownRisks: z.array(normalizedText(2_000)).max(50),
    failureCases: z.array(normalizedText(2_000)).max(50),
    sourceReferences: z.array(SourceReferenceSchema).max(100),
    executionMode: ExecutionModeSchema,
  })
  .strict();

export const CreateExperimentInputSchema = z
  .object({
    researchId: UuidSchema,
    scope: ResearchScopeSchema,
    idempotencyKey: UuidSchema,
    title: normalizedText(500),
  })
  .strict();

export const ReviseExperimentMethodInputSchema = ExperimentMethodContentSchema.extend({
  expectedVersion: PositiveVersionSchema,
}).strict();

const ExperimentConfigurationEntrySchema = z
  .object({ name: normalizedText(500), value: normalizedText(2_000) })
  .strict();

export const ExperimentObservationSchema = z
  .object({
    measureStableId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z][a-z0-9_]*$/u),
    testCaseId: UuidSchema.nullable(),
    observedValue: normalizedText(4_000),
    unit: z.string().trim().min(1).max(100).nullable(),
    note: normalizedText(4_000).nullable(),
  })
  .strict();

export const ExperimentRunResultStatusSchema = z.enum([
  "COMPLETED",
  "FAILED",
  "INVALID",
  "STOPPED",
]);

export const RecordExperimentRunInputSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    methodRevisionId: UuidSchema,
    startedAt: UtcInstantSchema,
    completedAt: UtcInstantSchema,
    resultStatus: ExperimentRunResultStatusSchema,
    environment: z.array(ExperimentConfigurationEntrySchema).max(100),
    inputs: z.array(ExperimentConfigurationEntrySchema).max(100),
    modelConfigurations: z.array(ExperimentConfigurationEntrySchema).max(100),
    observations: z.array(ExperimentObservationSchema).max(1_000),
    unexpectedConditions: z.array(normalizedText(2_000)).max(100),
    executionNotes: normalizedText(8_000),
    sourceReferences: z.array(SourceReferenceSchema).max(100),
  })
  .strict()
  .superRefine((input, context) => {
    if (Date.parse(input.completedAt) < Date.parse(input.startedAt)) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "completedAt must not precede startedAt.",
      });
    }
  });

export const ExperimentConclusionOutcomeSchema = z.enum([
  "SUPPORTED",
  "NOT_SUPPORTED",
  "INCONCLUSIVE",
  "INVALID",
  "ABANDONED",
]);

export const ConcludeExperimentInputSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    outcome: ExperimentConclusionOutcomeSchema,
    summary: normalizedText(8_000),
    runIds: z.array(UuidSchema).min(1).max(1_000),
    measureStableIds: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
    limitations: z.array(normalizedText(2_000)).max(50),
    confidenceDescription: normalizedText(2_000),
    decisionRelevance: normalizedText(4_000),
    nextStep: normalizedText(4_000),
  })
  .strict();

export const ResearchDecisionSchema = z.enum([
  "ADOPT",
  "REJECT",
  "DEFER",
  "REFINE",
  "RUN_ANOTHER_EXPERIMENT",
  "NO_DECISION",
]);

export const ConcludeResearchInputSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    synthesis: normalizedText(8_000),
    answer: normalizedText(8_000),
    remainingUncertainty: z.array(normalizedText(2_000)).max(50),
    decision: ResearchDecisionSchema,
    rationale: normalizedText(8_000),
    nextAction: normalizedText(4_000),
    sourceReferences: z.array(SourceReferenceSchema).min(1).max(100),
    experimentIds: z.array(UuidSchema).max(100),
  })
  .strict();

export const AppliedLearningTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("WORK_ITEM"), id: UuidSchema }).strict(),
  z.object({ kind: z.literal("UPDATE"), id: UuidSchema }).strict(),
  z.object({ kind: z.literal("DOCUMENT_VERSION"), id: UuidSchema }).strict(),
  z.object({ kind: z.literal("PROGRESS_CONTRACT_PROPOSAL"), id: UuidSchema }).strict(),
  z.object({ kind: z.literal("CRITERION_PROPOSAL"), id: UuidSchema }).strict(),
  z.object({ kind: z.literal("RESEARCH"), id: UuidSchema }).strict(),
  z.object({ kind: z.literal("EXPERIMENT"), id: UuidSchema }).strict(),
  z.object({ kind: z.literal("KNOWLEDGE_TRANSFER"), documentVersionId: UuidSchema }).strict(),
]);

export const CreateAppliedLearningInputSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    researchConclusionId: UuidSchema,
    target: AppliedLearningTargetSchema,
    whatChanged: normalizedText(8_000),
    causalRationale: normalizedText(8_000),
  })
  .strict();

export const LinkResearchEvidenceInputSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    evidenceId: UuidSchema,
    evidenceRevisionId: UuidSchema,
    supportedClaim: normalizedText(4_000),
    experimentId: UuidSchema.nullable(),
    experimentRunId: UuidSchema.nullable(),
    experimentConclusionId: UuidSchema.nullable(),
  })
  .strict();

const ResearchRevisionDetailSchema = ResearchRevisionContentSchema.extend({
  id: UuidSchema,
  revision: PositiveVersionSchema,
  origin: z.enum(["EMPLOYEE", "AI_DRAFT"]),
  authorId: UuidSchema,
  createdAt: UtcInstantSchema,
}).strict();

export const ResearchDetailSchema = z
  .object({
    id: UuidSchema,
    scope: ResearchScopeSchema,
    ownerId: UuidSchema,
    state: ResearchStateSchema,
    revision: PositiveVersionSchema,
    version: PositiveVersionSchema,
    currentRevision: ResearchRevisionDetailSchema,
    createdAt: UtcInstantSchema,
    transitionedAt: UtcInstantSchema,
  })
  .strict();

const ExperimentMethodDetailSchema = ExperimentMethodContentSchema.extend({
  id: UuidSchema,
  revision: PositiveVersionSchema,
  origin: z.enum(["EMPLOYEE", "AI_DRAFT"]),
  authorId: UuidSchema,
  createdAt: UtcInstantSchema,
}).strict();

export const ExperimentDetailSchema = z
  .object({
    id: UuidSchema,
    researchId: UuidSchema,
    scope: ResearchScopeSchema,
    state: ExperimentStateSchema,
    methodRevision: PositiveVersionSchema,
    version: PositiveVersionSchema,
    currentMethod: ExperimentMethodDetailSchema,
    createdAt: UtcInstantSchema,
    transitionedAt: UtcInstantSchema,
  })
  .strict();

export type ResearchState = z.infer<typeof ResearchStateSchema>;
export type ExperimentState = z.infer<typeof ExperimentStateSchema>;
export type ResearchSourceReviewState = z.infer<typeof ResearchSourceReviewStateSchema>;
export type ResearchScope = z.infer<typeof ResearchScopeSchema>;
export type ResearchSourceInput = z.infer<typeof ResearchSourceInputSchema>;
export type CreateResearchSourceReviewInput = z.infer<typeof CreateResearchSourceReviewInputSchema>;
export type ResearchSourceReviewOutput = z.infer<typeof ResearchSourceReviewOutputSchema>;
export type ResearchSourceReviewProposal = z.infer<typeof ResearchSourceReviewProposalSchema>;
export type ResearchSourceReviewDetail = z.infer<typeof ResearchSourceReviewDetailSchema>;
export type ConfirmResearchSourceDispositionInput = z.infer<
  typeof ConfirmResearchSourceDispositionInputSchema
>;
export type CreateResearchInput = z.infer<typeof CreateResearchInputSchema>;
export type ReviseResearchInput = z.infer<typeof ReviseResearchInputSchema>;
export type TransitionResearchInput = z.infer<typeof TransitionResearchInputSchema>;
export type TransferResearchOwnerInput = z.infer<typeof TransferResearchOwnerInputSchema>;
export type CreateExperimentInput = z.infer<typeof CreateExperimentInputSchema>;
export type ReviseExperimentMethodInput = z.infer<typeof ReviseExperimentMethodInputSchema>;
export type RecordExperimentRunInput = z.infer<typeof RecordExperimentRunInputSchema>;
export type ConcludeExperimentInput = z.infer<typeof ConcludeExperimentInputSchema>;
export type ConcludeResearchInput = z.infer<typeof ConcludeResearchInputSchema>;
export type CreateAppliedLearningInput = z.infer<typeof CreateAppliedLearningInputSchema>;
export type LinkResearchEvidenceInput = z.infer<typeof LinkResearchEvidenceInputSchema>;
export type ResearchDetail = z.infer<typeof ResearchDetailSchema>;
export type ExperimentDetail = z.infer<typeof ExperimentDetailSchema>;
