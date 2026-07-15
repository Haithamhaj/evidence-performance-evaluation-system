import { z } from "zod";

export const PerformanceRatingSchema = z
  .object({
    criterionId: z.string().regex(/^(?:PPB|ARL|EED|MGR)-\d{2}$|^PROJECT-CONTRIBUTION$/u),
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    evidenceReferences: z.array(z.string().min(1)),
  })
  .strict()
  .brand<"PerformanceRating">();

export type PerformanceRating = z.infer<typeof PerformanceRatingSchema>;
