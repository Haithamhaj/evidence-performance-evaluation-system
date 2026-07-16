import { z } from "zod";

import { approvedEnglishRubric } from "../../packages/localization/src/index.js";

export const ALL_PROHIBITED_CONCEPTS = [
  "rating_recommendation",
  "rating_prediction",
  "employee_ranking",
  "productivity_score",
  "activity_volume_inference",
  "readiness_conversion",
] as const;

export const PILOT_ROUTE = "manager-feedback.identified" as const;

export const ProhibitedConceptCodeSchema = z.enum(ALL_PROHIBITED_CONCEPTS);
const approvedCriterionIds = new Set(approvedEnglishRubric.employeeCriteria.map(({ id }) => id));
const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/u);
const SourceReferenceSchema = z.string().min(1);
const DataClassificationSchema = z.enum(["public", "internal", "confidential", "local_only"]);

export const EvalInputSchema = z
  .object({
    sourceContent: z.string().min(1),
    sourceReferences: z.array(SourceReferenceSchema),
    criterionId: z.string().refine((id) => approvedCriterionIds.has(id), {
      message: "criterionId must reference an approved T010 rubric criterion",
    }),
    pilotRoute: z.literal(PILOT_ROUTE).optional(),
  })
  .strict();

export const EvalCaseSchema = z
  .object({
    id: z.string().min(1),
    version: SemverSchema,
    locale: z.string().min(2),
    dialect: z.string().min(1),
    classification: DataClassificationSchema,
    provenance: z.string().min(1),
    input: EvalInputSchema,
    expectedSchemaVersion: z.literal("ai-eval-output.v1"),
    requiredSourceReferences: z.array(SourceReferenceSchema),
    forbiddenConcepts: z
      .array(ProhibitedConceptCodeSchema)
      .length(ALL_PROHIBITED_CONCEPTS.length)
      .refine(
        (codes) => ALL_PROHIBITED_CONCEPTS.every((code) => codes.includes(code)),
        "forbiddenConcepts must contain every protected concept exactly once",
      ),
    expectedDisposition: z.enum(["allow", "reject"]),
    timeoutMs: z.number().int().positive().max(60_000).optional(),
  })
  .strict();

const IdentifiedVisibilitySchema = z
  .object({
    mode: z.literal("Identified"),
    pilotRoute: z.literal(PILOT_ROUTE),
    submitterIdentity: z.string().min(1),
    originalProtectedContent: z.string().optional(),
    managerVisibleFields: z
      .array(z.enum(["identity", "status", "ratings", "comments", "timestamps"]))
      .length(5)
      .refine(
        (fields) =>
          ["identity", "status", "ratings", "comments", "timestamps"].every((field) =>
            fields.includes(field as (typeof fields)[number]),
          ),
        "Identified mode must retain every approved manager-visible field",
      ),
  })
  .strict();

const ManagerBlindedVisibilitySchema = z
  .object({
    mode: z.literal("Manager-Blinded"),
    pilotRoute: z.literal(PILOT_ROUTE),
    managerVisibleFields: z.array(z.enum(["status", "ratings", "summary", "timestamps"])),
  })
  .strict();

const AnonymousAggregatedVisibilitySchema = z
  .object({
    mode: z.literal("Anonymous Aggregated"),
    pilotRoute: z.literal(PILOT_ROUTE),
    managerVisibleFields: z
      .array(z.enum(["aggregates", "repeatedThemes", "completionCount"]))
      .min(1),
  })
  .strict();

export const EvalOutputSchema = z
  .object({
    text: z.string(),
    sourceReferences: z.array(SourceReferenceSchema),
    visibility: z
      .discriminatedUnion("mode", [
        IdentifiedVisibilitySchema,
        ManagerBlindedVisibilitySchema,
        AnonymousAggregatedVisibilitySchema,
      ])
      .optional(),
  })
  .strict();

export const ManifestEntrySchema = z
  .object({
    id: z.string().min(1),
    version: SemverSchema,
    locale: z.string().min(2),
    dialect: z.string().min(1),
    classification: z.enum([
      "public",
      "internal",
      "confidential",
      "local_only",
      "synthetic_non_personal",
    ]),
    provenance: z.string().min(1),
    inputPath: z.string().min(1),
    expectedSchemaVersion: z.enum(["ai-eval-output.v1", "speech-golden.v1"]),
    requiredSourceReferences: z.array(SourceReferenceSchema),
    forbiddenConcepts: z.array(ProhibitedConceptCodeSchema).min(1),
    expectedDisposition: z.enum(["allow", "reject", "integrity_only"]),
  })
  .strict();

export const ManifestSchema = z.array(ManifestEntrySchema).min(1);

export const TextFixtureSchema = z
  .object({
    evalCase: EvalCaseSchema,
    adapterOutput: z.unknown(),
  })
  .strict()
  .refine((fixture) => Object.hasOwn(fixture, "adapterOutput"), "adapterOutput is required");

export const VisibilityFixtureSchema = z.array(TextFixtureSchema).length(3);

export const SpeechGoldenRowSchema = z
  .object({
    fixtureId: z.string().min(1),
    dialect: z.enum(["gulf", "levantine"]),
    locale: z.string().min(2),
    audioPath: z.string().min(1),
    goldenTranscript: z.string().min(1),
    tolerance: z.number().min(0).max(1),
    source: z.string().min(1),
    license: z.string().min(1),
    provenance: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    privacyClassification: z.literal("synthetic_non_personal"),
    expectedDisposition: z.literal("integrity_only"),
  })
  .strict();

export const SpeechGoldenSchema = z.array(SpeechGoldenRowSchema).length(2);

export type EvalCaseContract = z.infer<typeof EvalCaseSchema>;
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;
