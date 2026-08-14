import { z } from "zod";

const UuidSchema = z.string().uuid();
const PublicComponentSchema = z
  .object({
    position: z.number().int().positive().max(12),
    kind: z.enum(["milestone", "deliverable", "operational_kpi"]),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2_000),
    weight: z.number().nonnegative().max(100).nullable(),
    baseline: z.number().finite().nullable(),
    target: z.number().finite().nullable(),
    unit: z.string().trim().min(1).max(80).nullable(),
    direction: z.enum(["increase", "decrease", "maintain"]).nullable(),
    acceptanceConditions: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    requiredEvidence: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    confirmationMode: z.enum(["deterministic", "human_confirmed"]),
    sourceLabels: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
    automationHints: z
      .array(
        z
          .object({
            source: z.literal("github"),
            event: z.enum(["pull_request_merged", "required_checks_passed", "release_published"]),
            repositoryLabel: z.string().trim().min(1).max(300),
            branchLabel: z.string().trim().min(1).max(300).nullable(),
            checkLabels: z.array(z.string().trim().min(1).max(200)).max(20),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export const PublicProgressContractDraftContentSchema = z
  .object({
    components: z.array(PublicComponentSchema).min(1).max(12),
    ambiguities: z.array(z.string().trim().min(1).max(500)).max(12),
    clarificationQuestions: z.array(z.string().trim().min(1).max(500)).max(12),
  })
  .strict();

export const PublicProgressContractDraftSchema = z
  .object({
    requestId: UuidSchema,
    state: z.enum(["pending", "ready", "failed", "applied", "rejected"]),
    revision: z.number().int().positive().nullable(),
    origin: z.enum(["ai", "human"]).nullable(),
    source: z
      .object({
        label: z.string().trim().min(1).max(200),
        version: z.number().int().positive(),
      })
      .strict(),
    draft: PublicProgressContractDraftContentSchema.nullable(),
    contract: z
      .object({
        id: UuidSchema,
        state: z.enum(["draft", "pending_approval", "active", "superseded", "rejected"]),
        version: z.number().int().positive(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const CreateProgressContractDraftInputSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(200),
    documentVersionId: UuidSchema,
    sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/u),
    locale: z.enum(["ar", "en"]),
    timezone: z.string().trim().min(1).max(100),
    effectiveAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

const EditableComponentSchema = PublicComponentSchema.omit({
  automationHints: true,
  sourceLabels: true,
});
export const ReviseProgressContractDraftInputSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    content: z
      .object({
        components: z.array(EditableComponentSchema).min(1).max(12),
        ambiguities: z.array(z.string().trim().min(1).max(500)).max(12),
        clarificationQuestions: z.array(z.string().trim().min(1).max(500)).max(12),
      })
      .strict(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const ApplyProgressContractDraftInputSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    selectedRevision: z.number().int().positive(),
    calculationKind: z.enum(["weighted", "stage_gate"]),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const RejectProgressContractDraftInputSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const ProgressContractDecisionBodySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const AppliedProgressContractDraftSchema = z
  .object({
    requestId: UuidSchema,
    selectedRevision: z.number().int().positive(),
    contract: z
      .object({
        id: UuidSchema,
        state: z.literal("draft"),
        version: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();
export const PublicProgressContractDecisionResultSchema = z
  .object({
    id: UuidSchema,
    state: z.enum(["draft", "pending_approval", "active", "superseded", "rejected"]),
    version: z.number().int().positive(),
  })
  .passthrough()
  .transform(({ id, state, version }) => ({ id, state, version }));

export type PublicProgressContractDraft = z.infer<typeof PublicProgressContractDraftSchema>;
export type PublicProgressContractDraftContent = z.infer<
  typeof PublicProgressContractDraftContentSchema
>;
export type ProgressContractReviewState = Readonly<{
  id: string;
  state: "draft" | "pending_approval" | "active" | "rejected" | "superseded";
  version: number;
}>;
