import { z } from "zod";

const AnchorSchema = z
  .object({
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    text: z.string().min(1),
  })
  .strict();

export const CriterionSchema = z
  .object({
    id: z.string().regex(/^(?:PPB|ARL|EED)-\d{2}$|^PROJECT-CONTRIBUTION$/u),
    title: z.string().min(1),
    sectionId: z.enum(["PPB", "ARL", "EED", "PROJECT-CONTRIBUTION"]),
    sectionWeight: z.number().int().min(0).max(100).optional(),
    internalWeight: z.number().int().min(0).max(100).optional(),
    assessmentBasis: z.string().min(1).optional(),
    definition: z.string().min(1).optional(),
    whyItMatters: z.string().min(1).optional(),
    included: z.string().min(1).optional(),
    excluded: z.string().min(1).optional(),
    purpose: z.string().min(1).optional(),
    anchors: z.array(AnchorSchema).length(5),
    evidenceGuidance: z.string().min(1).optional(),
    prohibitedInputs: z.array(z.string().min(1)).optional(),
    requiredContextReview: z.array(z.string().min(1)).optional(),
    examples: z.array(z.string().min(1)),
  })
  .strict();

export const ManagerCriterionSchema = z
  .object({
    id: z.string().regex(/^MGR-\d{2}$/u),
    title: z.string().min(1),
    definition: z.string().min(1),
    anchors: z.array(AnchorSchema).length(5),
    commentPrompt: z.string().min(1),
  })
  .strict();

export const RubricContentSchema = z
  .object({
    version: z.literal("1"),
    locale: z.literal("en"),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/u),
    sections: z
      .array(
        z
          .object({
            id: z.string(),
            title: z.string(),
            weight: z.number().int().min(0).max(100),
          })
          .strict(),
      )
      .length(4),
    employeeCriteria: z.array(CriterionSchema).length(12),
    projectContribution: CriterionSchema,
    managerCriteria: z.array(ManagerCriterionSchema).length(5),
    biasGuidance: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type RubricContent = z.infer<typeof RubricContentSchema>;
