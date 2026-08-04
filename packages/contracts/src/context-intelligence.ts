import { z } from "zod";

import { AnalysisSourceReferenceSchema } from "./document-analysis.js";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const VersionTagSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[a-z][a-z0-9.-]*\.v[1-9][0-9]*$/u);
const ReasonSchema = z.string().trim().min(1).max(1_000);
const normalizedText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^\S(?:[\s\S]*\S)?$/u);

export const SourceReferenceSchema = AnalysisSourceReferenceSchema;

export const ContextIntelligenceReviewStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CORRECTED",
  "REJECTED",
  "SUPERSEDED",
]);

export const ContextIntelligenceRevisionOriginSchema = z.enum(["AI", "EMPLOYEE"]);

export const ContextIntelligenceRouteTraceSchema = z
  .object({
    aiRunId: UuidSchema,
    routeKey: VersionTagSchema,
    routeConfigId: UuidSchema,
    routeConfigVersion: z.number().int().positive(),
  })
  .strict();

const governedRevisionShape = {
  employeeId: UuidSchema,
  sourceItemId: UuidSchema,
  revision: z.number().int().positive(),
  schemaVersion: VersionTagSchema,
  promptVersion: VersionTagSchema,
  routeTrace: ContextIntelligenceRouteTraceSchema,
  sourceReferences: z.array(SourceReferenceSchema).min(1).max(100),
  reviewStatus: ContextIntelligenceReviewStatusSchema,
  revisionOrigin: ContextIntelligenceRevisionOriginSchema,
  correctionReason: ReasonSchema.nullable(),
  createdAt: UtcInstantSchema,
} as const;

function requireEmployeeRevisionLineage(
  value: {
    revision: number;
    revisionOrigin: "AI" | "EMPLOYEE";
    correctionReason: string | null;
  },
  supersedesId: string | null,
  context: z.core.$RefinementCtx,
): void {
  if (
    (value.revision === 1 && supersedesId !== null) ||
    (value.revision > 1 && supersedesId === null)
  ) {
    context.addIssue({
      code: "custom",
      message: "Revision lineage must identify the immediately superseded revision",
    });
  }
  if (value.revisionOrigin === "EMPLOYEE") {
    if (value.revision < 2 || supersedesId === null || value.correctionReason === null) {
      context.addIssue({
        code: "custom",
        message: "Employee revisions require a reason and a superseded revision",
      });
    }
  } else if (value.correctionReason !== null) {
    context.addIssue({
      code: "custom",
      message: "AI revisions cannot record an employee correction reason",
    });
  }
}

export const ContextAnalysisSchema = z
  .object({
    id: UuidSchema,
    ...governedRevisionShape,
    summary: normalizedText(8_000),
    uncertainties: z.array(normalizedText(2_000)).max(100),
    supersedesAnalysisId: UuidSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    requireEmployeeRevisionLineage(value, value.supersedesAnalysisId, context);
  });

export const PROJECT_ANCHOR_KINDS = [
  "EXPLICIT_USER_MAPPING",
  "CONFIRMED_SENDER_DOMAIN",
  "CALENDAR_CONTEXT",
  "EXPLICIT_PROJECT_REFERENCE",
  "PRIOR_EMPLOYEE_CORRECTION",
  "GOVERNED_REPOSITORY_BINDING",
] as const;

export const ProjectAnchorSchema = z
  .object({
    kind: z.enum(PROJECT_ANCHOR_KINDS),
    reference: SourceReferenceSchema,
    conflicts: z.boolean(),
  })
  .strict();

export const ProjectLinkDecisionSchema = z.enum(["AUTO_LINK", "REVIEW", "NO_MATCH"]);

export const ProjectLinkSuggestionSchema = z
  .object({
    id: UuidSchema,
    ...governedRevisionShape,
    analysisId: UuidSchema,
    projectId: UuidSchema.nullable(),
    decision: ProjectLinkDecisionSchema,
    explanation: normalizedText(4_000),
    anchors: z.array(ProjectAnchorSchema).max(20),
    supersedesSuggestionId: UuidSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    requireEmployeeRevisionLineage(value, value.supersedesSuggestionId, context);
    if (value.decision !== "AUTO_LINK") return;

    const hasDeterministicMapping = value.anchors.some(
      ({ kind, conflicts }) => kind === "EXPLICIT_USER_MAPPING" && !conflicts,
    );
    const independentKinds = new Set(
      value.anchors.filter(({ conflicts }) => !conflicts).map(({ kind }) => kind),
    );
    const hasConflict = value.anchors.some(({ conflicts }) => conflicts);
    if (
      value.projectId === null ||
      hasConflict ||
      (!hasDeterministicMapping && independentKinds.size < 2)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Automatic Project linking requires an explicit mapping or two non-conflicting independent anchors",
      });
    }
  });

export const TaskDraftSchema = z
  .object({
    title: z.string().min(1).max(240),
    description: z.string().max(8000),
    projectId: z.string().uuid().nullable(),
    workstreamId: z.string().uuid().nullable(),
    proposedAssigneeId: z.string().uuid().nullable(),
    dueAt: z.iso.datetime().nullable(),
    acceptanceConditions: z.array(z.string().min(1)).max(12),
    sourceReferences: z.array(SourceReferenceSchema).min(1),
    uncertainties: z.array(z.string()),
  })
  .strict();

export const TaskDraftRecordSchema = z
  .object({
    id: UuidSchema,
    ...governedRevisionShape,
    draft: TaskDraftSchema,
    supersedesTaskDraftId: UuidSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    requireEmployeeRevisionLineage(value, value.supersedesTaskDraftId, context);
    const governedSources = [...value.sourceReferences].sort();
    const draftSources = [...value.draft.sourceReferences].sort();
    if (
      governedSources.length !== draftSources.length ||
      governedSources.some((source, index) => source !== draftSources[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["draft", "sourceReferences"],
        message: "Task draft provenance must identify the same sources as its governed record",
      });
    }
  });

export const SourceLinkCorrectionActionSchema = z.enum(["CORRECT", "REJECT"]);

export const SourceLinkCorrectionSchema = z
  .object({
    id: UuidSchema,
    suggestionId: UuidSchema,
    employeeId: UuidSchema,
    previousProjectId: UuidSchema.nullable(),
    correctedProjectId: UuidSchema.nullable(),
    action: SourceLinkCorrectionActionSchema,
    reason: ReasonSchema,
    sourceReferences: z.array(SourceReferenceSchema).min(1).max(100),
    supersedingSuggestionId: UuidSchema.nullable(),
    createdAt: UtcInstantSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.action === "CORRECT" &&
      (value.correctedProjectId === null || value.supersedingSuggestionId === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "A Project correction requires the corrected and superseding suggestions",
      });
    }
    if (value.action === "REJECT" && value.correctedProjectId !== null) {
      context.addIssue({
        code: "custom",
        message: "A rejected suggestion cannot name a corrected Project",
      });
    }
  });

export type ContextIntelligenceReviewStatus = z.infer<typeof ContextIntelligenceReviewStatusSchema>;
export type ContextIntelligenceRouteTrace = z.infer<typeof ContextIntelligenceRouteTraceSchema>;
export type ContextAnalysis = z.infer<typeof ContextAnalysisSchema>;
export type ProjectAnchor = z.infer<typeof ProjectAnchorSchema>;
export type ProjectLinkDecision = z.infer<typeof ProjectLinkDecisionSchema>;
export type ProjectLinkSuggestion = z.infer<typeof ProjectLinkSuggestionSchema>;
export type TaskDraft = z.infer<typeof TaskDraftSchema>;
export type TaskDraftRecord = z.infer<typeof TaskDraftRecordSchema>;
export type SourceLinkCorrection = z.infer<typeof SourceLinkCorrectionSchema>;
