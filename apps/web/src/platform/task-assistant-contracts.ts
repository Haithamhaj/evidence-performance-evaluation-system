import { z } from "zod";

import { WebUuidSchema } from "./task-workspace-contracts";

export const AskTaskAssistantInputSchema = z
  .object({
    workItemId: WebUuidSchema,
    locale: z.enum(["ar", "en"]),
    question: z.string().trim().min(2).max(1_000),
  })
  .strict();

export const WebTaskAssistantAnswerSchema = z
  .object({
    schemaVersion: z.literal("task-assistant-output.v1"),
    answer: z.string().trim().min(1).max(2_000),
    sourceReferences: z.array(z.string().trim().min(1).max(500)).min(1).max(21),
    assistance: z.enum(["ai_assisted", "deterministic"]),
    suggestedAction: z
      .object({
        kind: z.literal("status_change"),
        status: z.enum([
          "planned",
          "ready",
          "in_progress",
          "blocked",
          "in_review",
          "done",
          "cancelled",
        ]),
        rationale: z.string().trim().min(1).max(1_000),
      })
      .strict()
      .nullable(),
    createsCommand: z.literal(false),
  })
  .strict();

export type WebTaskAssistantAnswer = z.infer<typeof WebTaskAssistantAnswerSchema>;
