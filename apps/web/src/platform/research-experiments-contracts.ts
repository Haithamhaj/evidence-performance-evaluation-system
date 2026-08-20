import { z } from "zod";

export const ResearchHandleSchema = z.string().min(32).max(4_096);
const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const SourceReferenceSchema = z.string().min(3).max(256);
const ResearchScopeSchema = z
  .object({
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    workItemId: UuidSchema.nullable(),
  })
  .strict();
const UpstreamSourceSchema = z.union([
  z.object({ kind: z.literal("URL"), url: z.url().max(2_000) }).strict(),
  z.object({ kind: z.literal("CONNECTED_CONTEXT"), sourceItemId: UuidSchema }).strict(),
  z.object({ kind: z.literal("DOCUMENT_VERSION"), documentVersionId: UuidSchema }).strict(),
]);
const UpstreamProposalSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: UuidSchema,
      kind: z.literal("RESEARCH"),
      title: z.string().trim().min(1).max(500),
      rationale: z.string().trim().min(1).max(4_000),
      sourceReferences: z.array(SourceReferenceSchema).min(1).max(100),
      question: z.string().trim().min(1).max(4_000),
      objective: z.string().trim().min(1).max(4_000),
    })
    .strict(),
  z
    .object({
      id: UuidSchema,
      kind: z.literal("EXPERIMENT"),
      title: z.string().trim().min(1).max(500),
      rationale: z.string().trim().min(1).max(4_000),
      sourceReferences: z.array(SourceReferenceSchema).min(1).max(100),
      question: z.string().trim().min(1).max(4_000),
      baseline: z.string().trim().min(1).max(4_000).nullable(),
      measureNames: z.array(z.string().trim().min(1).max(500)).max(20),
    })
    .strict(),
  z
    .object({
      id: UuidSchema,
      kind: z.literal("WORK_ITEM"),
      title: z.string().trim().min(1).max(500),
      rationale: z.string().trim().min(1).max(4_000),
      sourceReferences: z.array(SourceReferenceSchema).min(1).max(100),
      description: z.string().trim().min(1).max(8_000),
      proposedAssigneeId: UuidSchema.nullable(),
      acceptanceConditions: z.array(z.string().trim().min(1).max(2_000)).min(1).max(12),
    })
    .strict(),
]);

export const UpstreamResearchSourceReviewSchema = z
  .object({
    id: UuidSchema,
    scope: ResearchScopeSchema,
    ownerId: UuidSchema,
    state: z.enum([
      "PENDING_RETRIEVAL",
      "READY_FOR_REVIEW",
      "PARTIAL",
      "BLOCKED",
      "CONFIRMED",
      "DISMISSED",
      "STALE",
    ]),
    version: z.number().int().positive(),
    source: UpstreamSourceSchema,
    displayUrl: z.url().max(2_000).nullable(),
    retrievalState: z.enum(["PENDING", "RETRIEVED", "PARTIAL", "BLOCKED", "STALE"]),
    retrievalReason: z.string().trim().min(1).max(2_000).nullable(),
    contentFingerprint: z.string().trim().min(1).max(256).nullable(),
    output: z
      .object({
        schemaVersion: z.literal("research-source-review-output.v1"),
        summary: z.string().trim().min(1).max(8_000),
        relevance: z.string().trim().min(1).max(4_000),
        citations: z.array(
          z
            .object({
              sourceReference: SourceReferenceSchema,
              locator: z.string().trim().min(1).max(1_000),
            })
            .strict(),
        ),
        benefits: z.array(z.string().trim().min(1).max(2_000)).max(50),
        risks: z.array(z.string().trim().min(1).max(2_000)).max(50),
        mismatches: z.array(z.string().trim().min(1).max(2_000)).max(50),
        uncertainties: z.array(z.string().trim().min(1).max(2_000)).max(50),
        disposition: z.enum([
          "ADD_RESEARCH_SOURCE",
          "OPEN_OR_REFINE_RESEARCH",
          "DRAFT_EXPERIMENT",
          "PREPARE_WORK_ITEM",
          "RETAIN_PRIVATE",
          "DISMISS",
        ]),
        proposals: z.array(UpstreamProposalSchema).max(20),
      })
      .strict()
      .nullable(),
    outputProvenance: z
      .object({
        promptVersion: z.string().trim().min(1).max(160),
        routeTrace: z
          .object({
            aiRunId: UuidSchema,
            routeKey: z.string().trim().min(1).max(160),
            routeConfigId: UuidSchema,
            routeConfigVersion: z.number().int().positive(),
          })
          .strict(),
      })
      .strict()
      .nullable(),
    recoveryOptions: z.array(
      z
        .object({
          kind: z.enum(["UPLOAD_DOCUMENT", "ADD_MANUAL_CITATION", "TRY_AGAIN"]),
          explanation: z.string().trim().min(1).max(2_000),
        })
        .strict(),
    ),
    createdAt: UtcInstantSchema,
    updatedAt: UtcInstantSchema,
  })
  .strict();

export const WebResearchProposalSchema = z.discriminatedUnion("kind", [
  z
    .object({
      handle: ResearchHandleSchema,
      kind: z.literal("RESEARCH"),
      title: z.string().trim().min(1).max(500),
      rationale: z.string().trim().min(1).max(4_000),
      question: z.string().trim().min(1).max(4_000),
      objective: z.string().trim().min(1).max(4_000),
    })
    .strict(),
  z
    .object({
      handle: ResearchHandleSchema,
      kind: z.literal("EXPERIMENT"),
      title: z.string().trim().min(1).max(500),
      rationale: z.string().trim().min(1).max(4_000),
      question: z.string().trim().min(1).max(4_000),
      baseline: z.string().trim().min(1).max(4_000).nullable(),
      measureNames: z.array(z.string().trim().min(1).max(500)).max(20),
    })
    .strict(),
  z
    .object({
      handle: ResearchHandleSchema,
      kind: z.literal("WORK_ITEM"),
      title: z.string().trim().min(1).max(500),
      rationale: z.string().trim().min(1).max(4_000),
      description: z.string().trim().min(1).max(8_000),
      acceptanceConditions: z.array(z.string().trim().min(1).max(2_000)).min(1).max(12),
    })
    .strict(),
]);

export const WebResearchSourceReviewSchema = z
  .object({
    handle: ResearchHandleSchema,
    state: z.enum([
      "PENDING_RETRIEVAL",
      "READY_FOR_REVIEW",
      "PARTIAL",
      "BLOCKED",
      "CONFIRMED",
      "DISMISSED",
      "STALE",
    ]),
    version: z.number().int().positive(),
    displayUrl: z.url().nullable(),
    retrievalState: z.enum(["PENDING", "RETRIEVED", "PARTIAL", "BLOCKED", "STALE"]),
    retrievalReason: z.string().trim().min(1).max(2_000).nullable(),
    output: z
      .object({
        summary: z.string().trim().min(1).max(8_000),
        relevance: z.string().trim().min(1).max(4_000),
        citations: z.array(
          z
            .object({
              label: z.string().trim().min(1).max(100),
              locator: z.string().trim().min(1).max(1_000),
              url: z.url().nullable(),
            })
            .strict(),
        ),
        benefits: z.array(z.string().trim().min(1).max(2_000)).max(50),
        risks: z.array(z.string().trim().min(1).max(2_000)).max(50),
        mismatches: z.array(z.string().trim().min(1).max(2_000)).max(50),
        uncertainties: z.array(z.string().trim().min(1).max(2_000)).max(50),
        proposals: z.array(WebResearchProposalSchema).max(20),
      })
      .strict()
      .nullable(),
    recoveryOptions: z.array(
      z
        .object({
          kind: z.enum(["UPLOAD_DOCUMENT", "ADD_MANUAL_CITATION", "TRY_AGAIN"]),
          explanation: z.string().trim().min(1).max(2_000),
        })
        .strict(),
    ),
  })
  .strict();

export const StartResearchReviewInputSchema = z
  .object({
    projectId: z.string().uuid(),
    url: z
      .url()
      .max(2_000)
      .refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
  })
  .strict();

export const CreateWebResearchRecordInputSchema = z
  .object({
    projectId: z.string().uuid(),
    question: z.string().trim().min(1).max(4_000),
    relevance: z.string().trim().min(1).max(8_000),
    assumptions: z.array(z.string().trim().min(1).max(2_000)).max(50),
    constraints: z.array(z.string().trim().min(1).max(2_000)).max(50),
  })
  .strict();

export const WebResearchRecordSchema = z
  .object({
    handle: ResearchHandleSchema,
    state: z.enum(["DRAFT", "ACTIVE", "CONCLUDED", "CANCELLED", "SUPERSEDED"]),
    version: z.number().int().positive(),
    question: z.string().trim().min(1).max(4_000),
    objective: z.string().trim().min(1).max(4_000),
    assumptions: z.array(z.string().trim().min(1).max(2_000)).max(50),
    constraints: z.array(z.string().trim().min(1).max(2_000)).max(50),
    knownUncertainty: z.array(z.string().trim().min(1).max(2_000)).max(50),
    decisionQuestion: z.string().trim().min(1).max(4_000),
    sources: z.array(
      z
        .object({
          title: z.string().trim().min(1).max(500),
          url: z.url().nullable(),
          relevance: z.string().trim().min(1).max(4_000),
          credibility: z.string().trim().min(1).max(4_000),
        })
        .strict(),
    ),
    decision: z
      .object({
        synthesis: z.string().trim().min(1).max(8_000),
        answer: z.string().trim().min(1).max(8_000),
        remainingUncertainty: z.array(z.string().trim().min(1).max(2_000)).max(50),
        decision: z.enum([
          "ADOPT",
          "REJECT",
          "DEFER",
          "REFINE",
          "RUN_ANOTHER_EXPERIMENT",
          "NO_DECISION",
        ]),
        rationale: z.string().trim().min(1).max(8_000),
        nextAction: z.string().trim().min(1).max(4_000),
        confirmedAt: UtcInstantSchema,
      })
      .strict()
      .nullable(),
    appliedLearning: z.array(
      z
        .object({
          targetKind: z.enum([
            "WORK_ITEM",
            "UPDATE",
            "DOCUMENT_VERSION",
            "PROGRESS_CONTRACT_PROPOSAL",
            "CRITERION_PROPOSAL",
            "RESEARCH",
            "EXPERIMENT",
            "KNOWLEDGE_TRANSFER",
          ]),
          whatChanged: z.string().trim().min(1).max(8_000),
          causalRationale: z.string().trim().min(1).max(8_000),
          confirmedAt: UtcInstantSchema,
        })
        .strict(),
    ),
  })
  .strict();
export const WebResearchRecordListSchema = z.array(WebResearchRecordSchema).max(20);

export const WebExperimentRecordSchema = z
  .object({
    handle: ResearchHandleSchema,
    title: z.string().trim().min(1).max(500),
    state: z.enum([
      "DRAFT",
      "READY",
      "RUNNING",
      "RESULT_RECORDED",
      "CONCLUDED",
      "ABANDONED",
      "SUPERSEDED",
    ]),
    version: z.number().int().positive(),
    question: z.string().trim().min(1).max(4_000),
    baseline: z.string().trim().min(1).max(4_000),
    measures: z.array(z.string().trim().min(1).max(500)).max(50),
    testCases: z.array(z.string().trim().min(1).max(2_000)).max(100),
    controls: z.array(z.string().trim().min(1).max(4_000)).max(50),
    versions: z.array(z.string().trim().min(1).max(2_000)).max(50),
    reproducibility: z.string().trim().min(1).max(8_000),
    result: z.string().trim().min(1).max(8_000).nullable(),
    resultStatus: z.enum(["COMPLETED", "FAILED", "INVALID", "STOPPED"]).nullable(),
    humanConclusion: z.string().trim().min(1).max(8_000).nullable(),
    limitations: z.array(z.string().trim().min(1).max(2_000)).max(50),
  })
  .strict();
export const WebExperimentRecordListSchema = z.array(WebExperimentRecordSchema).max(20);
export const CreateWebExperimentInputSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    hypothesis: z.string().trim().min(1).max(4_000),
    baseline: z.string().trim().min(1).max(4_000),
    measure: z.string().trim().min(1).max(500),
    testCase: z.string().trim().min(1).max(2_000),
    control: z.string().trim().min(1).max(4_000),
    versions: z.string().trim().min(1).max(2_000),
    reproducibility: z.string().trim().min(1).max(8_000),
  })
  .strict();

export const ConfirmWebResearchDecisionInputSchema = z
  .object({
    synthesis: z.string().trim().min(1).max(8_000),
    answer: z.string().trim().min(1).max(8_000),
    remainingUncertainty: z.array(z.string().trim().min(1).max(2_000)).max(50),
    decision: z.enum([
      "ADOPT",
      "REJECT",
      "DEFER",
      "REFINE",
      "RUN_ANOTHER_EXPERIMENT",
      "NO_DECISION",
    ]),
    rationale: z.string().trim().min(1).max(8_000),
    nextAction: z.string().trim().min(1).max(4_000),
    source: z
      .object({
        url: z.url().max(2_000),
        title: z.string().trim().min(1).max(500),
        relevance: z.string().trim().min(1).max(4_000),
        credibility: z.string().trim().min(1).max(4_000),
      })
      .strict(),
    appliedChange: z.string().trim().min(1).max(8_000),
  })
  .strict();

export type WebResearchProposal = z.infer<typeof WebResearchProposalSchema>;
export type WebResearchSourceReview = z.infer<typeof WebResearchSourceReviewSchema>;
export type WebResearchRecord = z.infer<typeof WebResearchRecordSchema>;
export type WebExperimentRecord = z.infer<typeof WebExperimentRecordSchema>;
