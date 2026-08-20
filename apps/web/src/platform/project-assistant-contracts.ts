import { z } from "zod";

import { WebUuidSchema } from "./task-workspace-contracts";

export const ProjectAssistantQuestionSchema = z.enum([
  "what_changed",
  "why_blocked",
  "missing_evidence",
  "explain_evidence_source",
  "revise_evidence_draft",
]);

export const AskProjectAssistantInputSchema = z
  .object({
    projectId: WebUuidSchema,
    locale: z.enum(["ar", "en"]),
    question: ProjectAssistantQuestionSchema,
  })
  .strict();

export const WebProjectAssistantAnswerSchema = z
  .object({
    schemaVersion: z.literal("project-assistant-output.v1"),
    answer: z.string().trim().min(1).max(2_000),
    sourceReferences: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
    assistance: z.enum(["ai_assisted", "deterministic"]),
    createsCommand: z.literal(false),
  })
  .strict();

export type ProjectAssistantQuestion = z.infer<typeof ProjectAssistantQuestionSchema>;
export type WebProjectAssistantAnswer = z.infer<typeof WebProjectAssistantAnswerSchema>;
