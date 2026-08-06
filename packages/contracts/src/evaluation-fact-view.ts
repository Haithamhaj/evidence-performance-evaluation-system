import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });

export const EvaluationFactSourceReferenceSchema = z
  .object({
    sourceType: z.enum([
      "responsibility_window",
      "timeline_event",
      "evidence",
      "check_in",
      "criterion_version",
      "document_version",
      "github_event",
      "approved_leave",
      "research_revision",
      "research_source",
      "experiment_method",
      "experiment_run",
      "experiment_conclusion",
      "research_conclusion",
      "applied_learning",
    ]),
    sourceId: UuidSchema,
    sourceVersion: z.number().int().positive().nullable(),
    occurredAt: UtcInstantSchema,
    url: z.url().max(2_000).nullable(),
  })
  .strict();

const SourceFactIdentitySchema = z
  .object({
    kind: z.literal("source_fact"),
    sourceId: UuidSchema,
    sourceOccurredAt: UtcInstantSchema,
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    sourceReferences: z.array(EvaluationFactSourceReferenceSchema).min(1),
  })
  .strict();

export const ResponsibilityWindowFactSchema = SourceFactIdentitySchema.extend({
  sourceType: z.literal("responsibility_window"),
  responsibilityType: z.enum(["original_owner", "acting_owner", "permanent_owner", "contributor"]),
  startedAt: UtcInstantSchema,
  endedAt: UtcInstantSchema.nullable(),
})
  .strict()
  .superRefine((window, context) => {
    if (window.endedAt !== null && Date.parse(window.endedAt) < Date.parse(window.startedAt)) {
      context.addIssue({
        code: "custom",
        path: ["endedAt"],
        message: "A responsibility window cannot end before it starts.",
      });
    }
  });

export const FactVerificationStateSchema = z.enum([
  "source_supported",
  "partially_supported",
  "self_reported",
  "conflicting",
  "unable_to_verify",
  "peer_acknowledged",
]);

export const FactAttributionStateSchema = z.enum([
  "employee_confirmed",
  "peer_acknowledged",
  "disputed",
  "clarified",
  "team_contribution",
  "unable_to_attribute",
]);

export const ProjectContributionFactSchema = SourceFactIdentitySchema.extend({
  sourceType: z.literal("project_contribution"),
  relatedWorkItemId: UuidSchema.nullable(),
  criterionStableId: z.string().trim().min(1).max(100).nullable(),
  criterionVersionId: UuidSchema.nullable(),
  summary: z.string().trim().min(1).max(4_000),
  result: z.string().trim().min(1).max(4_000).nullable(),
  verificationState: FactVerificationStateSchema,
  attributionState: FactAttributionStateSchema,
  responsibilityWindowIds: z.array(UuidSchema),
}).strict();

export const ConfirmedEvidenceFactSchema = SourceFactIdentitySchema.extend({
  sourceType: z.literal("confirmed_evidence"),
  relatedWorkItemId: UuidSchema.nullable(),
  relatedCriterionStableId: z.string().trim().min(1).max(100).nullable(),
  supportedClaim: z.string().trim().min(1).max(4_000),
  contributionContext: z.string().trim().min(1).max(4_000),
  verificationState: FactVerificationStateSchema,
  attributionState: FactAttributionStateSchema,
}).strict();

export const CheckInFactSchema = SourceFactIdentitySchema.extend({
  sourceType: z.literal("check_in"),
  checkInType: z.enum(["workstream", "project"]),
  status: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(4_000),
}).strict();

export const CriterionVersionFactSchema = SourceFactIdentitySchema.extend({
  sourceType: z.literal("criterion_version"),
  criterionStableId: z.string().trim().min(1).max(100),
  criterionVersionId: UuidSchema,
  locale: z.enum(["ar", "en"]),
  name: z.string().trim().min(1).max(500),
  effectiveFrom: UtcInstantSchema,
  effectiveUntil: UtcInstantSchema.nullable(),
})
  .strict()
  .superRefine((criterion, context) => {
    if (
      criterion.effectiveUntil !== null &&
      Date.parse(criterion.effectiveUntil) < Date.parse(criterion.effectiveFrom)
    ) {
      context.addIssue({
        code: "custom",
        path: ["effectiveUntil"],
        message: "A criterion version cannot end before it becomes effective.",
      });
    }
  });

export const EmployeeInterpretationSchema = z
  .object({
    kind: z.literal("employee_interpretation"),
    id: UuidSchema,
    originalText: z.string().trim().min(1).max(20_000),
    normalizedText: z.string().trim().min(1).max(20_000),
    sourceFactIds: z.array(UuidSchema),
    createdAt: UtcInstantSchema,
  })
  .strict();

export const ResearchEvaluationFactSchema = SourceFactIdentitySchema.extend({
  sourceType: z.literal("research"),
  factType: z.enum([
    "research_question",
    "source_synthesis",
    "experiment_method",
    "experiment_run",
    "experiment_conclusion",
    "research_decision",
    "applied_learning",
  ]),
  relatedWorkItemId: UuidSchema.nullable(),
  humanConfirmationState: z.enum(["employee_confirmed", "human_decision"]),
  verificationState: FactVerificationStateSchema,
  responsibilityWindowIds: z.array(UuidSchema),
  summary: z.string().trim().min(1).max(4_000),
  limitations: z.array(z.string().trim().min(1).max(2_000)).max(100),
  uncertainty: z.string().trim().min(1).max(4_000).nullable(),
}).strict();

export const SourceCoverageNoteSchema = z
  .object({
    kind: z.literal("coverage_note"),
    code: z.enum([
      "missing_source",
      "partial_period",
      "unverified_claim",
      "disputed_attribution",
      "approved_leave_excluded",
      "incomplete_context",
    ]),
    scope: z.enum(["cycle", "project", "workstream", "criterion", "evidence"]),
    projectId: UuidSchema.nullable(),
    workstreamId: UuidSchema.nullable(),
    messageKey: z.string().trim().min(1).max(200),
    sourceFactIds: z.array(UuidSchema),
    neutral: z.literal(true),
  })
  .strict();

const EvaluationFactCycleSchema = z
  .object({
    id: UuidSchema,
    startsAt: UtcInstantSchema,
    endsAt: UtcInstantSchema,
    rubricVersionId: UuidSchema,
  })
  .strict()
  .superRefine((cycle, context) => {
    if (Date.parse(cycle.endsAt) < Date.parse(cycle.startsAt)) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "An evaluation cycle cannot end before it starts.",
      });
    }
  });

export const EvaluationFactViewSchema = z
  .object({
    schemaVersion: z.literal(2),
    cycle: EvaluationFactCycleSchema,
    subjectEmployeeId: UuidSchema,
    generatedAt: UtcInstantSchema,
    responsibilityWindows: z.array(ResponsibilityWindowFactSchema),
    projectFacts: z.array(ProjectContributionFactSchema),
    confirmedEvidence: z.array(ConfirmedEvidenceFactSchema),
    checkInFacts: z.array(CheckInFactSchema),
    dynamicCriteriaVersions: z.array(CriterionVersionFactSchema),
    researchFacts: z.array(ResearchEvaluationFactSchema),
    employeeInterpretations: z.array(EmployeeInterpretationSchema),
    sourceCoverageNotes: z.array(SourceCoverageNoteSchema),
  })
  .strict();

export type EvaluationFactSourceReference = z.infer<typeof EvaluationFactSourceReferenceSchema>;
export type ResponsibilityWindowFact = z.infer<typeof ResponsibilityWindowFactSchema>;
export type ProjectContributionFact = z.infer<typeof ProjectContributionFactSchema>;
export type ConfirmedEvidenceFact = z.infer<typeof ConfirmedEvidenceFactSchema>;
export type CheckInFact = z.infer<typeof CheckInFactSchema>;
export type CriterionVersionFact = z.infer<typeof CriterionVersionFactSchema>;
export type EmployeeInterpretation = z.infer<typeof EmployeeInterpretationSchema>;
export type ResearchEvaluationFact = z.infer<typeof ResearchEvaluationFactSchema>;
export type SourceCoverageNote = z.infer<typeof SourceCoverageNoteSchema>;
export type EvaluationFactView = z.infer<typeof EvaluationFactViewSchema>;
