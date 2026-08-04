import { z } from "zod";

import { AnalysisSourceReferenceSchema } from "./document-analysis.js";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const ReasonSchema = z.string().trim().min(1).max(1_000);
const FeedbackSchema = z.string().trim().min(1).max(4_000);
const normalizedText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^\S(?:[\s\S]*\S)?$/u);

export const CriterionProposalItemSchema = z
  .object({
    name: normalizedText(300),
    selectionReason: normalizedText(2_000),
    successLink: normalizedText(2_000),
    expectedBehaviorOrResult: normalizedText(4_000),
    evaluationMethod: normalizedText(4_000),
    suggestedEvidence: z.array(normalizedText(1_000)).min(1).max(20),
    sourceReferences: z.array(AnalysisSourceReferenceSchema).min(1).max(50),
  })
  .strict();

export const CriteriaGenerationOutputSchema = z
  .object({ criteria: z.array(CriterionProposalItemSchema).min(1).max(3) })
  .strict();

const OwnerReviewWithoutFeedbackSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), reason: ReasonSchema }).strict(),
  z.object({ action: z.literal("reject"), reason: ReasonSchema }).strict(),
]);

const OwnerReviewWithFeedbackSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("request_correction"),
      reason: ReasonSchema,
      feedback: FeedbackSchema.optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("request_alternative"),
      reason: ReasonSchema,
      feedback: FeedbackSchema.optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("request_wording_improvement"),
      reason: ReasonSchema,
      feedback: FeedbackSchema.optional(),
    })
    .strict(),
]);

export const OwnerReviewCriteriaSchema = z.union([
  OwnerReviewWithoutFeedbackSchema,
  OwnerReviewWithFeedbackSchema,
]);

export const RespondToCriteriaSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge") }).strict(),
  z.object({ action: z.literal("object"), reason: ReasonSchema }).strict(),
]);

export const ResolveCriteriaObjectionsSchema = z.discriminatedUnion("decision", [
  z
    .object({
      decision: z.literal("request_revision"),
      reason: ReasonSchema,
    })
    .strict(),
  z
    .object({
      decision: z.literal("accept_with_objections"),
      reason: ReasonSchema,
    })
    .strict(),
]);

export const ActivateCriteriaSchema = z
  .object({
    expectedProposalVersion: z.number().int().positive(),
    effectiveFrom: UtcInstantSchema,
    reason: ReasonSchema,
  })
  .strict();

export const ReviseCriteriaSchema = z
  .object({
    comparisonReviewId: UuidSchema,
    reason: ReasonSchema,
  })
  .strict();

export type CriterionProposalItem = z.infer<typeof CriterionProposalItemSchema>;
export type CriteriaGenerationOutput = z.infer<typeof CriteriaGenerationOutputSchema>;
export type OwnerReviewCriteria = z.infer<typeof OwnerReviewCriteriaSchema>;
export type RespondToCriteria = z.infer<typeof RespondToCriteriaSchema>;
export type ResolveCriteriaObjections = z.infer<typeof ResolveCriteriaObjectionsSchema>;
export type ActivateCriteria = z.infer<typeof ActivateCriteriaSchema>;
export type ReviseCriteria = z.infer<typeof ReviseCriteriaSchema>;
