import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const ReasonSchema = z.string().trim().min(1).max(1_000);

export const AnalysisSourceReferenceSchema = z
  .string()
  .min(3)
  .max(256)
  .regex(
    /^[a-z][a-z0-9._-]{0,63}:(?:[0-9]{1,20}|[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}|[0-9A-HJKMNP-TV-Z]{26}|[A-Fa-f0-9]{32,64})$/u,
  )
  .refine((value) => !/^https?:/iu.test(value))
  .refine(
    (value) =>
      !/(?:^|[^a-z0-9])(?:api[-_]?key|bearer|credential|password|secret|token)(?:[^a-z0-9]|$)/iu.test(
        value,
      ),
  );

export const ReadinessLifecycleStateSchema = z.enum([
  "draft",
  "incomplete",
  "ready_for_criteria_generation",
  "criteria_approved",
  "revision_required",
  "superseded",
]);

export const ManagerReadinessStateSchema = z.enum([
  "ready",
  "needs_attention",
  "missing_critical_information",
]);

export const ManagerReadinessSummarySchema = z
  .object({ state: ManagerReadinessStateSchema })
  .strict();

export const MissingDocumentItemSchema = z
  .object({
    templateSectionKey: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/u),
    missingItem: z.string().trim().min(1).max(2_000),
    whyItMatters: z.string().trim().min(1).max(2_000),
    correctionInstruction: z.string().trim().min(1).max(4_000),
    sourceReferences: z.array(AnalysisSourceReferenceSchema).min(1).max(20),
  })
  .strict();

export const ReadinessAnalysisOutputSchema = z
  .object({
    state: z.enum(["incomplete", "ready_for_criteria_generation"]),
    missingItems: z.array(MissingDocumentItemSchema).max(100),
    sourceReferences: z.array(AnalysisSourceReferenceSchema).min(1).max(50),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.state === "ready_for_criteria_generation" && value.missingItems.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["missingItems"],
        message: "A ready document cannot contain missing items",
      });
    }
    if (value.state === "incomplete" && value.missingItems.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["missingItems"],
        message: "An incomplete document must identify at least one missing item",
      });
    }
  });

export const ReadinessParticipantDetailSchema = z
  .object({
    readinessCheckId: UuidSchema,
    documentVersionId: UuidSchema,
    lifecycleState: ReadinessLifecycleStateSchema,
    missingItems: z.array(MissingDocumentItemSchema).max(100),
    sourceReferences: z.array(AnalysisSourceReferenceSchema).min(1).max(50),
    analyzedAt: UtcInstantSchema,
  })
  .strict();

export const MaterialChangeClassificationSchema = z.enum([
  "editorial",
  "routine_execution_update",
  "material_scope_or_goal_change",
]);

export const ComparisonAnalysisOutputSchema = z
  .object({
    classification: MaterialChangeClassificationSchema,
    impactExplanation: z.string().trim().min(1).max(4_000),
    beforeSourceReferences: z.array(AnalysisSourceReferenceSchema).min(1).max(50),
    afterSourceReferences: z.array(AnalysisSourceReferenceSchema).min(1).max(50),
  })
  .strict();

export const ReviewMaterialClassificationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), reason: ReasonSchema }).strict(),
  z
    .object({
      action: z.literal("correct"),
      classification: MaterialChangeClassificationSchema,
      reason: ReasonSchema,
    })
    .strict(),
]);

export type ReadinessLifecycleState = z.infer<typeof ReadinessLifecycleStateSchema>;
export type ReadinessAnalysisOutput = z.infer<typeof ReadinessAnalysisOutputSchema>;
export type ReadinessParticipantDetail = z.infer<typeof ReadinessParticipantDetailSchema>;
export type ManagerReadinessSummary = z.infer<typeof ManagerReadinessSummarySchema>;
export type ComparisonAnalysisOutput = z.infer<typeof ComparisonAnalysisOutputSchema>;
export type ReviewMaterialClassification = z.infer<typeof ReviewMaterialClassificationSchema>;
