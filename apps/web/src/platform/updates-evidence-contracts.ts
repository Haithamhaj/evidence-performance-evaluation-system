import { z } from "zod";

const UuidSchema = z.string().uuid();
const PositiveVersionSchema = z.number().int().positive();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const ExecutionModeSchema = z.enum(["manual", "ai_assisted", "agent_generated", "mixed"]);
const EvidenceSourceKindSchema = z.enum([
  "image",
  "screenshot",
  "file",
  "document",
  "pasted_code",
  "pasted_text",
  "cli_snapshot",
  "url",
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

const ClarificationAffectsSchema = z.enum([
  "result",
  "progress_context",
  "next_action",
  "blocker",
  "evidence",
  "contribution",
  "closure",
]);
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

export const ConfirmUpdateInputSchema = z
  .object({
    expectedDraftRevision: PositiveVersionSchema,
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const ConfirmEvidenceInputSchema = z
  .object({
    expectedRevision: PositiveVersionSchema,
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
export const RejectEvidenceInputSchema = ConfirmEvidenceInputSchema;

export const ReviseEvidenceInputSchema = z
  .object({
    expectedRevision: PositiveVersionSchema,
    supportedClaim: z.string().trim().min(1).max(2_000),
    contributionContext: z.string().trim().min(1).max(2_000),
  })
  .strict();

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

const ComparisonSchema = z
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
    comparison: ComparisonSchema,
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

export const EvidenceDetailSchema = z
  .object({
    id: UuidSchema,
    revisionId: UuidSchema,
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    workItemId: UuidSchema.nullable(),
    state: z.enum(["draft", "confirmed", "rejected"]),
    revision: PositiveVersionSchema,
    revisionKind: z.enum(["ai_draft", "employee_edit", "manual_draft"]),
    sourceKind: EvidenceSourceKindSchema,
    supportedClaim: z.string().trim().min(1).max(2_000),
    contributionContext: z.string().trim().min(1).max(2_000),
    executionMode: ExecutionModeSchema,
  })
  .strict();

export const EvidenceReviewSchema = EvidenceDetailSchema.extend({
  sourceText: z.string().nullable(),
  sourceUrl: z.url().nullable(),
  mediaType: z.string().nullable(),
}).strict();

export const AcceptedEvidenceEventSchema = z
  .object({
    id: UuidSchema,
    evidenceId: UuidSchema,
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    sourceReferences: z.array(z.string().trim().min(3).max(500)).min(1).max(500),
    confirmedAt: UtcInstantSchema,
  })
  .strict();

export const TimelineResponseSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: UuidSchema,
            kind: z.enum(["update", "evidence"]),
            projectId: UuidSchema,
            workstreamId: UuidSchema.nullable(),
            workItemId: UuidSchema.nullable(),
            employeeId: UuidSchema,
            occurredAt: UtcInstantSchema,
            title: z.string().trim().min(1).max(2_000),
            detail: z.string().trim().min(1).max(4_000),
            sourceReferences: z.array(z.string().trim().min(3).max(500)).min(1).max(500),
          })
          .strict(),
      )
      .max(50),
    nextCursor: z.string().min(1).max(1_000).nullable(),
  })
  .strict();
