import { z } from "zod";

const UuidSchema = z.string().uuid();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

const ArtifactPinsShape = {
  schemaArtifactId: UuidSchema,
  schemaArtifactHash: Sha256Schema,
  promptArtifactId: UuidSchema,
  promptArtifactHash: Sha256Schema,
  expectedSnapshotVersion: z.number().int().nonnegative(),
} as const;

const ReadinessJobPayloadSchema = z
  .object({
    type: z.literal("document.readiness.v1"),
    requestId: UuidSchema,
    documentVersionId: UuidSchema,
    ...ArtifactPinsShape,
  })
  .strict();

const ComparisonJobPayloadSchema = z
  .object({
    type: z.literal("document.comparison.v1"),
    requestId: UuidSchema,
    beforeDocumentVersionId: UuidSchema,
    afterDocumentVersionId: UuidSchema,
    ...ArtifactPinsShape,
  })
  .strict()
  .refine((value) => value.beforeDocumentVersionId !== value.afterDocumentVersionId, {
    path: ["afterDocumentVersionId"],
    message: "Comparison requires two distinct immutable versions",
  });

const CriteriaGenerationJobPayloadSchema = z
  .object({
    type: z.literal("criteria.generate.v1"),
    kind: z.enum(["project", "workstream"]),
    requestId: UuidSchema,
    documentVersionId: UuidSchema,
    readinessCheckId: UuidSchema,
    replacesProposalId: UuidSchema.optional(),
    ...ArtifactPinsShape,
  })
  .strict();

export const AnalysisCriteriaJobPayloadSchema = z.discriminatedUnion("type", [
  ReadinessJobPayloadSchema,
  ComparisonJobPayloadSchema,
  CriteriaGenerationJobPayloadSchema,
]);

export type AnalysisCriteriaJobPayload = z.infer<typeof AnalysisCriteriaJobPayloadSchema>;
