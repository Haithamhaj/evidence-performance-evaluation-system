import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const PositiveVersionSchema = z.number().int().positive();
const PercentSchema = z.number().min(0).max(100);

export const ProgressScopeKindSchema = z.enum(["project", "workstream"]);
export const ProgressContractStateSchema = z.enum([
  "draft",
  "pending_approval",
  "active",
  "superseded",
  "rejected",
]);
export const ProgressCalculationKindSchema = z.enum(["weighted", "stage_gate"]);
export const ProgressComponentKindSchema = z.enum([
  "milestone",
  "deliverable",
  "kpi",
  "acceptance",
]);
export const ProgressDirectionSchema = z.enum(["increase", "decrease", "maintain"]);
export const ProgressConfirmationModeSchema = z.enum(["measured", "human_confirmed"]);

const ProgressContractAiDraftComponentRegistrationSchema = z
  .object({
    clientKey: z.string().min(1).max(80),
    kind: z.enum(["milestone", "deliverable", "operational_kpi"]),
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(2_000),
    weight: z.number().nonnegative().max(100).nullable(),
    baseline: z.number().finite().nullable(),
    target: z.number().finite().nullable(),
    unit: z.string().min(1).max(80).nullable(),
    direction: z.enum(["increase", "decrease", "maintain"]).nullable(),
    acceptanceConditions: z.array(z.string().min(1).max(500)).min(1).max(12),
    requiredEvidence: z.array(z.string().min(1).max(500)).min(1).max(12),
    confirmationMode: z.enum(["deterministic", "human_confirmed"]),
    proposedSourceMappings: z
      .array(
        z
          .object({
            source: z.literal("github"),
            event: z.enum(["pull_request_merged", "required_checks_passed", "release_published"]),
            repositoryRef: z.string().min(1).max(300),
            branchRef: z.string().min(1).max(300).nullable(),
            checkNames: z.array(z.string().min(1).max(200)).max(20),
          })
          .strict(),
      )
      .max(10),
    sourceReferences: z.array(z.string().min(1).max(500)).min(1).max(20),
  })
  .strict();

export const ProgressContractAiDraftComponentSchema = z
  .object({
    clientKey: z.string().trim().min(1).max(80),
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
    proposedSourceMappings: z
      .array(
        z
          .object({
            source: z.literal("github"),
            event: z.enum(["pull_request_merged", "required_checks_passed", "release_published"]),
            repositoryRef: z.string().trim().min(1).max(300),
            branchRef: z.string().trim().min(1).max(300).nullable(),
            checkNames: z.array(z.string().trim().min(1).max(200)).max(20),
          })
          .strict(),
      )
      .max(10),
    sourceReferences: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  })
  .strict()
  .superRefine(validateKpiMetadata);

const ProgressContractAiDraftOutputCoreSchema = z
  .object({
    components: z.array(ProgressContractAiDraftComponentRegistrationSchema).min(1).max(12),
    ambiguities: z.array(z.string().min(1).max(500)).max(12),
    clarificationQuestions: z.array(z.string().min(1).max(500)).max(12),
  })
  .strict();

export const ProgressContractAiDraftOutputSchema = z
  .object({
    components: z.array(ProgressContractAiDraftComponentSchema).min(1).max(12),
    ambiguities: z.array(z.string().trim().min(1).max(500)).max(12),
    clarificationQuestions: z.array(z.string().trim().min(1).max(500)).max(12),
  })
  .strict()
  .superRefine(validateAiDraftShape);

// The AI Router persists canonical JSON Schema, which cannot represent cross-field rules.
// Callers must parse provider output with ProgressContractAiDraftOutputSchema before use.
export const ProgressContractAiDraftOutputRegistrationSchema =
  ProgressContractAiDraftOutputCoreSchema;

function validateKpiMetadata(
  value: z.infer<typeof ProgressContractAiDraftComponentRegistrationSchema>,
  context: z.RefinementCtx,
): void {
  if (
    value.kind === "operational_kpi" &&
    (value.baseline === null ||
      value.target === null ||
      value.unit === null ||
      value.direction === null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["baseline"],
      message: "operational KPI components require baseline, target, unit and direction",
    });
  }
}

function validateAiDraftShape(
  value: z.infer<typeof ProgressContractAiDraftOutputSchema>,
  context: z.RefinementCtx,
): void {
  const clientKeys = new Set<string>();
  for (const [index, component] of value.components.entries()) {
    if (clientKeys.has(component.clientKey)) {
      context.addIssue({
        code: "custom",
        path: ["components", index, "clientKey"],
        message: "AI draft component client keys must be unique",
      });
    }
    clientKeys.add(component.clientKey);
  }

  const weights = value.components.map((component) => component.weight);
  const hasWeight = weights.some((weight) => weight !== null);
  if (hasWeight && weights.some((weight) => weight === null)) {
    context.addIssue({
      code: "custom",
      path: ["components"],
      message: "AI draft component weights must be supplied for every component or none",
    });
  } else if (hasWeight) {
    const total = weights.reduce<number>((sum, weight) => sum + (weight ?? 0), 0);
    if (Math.abs(total - 100) > Number.EPSILON) {
      context.addIssue({
        code: "custom",
        path: ["components"],
        message: "AI draft component weights must total exactly 100",
      });
    }
  }
}

export const ProgressContractComponentSchema = z
  .object({
    id: UuidSchema,
    kind: ProgressComponentKindSchema,
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2_000),
    weight: z.number().min(0).max(100).nullable(),
    baseline: z.number().finite().nullable().default(null),
    target: z.number().finite().nullable().default(null),
    unit: z.string().trim().min(1).max(80).nullable().default(null),
    direction: ProgressDirectionSchema.nullable().default(null),
    acceptanceConditions: z.array(z.string().trim().min(1).max(500)).min(1).max(50),
    requiredEvidence: z.array(z.string().trim().min(1).max(120)).max(50),
    confirmationMode: ProgressConfirmationModeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.kind === "kpi" &&
      (value.baseline === null ||
        value.target === null ||
        value.unit === null ||
        value.direction === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["baseline"],
        message: "KPI components require baseline, target, unit and direction",
      });
    }
    if (value.confirmationMode === "measured" && value.kind !== "kpi") {
      context.addIssue({
        code: "custom",
        path: ["confirmationMode"],
        message: "Only KPI components may use measured confirmation",
      });
    }
  });

const ProgressContractCoreSchema = z
  .object({
    scopeKind: ProgressScopeKindSchema,
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    sourceDocumentId: UuidSchema,
    sourceDocumentVersionId: UuidSchema,
    sourceDocumentVersion: PositiveVersionSchema,
    calculationKind: ProgressCalculationKindSchema,
    calculationSchemaVersion: z.string().regex(/^[1-9]\d*\.\d+\.\d+$/u),
    effectiveAt: UtcInstantSchema,
    components: z.array(ProgressContractComponentSchema).min(1).max(100),
  })
  .strict();

function validateContractShape(
  value: z.infer<typeof ProgressContractCoreSchema>,
  context: z.RefinementCtx,
): void {
  if ((value.scopeKind === "workstream") !== (value.workstreamId !== null)) {
    context.addIssue({
      code: "custom",
      path: ["workstreamId"],
      message: "workstream scope requires workstreamId and project scope forbids it",
    });
  }

  const weights = value.components.map((component) => component.weight);
  if (value.calculationKind === "weighted") {
    if (weights.some((weight) => weight === null)) {
      context.addIssue({
        code: "custom",
        path: ["components"],
        message: "weighted contracts require every component weight",
      });
    } else {
      const total = weights.reduce<number>((sum, weight) => sum + (weight ?? 0), 0);
      if (Math.abs(total - 100) > Number.EPSILON) {
        context.addIssue({
          code: "custom",
          path: ["components"],
          message: "weighted contract components must total exactly 100",
        });
      }
    }
  } else if (weights.some((weight) => weight !== null)) {
    context.addIssue({
      code: "custom",
      path: ["components"],
      message: "stage-gate contracts do not accept hidden weights",
    });
  }
}

export const ProgressContractDraftSchema =
  ProgressContractCoreSchema.superRefine(validateContractShape);

export const ProgressContractSchema = ProgressContractCoreSchema.extend({
  id: UuidSchema,
  contractVersion: PositiveVersionSchema,
  version: PositiveVersionSchema,
  state: ProgressContractStateSchema,
  ownerId: UuidSchema,
  approverId: UuidSchema.nullable(),
  approvedAt: UtcInstantSchema.nullable(),
  previousContractId: UuidSchema.nullable(),
}).superRefine(validateContractShape);

export const ProgressContractDecisionInputSchema = z
  .object({
    expectedVersion: PositiveVersionSchema,
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const ProgressSourceFactSchema = z
  .object({
    componentId: UuidSchema,
    sourceKind: z.enum(["document", "update", "evidence", "kpi_measurement", "human_confirmation"]),
    sourceId: UuidSchema,
    sourceVersion: PositiveVersionSchema,
    measuredValue: z.number().finite().nullable(),
    satisfied: z.boolean().nullable(),
    observedAt: UtcInstantSchema,
  })
  .strict();

export const CalculateProgressInputSchema = z
  .object({
    expectedContractVersion: PositiveVersionSchema,
    asOf: UtcInstantSchema,
    reason: z.string().trim().min(1).max(1_000),
    sources: z.array(ProgressSourceFactSchema).max(500),
  })
  .strict();

export const OfficialProgressResultSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("accepted"),
      snapshotId: UuidSchema,
      previousPercent: PercentSchema,
      percent: PercentSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("awaiting_information"),
      previousPercent: PercentSchema,
      missing: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
    })
    .strict(),
]);

export type ProgressContractDraft = z.infer<typeof ProgressContractDraftSchema>;
export type ProgressContractAiDraftOutput = z.infer<typeof ProgressContractAiDraftOutputSchema>;
export type ProgressContractAiDraftComponent = z.infer<
  typeof ProgressContractAiDraftComponentSchema
>;
export type ProgressContract = z.infer<typeof ProgressContractSchema>;
export type ProgressContractState = z.infer<typeof ProgressContractStateSchema>;
export type ProgressContractComponent = z.infer<typeof ProgressContractComponentSchema>;
export type ProgressSourceFact = z.infer<typeof ProgressSourceFactSchema>;
export type CalculateProgressInput = z.infer<typeof CalculateProgressInputSchema>;
export type OfficialProgressResult = z.infer<typeof OfficialProgressResultSchema>;
