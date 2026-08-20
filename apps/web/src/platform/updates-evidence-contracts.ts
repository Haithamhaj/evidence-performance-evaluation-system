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

export const UpdateComposerContextSchema = z
  .object({
    projects: z.array(
      z
        .object({
          id: UuidSchema,
          name: z.string().trim().min(1).max(200),
          workstreams: z.array(
            z
              .object({
                id: UuidSchema,
                name: z.string().trim().min(1).max(200),
              })
              .strict(),
          ),
          workItems: z.array(
            z
              .object({
                id: UuidSchema,
                title: z.string().trim().min(1).max(200),
                workstreamId: UuidSchema.nullable(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

const UploadedUpdateSourceSchema = z
  .object({
    kind: z.enum(["image", "screenshot", "file", "document"]),
    uploadedSourceId: UuidSchema,
  })
  .strict();
const TextUpdateSourceSchema = z
  .object({
    kind: z.enum(["pasted_text", "pasted_code", "cli_snapshot", "github_snapshot"]),
    text: z.string().trim().min(1).max(100_000),
  })
  .strict();
const UrlUpdateSourceSchema = z
  .object({ kind: z.literal("url"), url: z.url().max(2_000) })
  .strict();
const VoiceTranscriptUpdateSourceSchema = z
  .object({ kind: z.literal("voice_transcript"), voiceSessionId: UuidSchema })
  .strict();
export const UpdateSourceInputSchema = z.union([
  UploadedUpdateSourceSchema,
  TextUpdateSourceSchema,
  UrlUpdateSourceSchema,
  VoiceTranscriptUpdateSourceSchema,
]);
export type UpdateSourceInput = z.infer<typeof UpdateSourceInputSchema>;

export const StartVoiceUpdateInputSchema = UpdateContextSchema.extend({
  idempotencyKey: UuidSchema,
  uploadedSourceId: UuidSchema,
  declaredDurationSeconds: z.number().int().min(1).max(14_400),
}).strict();
export const ReviseVoiceTranscriptInputSchema = z
  .object({
    expectedRevision: PositiveVersionSchema,
    transcript: z.string().trim().min(1).max(50_000),
  })
  .strict();
export const ConfirmVoiceTranscriptInputSchema = z
  .object({ expectedRevision: PositiveVersionSchema, reason: z.string().trim().min(1).max(1_000) })
  .strict();
export const VoiceUpdateSessionSchema = z
  .object({
    sessionId: UuidSchema,
    state: z.enum([
      "transcribing",
      "transcript_ready",
      "transcript_confirmed",
      "cancelled",
      "failed",
    ]),
    transcript: z.string().nullable(),
    revision: z.number().int().positive().nullable(),
    language: z.enum(["ar", "en", "mixed"]).nullable(),
    dialect: z.enum(["fusha", "gulf", "levantine", "english", "mixed"]).nullable(),
    transcriptConfirmed: z.boolean(),
  })
  .strict();

export const StartUpdateInputSchema = UpdateContextSchema.extend({
  idempotencyKey: UuidSchema,
  rawText: z.string().trim().max(50_000).optional().default(""),
  sources: z.array(UpdateSourceInputSchema).min(1).max(20).optional(),
  executionMode: ExecutionModeSchema,
})
  .strict()
  .superRefine((input, context) => {
    if (input.rawText.length === 0 && (input.sources === undefined || input.sources.length === 0)) {
      context.addIssue({ code: "custom", path: ["sources"], message: "An Update needs a source." });
    }
  });

export const StartTextUpdateInputSchema = StartUpdateInputSchema;

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
      state: z.literal("draft_with_question"),
      sessionId: UuidSchema,
      sessionVersion: PositiveVersionSchema,
      draft: z.lazy(() => StructuredUpdateDraftSchema),
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
      sessionId: UuidSchema,
      sessionVersion: PositiveVersionSchema,
      draft: z.lazy(() => StructuredUpdateDraftSchema),
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
    evidenceClaimDrafts: z.array(z.string().trim().min(1).max(2_000)).max(20).default([]),
    documentationNeeds: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
    relatedProgressComponentIds: z.array(UuidSchema).max(100).default([]),
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

export const CreateGitHubEvidenceInputSchema = UpdateContextSchema.extend({
  idempotencyKey: UuidSchema,
  sourceEventId: UuidSchema,
  supportedClaim: z.string().trim().min(1).max(2_000),
  relatedKpiComponentId: UuidSchema.nullable(),
  relatedCriterionId: UuidSchema.nullable(),
  contributionContext: z.string().trim().min(1).max(2_000),
  executionMode: ExecutionModeSchema,
}).strict();

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
    evidenceClaimDrafts: z.array(z.string().trim().min(1).max(2_000)).max(20),
    documentationNeeds: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
    relatedProgressComponentIds: z.array(UuidSchema).max(100).default([]),
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

export const UpdateResultCardSchema = z
  .object({
    acceptedEventId: UuidSchema,
    project: z
      .object({
        id: UuidSchema,
        name: z.string().trim().min(1).max(300),
      })
      .strict(),
    workstream: z
      .object({
        id: UuidSchema,
        name: z.string().trim().min(1).max(300),
      })
      .strict()
      .nullable(),
    workItem: z
      .object({
        id: UuidSchema,
        title: z.string().trim().min(1).max(300),
      })
      .strict()
      .nullable(),
    summary: z.string().trim().min(1).max(2_000),
    result: z.string().trim().min(1).max(4_000),
    sourceReferences: z.array(z.string().trim().min(3).max(500)).min(1).max(500),
    comparison: z
      .object({
        previousAcceptedEventId: UuidSchema.nullable(),
        explanation: z.string().trim().min(1).max(2_000),
      })
      .strict(),
    blocker: z.string().trim().min(1).max(2_000).nullable(),
    nextAction: z.string().trim().min(1).max(2_000),
    documentationNeeds: z.array(z.string().trim().min(1).max(500)).max(50),
    progressImpact: z.discriminatedUnion("state", [
      z
        .object({
          state: z.literal("applied"),
          snapshotId: UuidSchema,
          previousPercent: z.number().min(0).max(100),
          percent: z.number().min(0).max(100),
        })
        .strict(),
      z
        .object({
          state: z.literal("awaiting_confirmation"),
          componentIds: z.array(UuidSchema).min(1).max(100),
        })
        .strict(),
      z.object({ state: z.literal("no_measurable_impact") }).strict(),
      z
        .object({
          state: z.literal("insufficient_information"),
          missing: z.array(z.string().trim().min(1).max(500)).min(1).max(50),
        })
        .strict(),
    ]),
    confirmedAt: UtcInstantSchema,
  })
  .strict();

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
  sourceProvenance: z.enum([
    "github_automated",
    "employee_text",
    "employee_voice",
    "employee_file",
    "employee_code",
    "employee_url",
    "employee_github_snapshot",
    "employee_mixed",
    "human_decision",
  ]),
  project: z.object({ id: UuidSchema, name: z.string().trim().min(1).max(500) }).strict(),
  workstream: z
    .object({ id: UuidSchema, name: z.string().trim().min(1).max(500) })
    .strict()
    .nullable(),
  workItem: z
    .object({ id: UuidSchema, title: z.string().trim().min(1).max(500) })
    .strict()
    .nullable(),
  relatedKpiComponents: z
    .array(z.object({ id: UuidSchema, name: z.string().trim().min(1).max(500) }).strict())
    .max(100),
  relatedCriteria: z
    .array(z.object({ id: UuidSchema, name: z.string().trim().min(1).max(500) }).strict())
    .max(100),
  verificationState: z.enum([
    "unverified",
    "pending",
    "supported",
    "partial",
    "conflicting",
    "rejected",
  ]),
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
            kind: z.enum([
              "update",
              "evidence",
              "project_fact",
              "decision",
              "research",
              "experiment",
              "applied_learning",
            ]),
            projectId: UuidSchema,
            workstreamId: UuidSchema.nullable(),
            workItemId: UuidSchema.nullable(),
            employeeId: UuidSchema.nullable(),
            occurredAt: UtcInstantSchema,
            title: z.string().trim().min(1).max(2_000),
            detail: z.string().trim().min(1).max(4_000),
            sourceReferences: z.array(z.string().trim().min(3).max(500)).min(1).max(500),
            sourceProvenance: z.enum([
              "github_automated",
              "employee_text",
              "employee_voice",
              "employee_file",
              "employee_code",
              "employee_url",
              "employee_github_snapshot",
              "employee_mixed",
              "human_decision",
            ]),
            reviewState: z.enum([
              "automated_project_fact",
              "ai_draft",
              "employee_confirmed",
              "human_decision",
            ]),
            project: z.object({ id: UuidSchema, name: z.string().trim().min(1).max(500) }).strict(),
            workstream: z
              .object({ id: UuidSchema, name: z.string().trim().min(1).max(500) })
              .strict()
              .nullable(),
            workItem: z
              .object({ id: UuidSchema, title: z.string().trim().min(1).max(500) })
              .strict()
              .nullable(),
            relatedKpiComponents: z
              .array(z.object({ id: UuidSchema, name: z.string().trim().min(1).max(500) }).strict())
              .max(100),
            relatedCriteria: z
              .array(z.object({ id: UuidSchema, name: z.string().trim().min(1).max(500) }).strict())
              .max(100),
            verificationState: z
              .enum(["unverified", "pending", "supported", "partial", "conflicting", "rejected"])
              .nullable(),
            decisionOutcome: z.enum(["satisfied", "not_satisfied"]).nullable(),
          })
          .strict(),
      )
      .max(50),
    nextCursor: z.string().min(1).max(1_000).nullable(),
  })
  .strict();

export const UploadedEvidenceSourceSchema = z
  .object({
    id: UuidSchema,
    kind: z.enum(["project", "workstream"]),
    resourceId: UuidSchema,
    filename: z.string().trim().min(1).max(255),
    detectedMime: z.string().trim().min(1).max(200),
    detectedType: z.string().trim().min(1).max(200),
    byteSize: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    createdAt: UtcInstantSchema,
  })
  .strict();

export type ClarificationState = z.infer<typeof ClarificationStateSchema>;
export type StructuredUpdateDraft = z.infer<typeof StructuredUpdateDraftSchema>;
export type UpdateComposerContext = z.infer<typeof UpdateComposerContextSchema>;
export type UpdateResultCard = z.infer<typeof UpdateResultCardSchema>;
export type EvidenceDetail = z.infer<typeof EvidenceDetailSchema>;
export type EvidenceReview = z.infer<typeof EvidenceReviewSchema>;
export type TimelineResponse = z.infer<typeof TimelineResponseSchema>;
export type TimelineItem = TimelineResponse["items"][number];
