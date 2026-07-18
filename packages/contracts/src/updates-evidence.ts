import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const PositiveVersionSchema = z.number().int().positive();

export const ExecutionModeSchema = z.enum(["manual", "ai_assisted", "agent_generated", "mixed"]);
export const EvidenceSourceKindSchema = z.enum([
  "image",
  "screenshot",
  "file",
  "document",
  "pasted_code",
  "pasted_text",
  "cli_snapshot",
  "url",
]);
export const EvidenceVerificationStateSchema = z.enum([
  "unverified",
  "pending",
  "supported",
  "partial",
  "conflicting",
  "rejected",
]);
export const ClarificationAffectsSchema = z.enum([
  "result",
  "progress_context",
  "next_action",
  "blocker",
  "evidence",
  "contribution",
  "closure",
]);

const UpdateContextSchema = z
  .object({
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    workItemId: UuidSchema.nullable(),
  })
  .strict();

export const StartTextUpdateInputSchema = UpdateContextSchema.extend({
  idempotencyKey: UuidSchema,
  rawText: z.string().trim().min(1).max(50_000),
  executionMode: ExecutionModeSchema,
}).strict();

export const ClarificationAnswerInputSchema = z
  .object({
    expectedSessionVersion: PositiveVersionSchema,
    turnId: UuidSchema,
    answer: z.string().trim().min(1).max(20_000),
  })
  .strict();

export const ClarificationStateSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("question"),
      sessionVersion: PositiveVersionSchema,
      turnId: UuidSchema,
      turnNumber: PositiveVersionSchema,
      question: z.string().trim().min(1).max(1_000),
      affects: z.array(ClarificationAffectsSchema).min(1).max(7),
      remainingFieldCount: PositiveVersionSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("ready_for_review"),
      sessionVersion: PositiveVersionSchema,
      draftRevisionId: UuidSchema,
      draftRevision: PositiveVersionSchema,
    })
    .strict(),
]);

export const EvidenceDraftInputSchema = UpdateContextSchema.extend({
  sourceId: UuidSchema,
  sourceRevision: PositiveVersionSchema,
  sourceKind: EvidenceSourceKindSchema,
  supportedClaim: z.string().trim().min(1).max(2_000),
  relatedKpiComponentId: UuidSchema.nullable(),
  relatedCriterionId: UuidSchema.nullable(),
  contributionContext: z.string().trim().min(1).max(2_000),
  executionMode: ExecutionModeSchema,
}).strict();

const ObjectEvidenceSourceSchema = z
  .object({
    kind: z.enum(["image", "screenshot", "file", "document"]),
    uploadedSourceId: UuidSchema,
  })
  .strict();
const TextEvidenceSourceSchema = z
  .object({
    kind: z.enum(["pasted_code", "pasted_text"]),
    text: z.string().min(1).max(100_000),
  })
  .strict();
const CliEvidenceSourceSchema = z.union([
  z.object({ kind: z.literal("cli_snapshot"), text: z.string().min(1).max(100_000) }).strict(),
  z.object({ kind: z.literal("cli_snapshot"), uploadedSourceId: UuidSchema }).strict(),
]);
const UrlEvidenceSourceSchema = z
  .object({ kind: z.literal("url"), url: z.url().max(2_000) })
  .strict();

export const CreateManualEvidenceInputSchema = UpdateContextSchema.extend({
  idempotencyKey: UuidSchema,
  capturedFromWorkItem: z.boolean(),
  updateSourceId: UuidSchema.nullable(),
  source: z.union([
    ObjectEvidenceSourceSchema,
    TextEvidenceSourceSchema,
    CliEvidenceSourceSchema,
    UrlEvidenceSourceSchema,
  ]),
  supportedClaim: z.string().trim().min(1).max(2_000),
  relatedKpiComponentId: UuidSchema.nullable(),
  relatedCriterionId: UuidSchema.nullable(),
  contributionContext: z.string().trim().min(1).max(2_000),
  executionMode: ExecutionModeSchema,
})
  .strict()
  .superRefine((input, context) => {
    if (input.capturedFromWorkItem && input.workItemId === null) {
      context.addIssue({
        code: "custom",
        path: ["workItemId"],
        message: "A Work Item is required for Work Item capture.",
      });
    }
  });

export const ReviseEvidenceInputSchema = z
  .object({
    expectedRevision: PositiveVersionSchema,
    supportedClaim: z.string().trim().min(1).max(2_000),
    contributionContext: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const ConfirmEvidenceInputSchema = z
  .object({
    expectedRevision: PositiveVersionSchema,
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const UpdateComparisonSchema = z
  .object({
    previousAcceptedEventId: UuidSchema.nullable(),
    changedFields: z.array(z.string().trim().min(1).max(100)).max(50),
    explanation: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const StructuredUpdateDraftSchema = z
  .object({
    id: UuidSchema,
    sessionId: UuidSchema,
    revision: PositiveVersionSchema,
    summary: z.string().trim().min(1).max(2_000),
    result: z.string().trim().min(1).max(4_000),
    blocker: z.string().trim().min(1).max(2_000).nullable(),
    nextAction: z.string().trim().min(1).max(2_000),
    contributionContext: z.string().trim().min(1).max(2_000),
    executionMode: ExecutionModeSchema,
    sourceReferences: z.array(z.string().trim().min(3).max(500)).min(1).max(500),
    evidenceIds: z.array(UuidSchema).max(100),
    comparison: UpdateComparisonSchema,
  })
  .strict();

export const ConfirmUpdateInputSchema = z
  .object({
    expectedDraftRevision: PositiveVersionSchema,
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const ReviseUpdateDraftInputSchema = z
  .object({
    expectedDraftRevision: PositiveVersionSchema,
    summary: z.string().trim().min(1).max(2_000),
    result: z.string().trim().min(1).max(4_000),
    blocker: z.string().trim().min(1).max(2_000).nullable(),
    nextAction: z.string().trim().min(1).max(2_000),
    contributionContext: z.string().trim().min(1).max(2_000),
    evidenceClaimDrafts: z.array(z.string().trim().min(1).max(2_000)).max(20),
  })
  .strict();

export const AcceptedUpdateEventSchema = UpdateContextSchema.extend({
  id: UuidSchema,
  updateSourceId: UuidSchema,
  draftRevisionId: UuidSchema,
  employeeId: UuidSchema,
  confirmedAt: UtcInstantSchema,
  sourceReferences: z.array(z.string().trim().min(3).max(500)).min(1).max(500),
}).strict();

const AiDraftSchema = z
  .object({
    summary: z.string().min(1).max(2_000).regex(/\S/u),
    result: z.string().min(1).max(4_000).regex(/\S/u),
    blocker: z.string().min(1).max(2_000).regex(/\S/u).nullable(),
    nextAction: z.string().min(1).max(2_000).regex(/\S/u),
    contributionContext: z.string().min(1).max(2_000).regex(/\S/u),
    evidenceClaimDrafts: z.array(z.string().min(1).max(2_000).regex(/\S/u)).max(20),
    comparisonExplanation: z.string().min(1).max(2_000).regex(/\S/u),
  })
  .strict();

export const UpdateStructureAiOutputSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("question"),
      unresolvedFields: z.array(ClarificationAffectsSchema).min(1).max(7),
      nextQuestion: z
        .object({
          question: z.string().min(1).max(1_000).regex(/\S/u),
          affects: z.array(ClarificationAffectsSchema).min(1).max(7),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      state: z.literal("ready_for_review"),
      unresolvedFields: z.array(ClarificationAffectsSchema).length(0),
      draft: AiDraftSchema,
    })
    .strict(),
]);

export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;
export type EvidenceSourceKind = z.infer<typeof EvidenceSourceKindSchema>;
export type EvidenceVerificationState = z.infer<typeof EvidenceVerificationStateSchema>;
export type ClarificationState = z.infer<typeof ClarificationStateSchema>;
export type StructuredUpdateDraft = z.infer<typeof StructuredUpdateDraftSchema>;
export type UpdateStructureAiOutput = z.infer<typeof UpdateStructureAiOutputSchema>;
export type AcceptedUpdateEvent = z.infer<typeof AcceptedUpdateEventSchema>;
