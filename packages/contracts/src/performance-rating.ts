import { z } from "zod";

export const PERFORMANCE_RATING_CRITERION_IDS = [
  "PPB-01",
  "PPB-02",
  "PPB-03",
  "PPB-04",
  "ARL-01",
  "ARL-02",
  "ARL-03",
  "ARL-04",
  "EED-01",
  "EED-02",
  "EED-03",
  "EED-04",
  "PROJECT-CONTRIBUTION",
  "MGR-01",
  "MGR-02",
  "MGR-03",
  "MGR-04",
  "MGR-05",
] as const;

export const PerformanceRatingSchema = z
  .object({
    criterionId: z.enum(PERFORMANCE_RATING_CRITERION_IDS),
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    evidenceReferences: z.array(z.string().min(1)),
  })
  .strict()
  .brand<"PerformanceRating">();

export type PerformanceRating = z.infer<typeof PerformanceRatingSchema>;
