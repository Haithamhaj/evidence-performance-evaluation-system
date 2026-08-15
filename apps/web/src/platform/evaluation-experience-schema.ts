import { EvaluationFactViewSchema } from "@evaluation/contracts/evaluation-fact-view";
import { z } from "zod";

const UuidSchema = z.string().uuid();
const InstantSchema = z.iso.datetime({ offset: true });
const RatingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const AssessmentEntrySchema = z
  .object({
    criterionId: UuidSchema,
    rating: RatingSchema,
    justification: z.string().trim().min(1).max(8_000),
    sourceReferences: z.array(UuidSchema).max(100),
    directObservationBasis: z.string().trim().min(1).max(4_000).nullable(),
  })
  .strict();
const AnchorSchema = z
  .object({ rating: RatingSchema, text: z.string().trim().min(1).max(8_000) })
  .strict();
const CriterionLocaleSchema = z
  .object({
    locale: z.enum(["ar", "en"]),
    title: z.string().trim().min(1).max(500),
    definition: z.string().trim().min(1).max(8_000),
    anchors: z.array(AnchorSchema).length(5),
    examples: z.unknown(),
    evidenceGuidance: z.unknown(),
  })
  .strict();
const CriterionSchema = z
  .object({
    id: UuidSchema,
    stableCriterionId: z.string().trim().min(1).max(100),
    kind: z.enum(["FIXED_CRITERION", "PROJECT_CONTRIBUTION"]),
    sectionStableId: z.string().trim().min(1).max(100),
    sectionWeight: z.number().min(0).max(100),
    criterionWeight: z.number().min(0).max(100).nullable(),
    displayOrder: z.number().int().nonnegative(),
    protectedGlobal: z.boolean(),
    mandatory: z.boolean(),
    locales: z.array(CriterionLocaleSchema).min(1).max(2),
  })
  .strict();
const TemplateSnapshotSchema = z
  .object({
    id: UuidSchema,
    versionNumber: z.number().int().positive(),
    schemaVersion: z.number().int().positive(),
    weightPolicy: z.unknown(),
    evaluationPolicy: z.unknown(),
    items: z.array(CriterionSchema).min(1).max(100),
  })
  .strict();
const DraftSchema = z
  .object({
    kind: z.enum(["SELF", "MANAGER_INITIAL"]),
    version: z.number().int().positive(),
    entries: z.array(AssessmentEntrySchema).max(100),
    updatedAt: InstantSchema,
  })
  .strict();
const SubmissionSchema = z
  .object({
    kind: z.enum(["SELF", "MANAGER_INITIAL"]),
    submittedAt: InstantSchema,
    entries: z.array(AssessmentEntrySchema).max(100),
  })
  .strict();

export const EmployeeEvaluationJourneySchema: z.ZodType<
  import("../app/[locale]/evaluations/[cycleId]/evaluation-experience-contracts").EvaluationJourney
> = z
  .object({
    schemaVersion: z.literal(1),
    audience: z.enum(["self", "assigned_manager"]),
    cycle: z
      .object({
        id: UuidSchema,
        type: z.enum(["CALIBRATION_NON_BASELINE", "STANDARD"]),
        state: z.string().trim().min(1).max(100),
        visibilityMode: z.literal("identified"),
        startsAt: InstantSchema,
        endsAt: InstantSchema,
        version: z.number().int().positive(),
      })
      .strict(),
    assignment: z
      .object({
        id: UuidSchema,
        employeeId: UuidSchema,
        managerId: UuidSchema,
        version: z.number().int().positive(),
      })
      .strict(),
    templateSnapshot: TemplateSnapshotSchema.nullable(),
    factViewFirst: z
      .object({
        responsibilityWindows: z.array(z.unknown()),
        workFacts: z.array(z.unknown()),
        researchFacts: z.array(z.unknown()),
        sourceCoverageNotes: z.array(z.unknown()),
      })
      .strict(),
    factView: EvaluationFactViewSchema,
    drafts: z.array(DraftSchema).max(2),
    submissions: z.array(SubmissionSchema).max(2),
    comparison: z.unknown().nullable(),
    discussion: z.array(z.unknown()).max(1_000),
    finalDecision: z.unknown().nullable(),
    acknowledgment: z.unknown().nullable(),
    immutableClosedSnapshot: z.unknown().nullable(),
    independenceGate: z.object({ managerSubmittedBeforeSelfProjection: z.boolean() }).strict(),
  })
  .strict();
