import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const SafeTextSchema = z.string().trim().min(1).max(4_000);
const LocalHrefSchema = z
  .string()
  .trim()
  .min(2)
  .max(2_000)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "href must be a local application path",
  });

export const EmployeeExperienceSourceRefV1Schema = z
  .object({
    kind: z.enum([
      "progress_contract",
      "project_document",
      "work_item",
      "update",
      "evidence",
      "github",
      "google_gmail",
      "google_calendar",
      "manual_capture",
      "human_decision",
    ]),
    label: z.string().trim().min(1).max(240),
    observedAt: UtcInstantSchema.nullable().optional(),
    freshness: z.enum(["fresh", "possibly_stale", "stale", "unknown"]),
  })
  .strict();

export const OperationalProgressV1Schema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("accepted"),
      percent: z.number().min(0).max(100),
      source: EmployeeExperienceSourceRefV1Schema,
      explanation: z.string().trim().min(1).max(1_000),
    })
    .strict(),
  z.object({ state: z.literal("awaiting_contract") }).strict(),
  z
    .object({
      state: z.literal("awaiting_information"),
      missing: z.array(z.string().trim().min(1).max(500)).min(1).max(50),
    })
    .strict(),
]);

export const EmployeeExperienceMilestoneV1Schema = z
  .object({
    componentId: UuidSchema,
    name: z.string().trim().min(1).max(500),
    kind: z.enum(["milestone", "deliverable", "operational_kpi"]),
    state: z.enum(["complete", "current", "next", "awaiting_evidence", "not_started"]),
    percent: z.number().min(0).max(100).nullable(),
  })
  .strict();

const KpiV1Schema = z
  .object({
    componentId: UuidSchema,
    name: z.string().trim().min(1).max(500),
    baseline: z.number(),
    current: z.number(),
    target: z.number(),
    unit: z.string().trim().min(1).max(80),
    direction: z.enum(["increase", "decrease", "maintain"]),
    source: EmployeeExperienceSourceRefV1Schema,
  })
  .strict();

const ActionV1Schema = z
  .object({ label: z.string().trim().min(1).max(240), href: LocalHrefSchema })
  .strict();

const SmartBriefV1Schema = z
  .object({
    title: z.string().trim().min(1).max(240),
    body: SafeTextSchema,
    source: EmployeeExperienceSourceRefV1Schema,
    why: z.string().trim().min(1).max(1_000),
    consequence: z.string().trim().min(1).max(1_000),
    action: ActionV1Schema,
  })
  .strict();

const ProjectSummaryV1Schema = z
  .object({
    id: UuidSchema,
    name: z.string().trim().min(1).max(240),
    description: z.string().trim().max(2_000),
    status: z.enum(["active", "paused"]),
    progress: OperationalProgressV1Schema,
    milestones: z.array(EmployeeExperienceMilestoneV1Schema).max(100),
    kpi: KpiV1Schema.nullable(),
    nextAction: ActionV1Schema.nullable(),
  })
  .strict();

const TimelineItemV1Schema = z
  .object({
    id: z.string().trim().min(1).max(256),
    kind: z.enum(["decision", "meeting", "task", "verified_change", "update", "evidence"]),
    occurredAt: UtcInstantSchema,
    title: z.string().trim().min(1).max(500),
    projectId: UuidSchema,
    projectName: z.string().trim().min(1).max(240),
    statusLabel: z.string().trim().min(1).max(240),
    detail: z.string().trim().min(1).max(4_000).optional(),
    contextLabel: z.string().trim().min(1).max(1_000).optional(),
    href: LocalHrefSchema,
    source: EmployeeExperienceSourceRefV1Schema,
  })
  .strict();

export const EmployeeHomeV1Schema = guarded(
  z
    .object({
      schemaVersion: z.literal("employee-home.v1"),
      generatedAt: UtcInstantSchema,
      greetingName: z.string().trim().min(1).max(240),
      signals: z
        .object({
          decisions: z.number().int().nonnegative(),
          dueToday: z.number().int().nonnegative(),
          verifiedChanges: z.number().int().nonnegative(),
        })
        .strict(),
      projects: z.array(ProjectSummaryV1Schema).max(20),
      smartBrief: SmartBriefV1Schema.nullable(),
      now: z.array(TimelineItemV1Schema).max(50),
    })
    .strict(),
);

const ProjectCollectionItemV1Schema = z
  .object({
    id: z.string().trim().min(1).max(256),
    title: z.string().trim().min(1).max(500),
    subtitle: z.string().trim().max(1_000),
    href: LocalHrefSchema.nullable(),
    source: EmployeeExperienceSourceRefV1Schema,
  })
  .strict();

const ProjectProgressReviewV1Schema = z
  .object({
    contract: z
      .object({
        contractVersion: z.number().int().positive(),
        calculationKind: z.enum(["weighted", "stage_gate"]),
        effectiveAt: UtcInstantSchema,
        components: z
          .array(
            z
              .object({
                componentId: UuidSchema,
                name: z.string().trim().min(1).max(500),
                kind: z.enum(["milestone", "deliverable", "operational_kpi"]),
                weight: z.number().min(0).max(100).nullable(),
                requiredEvidence: z.array(z.string().trim().min(1).max(500)).max(50),
              })
              .strict(),
          )
          .max(100),
      })
      .strict()
      .nullable(),
    latestSnapshot: z
      .object({
        percent: z.number().min(0).max(100),
        previousPercent: z.number().min(0).max(100).nullable(),
        reason: z.string().trim().min(1).max(1_000),
        observedAt: UtcInstantSchema,
        source: EmployeeExperienceSourceRefV1Schema,
      })
      .strict()
      .nullable(),
    pendingChange: z
      .object({
        state: z.enum(["pending", "failed"]),
        requestedAt: UtcInstantSchema,
      })
      .strict()
      .nullable(),
    ambiguities: z.array(z.string().trim().min(1).max(500)).max(50),
  })
  .strict();

const ProjectDocumentWorkspaceV1Schema = z
  .object({
    currentVersion: z.number().int().positive(),
    sourceAvailability: z.enum(["available", "missing"]),
    history: z
      .array(
        z
          .object({
            version: z.number().int().positive(),
            reason: z.string().trim().min(1).max(1_000),
            createdAt: UtcInstantSchema,
            sourceCount: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(100),
    sources: z
      .array(
        z
          .object({
            kind: z.enum(["upload", "external_link", "github"]),
            label: z.string().trim().min(1).max(500),
            href: z.url().nullable(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

const ProjectCriteriaContractV1Schema = z
  .object({
    sourceDocumentVersion: z.number().int().positive().nullable(),
    status: z.enum([
      "source_required",
      "proposal_required",
      "proposal_pending",
      "review_required",
      "recovery_required",
      "active",
    ]),
    proposal: z
      .object({
        state: z.enum(["pending", "ready", "failed", "applied", "rejected"]),
        revision: z.number().int().positive().nullable(),
        origin: z.enum(["ai", "human"]).nullable(),
        componentCount: z.number().int().nonnegative(),
        ambiguityCount: z.number().int().nonnegative(),
        requestedAt: UtcInstantSchema,
      })
      .strict()
      .nullable(),
    nextAction: z.enum([
      "connect_document",
      "request_proposal",
      "wait_for_proposal",
      "review_proposal",
      "recover_proposal",
      "review_active_contract",
    ]),
    actionOwner: z.enum(["employee", "project_owner"]),
  })
  .strict();

export const EmployeeProjectExperienceV1Schema = guarded(
  z
    .object({
      schemaVersion: z.literal("employee-project-experience.v1"),
      generatedAt: UtcInstantSchema,
      project: z
        .object({
          id: UuidSchema,
          name: z.string().trim().min(1).max(240),
          description: z.string().trim().max(2_000),
          status: z.enum(["active", "paused"]),
          ownerName: z.string().trim().min(1).max(240).nullable(),
          workstreams: z
            .array(z.object({ id: UuidSchema, name: z.string().trim().min(1).max(240) }).strict())
            .max(100),
        })
        .strict(),
      document: z
        .object({
          id: UuidSchema,
          title: z.string().trim().min(1).max(500),
          version: z.number().int().positive(),
          source: EmployeeExperienceSourceRefV1Schema,
          href: LocalHrefSchema,
        })
        .strict()
        .nullable(),
      documentWorkspace: ProjectDocumentWorkspaceV1Schema.optional(),
      criteriaContract: ProjectCriteriaContractV1Schema.optional(),
      progress: OperationalProgressV1Schema,
      progressReview: ProjectProgressReviewV1Schema.optional(),
      milestones: z.array(EmployeeExperienceMilestoneV1Schema).max(100),
      kpi: KpiV1Schema.nullable(),
      attention: z.array(ProjectCollectionItemV1Schema).max(50),
      collections: z
        .object({
          work: z.array(ProjectCollectionItemV1Schema).max(100),
          updates: z.array(ProjectCollectionItemV1Schema).max(100),
          evidence: z.array(ProjectCollectionItemV1Schema).max(100),
          documents: z.array(ProjectCollectionItemV1Schema).max(100),
        })
        .strict(),
      timeline: z.array(TimelineItemV1Schema).max(50),
      nextCursor: z.string().trim().min(1).max(1_000).nullable(),
      smartBrief: SmartBriefV1Schema.nullable(),
    })
    .strict(),
);

export const CaptureUnderstandingV1Schema = guarded(
  z
    .object({
      schemaVersion: z.literal("capture-understanding.v1"),
      likelyProject: z
        .object({
          id: UuidSchema,
          name: z.string().trim().min(1).max(240),
          confidence: z.enum(["high", "uncertain"]),
        })
        .strict()
        .nullable(),
      likelyMeaning: z.enum(["private_note", "task", "project_update", "suggested_evidence"]),
      relatedWorkItemId: UuidSchema.nullable(),
      relatedWorkItemTitle: z.string().trim().min(1).max(500).nullable(),
      relatedComponentId: UuidSchema.nullable(),
      sourceRefs: z.array(EmployeeExperienceSourceRefV1Schema).max(20),
      clarification: z
        .object({
          question: z.string().trim().min(1).max(1_000),
          missingField: z.string().trim().min(1).max(100),
        })
        .strict()
        .nullable(),
      confidence: z.enum(["high", "uncertain"]),
      createsOfficialRecord: z.literal(false),
    })
    .strict(),
);

const NamedEntityV1Schema = z
  .object({ id: UuidSchema, name: z.string().trim().min(1).max(240) })
  .strict();

export const ReviewConfirmationDraftV1Schema = guarded(
  z
    .object({
      schemaVersion: z.literal("review-confirmation-draft.v1"),
      captureId: UuidSchema,
      project: NamedEntityV1Schema,
      workItem: z
        .object({ id: UuidSchema, title: z.string().trim().min(1).max(500) })
        .strict()
        .nullable(),
      update: z
        .object({
          sessionId: UuidSchema,
          expectedVersion: z.number().int().positive(),
          editable: z.literal(true),
          selected: z.boolean(),
          summary: z.string().trim().min(1).max(2_000),
          result: SafeTextSchema,
          nextAction: z.string().trim().min(1).max(2_000),
          sourceRefs: z.array(EmployeeExperienceSourceRefV1Schema).min(1).max(20),
        })
        .strict()
        .nullable(),
      evidence: z
        .array(
          z
            .object({
              draftId: UuidSchema,
              expectedRevision: z.number().int().positive(),
              selected: z.boolean(),
              employeeEditRequired: z.boolean(),
              employeeEdited: z.boolean(),
              supportedClaim: z.string().trim().min(1).max(2_000),
              contributionContext: z.string().trim().min(1).max(2_000),
              sourceRefs: z.array(EmployeeExperienceSourceRefV1Schema).min(1).max(20),
            })
            .strict()
            .superRefine((value, context) => {
              if (value.selected && value.employeeEditRequired && !value.employeeEdited) {
                context.addIssue({
                  code: "custom",
                  path: ["employeeEdited"],
                  message: "selected evidence requiring an employee edit must be edited first",
                });
              }
            }),
        )
        .max(20),
      progressProposal: z
        .object({
          componentId: UuidSchema,
          selected: z.boolean(),
          proposedValue: z.string().trim().min(1).max(240),
          rationale: z.string().trim().min(1).max(2_000),
          mutatesOfficialProgress: z.literal(false),
          requiresOwnerConfirmation: z.boolean(),
          sourceRefs: z.array(EmployeeExperienceSourceRefV1Schema).min(1).max(20),
        })
        .strict()
        .nullable(),
      uncertainty: z.string().trim().min(1).max(2_000).nullable(),
      afterConfirmation: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20),
    })
    .strict(),
);

export const ReviewConfirmationResultV1Schema = z
  .object({
    schemaVersion: z.literal("review-confirmation-result.v1"),
    completedAt: UtcInstantSchema,
    outcomes: z
      .array(
        z
          .object({
            kind: z.enum(["update", "evidence", "progress_proposal", "private_draft"]),
            state: z.enum([
              "confirmed",
              "saved_private",
              "skipped",
              "retryable_error",
              "stale",
              "forbidden",
            ]),
            receiptId: UuidSchema.nullable(),
            safeMessage: z.string().trim().min(1).max(1_000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

function guarded<T extends z.ZodType>(schema: T) {
  return schema.superRefine((value, context) => {
    for (const text of strings(value)) {
      if (prohibitedMeaning(text)) {
        context.addIssue({
          code: "custom",
          message: "employee performance scoring and activity-volume progress are prohibited",
        });
        return;
      }
    }
  });
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap(strings);
}

function prohibitedMeaning(text: string): boolean {
  const value = text.toLowerCase();
  return [
    /(?:recommended|suggested|predicted|employee|performance)\s+(?:performance\s+)?rating/u,
    /(?:employee|performance)\s+(?:rank|ranking|leaderboard)/u,
    /(?:employee\s+)?productivity\s+(?:score|rating|index)/u,
    /(?:project\s+)?progress[^.]{0,100}(?:because|based on|from)[^.]{0,80}(?:task|commit|update|file|line)(?:s|\s+count|\s+volume)?/u,
    /(?:task|commit|update|file|line)(?:s|\s+count|\s+volume)?[^.]{0,100}(?:calculat|determin|prove|show)[^.]{0,40}(?:project\s+)?progress/u,
    /(?:التقييم|تصنيف)\s+(?:المقترح|المتوقع)?\s*(?:للموظف|للأداء)/u,
    /تقدم\s+المشروع[^.]{0,80}(?:عدد|حجم)[^.]{0,50}(?:المهام|التحديثات|الالتزامات|الملفات)/u,
  ].some((pattern) => pattern.test(value));
}

export type EmployeeExperienceSourceRefV1 = z.infer<typeof EmployeeExperienceSourceRefV1Schema>;
export type OperationalProgressV1 = z.infer<typeof OperationalProgressV1Schema>;
export type EmployeeHomeV1 = z.infer<typeof EmployeeHomeV1Schema>;
export type EmployeeProjectExperienceV1 = z.infer<typeof EmployeeProjectExperienceV1Schema>;
export type CaptureUnderstandingV1 = z.infer<typeof CaptureUnderstandingV1Schema>;
export type ReviewConfirmationDraftV1 = z.infer<typeof ReviewConfirmationDraftV1Schema>;
export type ReviewConfirmationResultV1 = z.infer<typeof ReviewConfirmationResultV1Schema>;
