import { z } from "zod";

export const DocumentationReadinessSchema = z
  .object({
    state: z.enum(["ready", "needs_attention", "missing_critical_information"]),
    percentage: z.number().min(0).max(100),
  })
  .strict()
  .brand<"DocumentationReadiness">();

export type DocumentationReadiness = z.infer<typeof DocumentationReadinessSchema>;
