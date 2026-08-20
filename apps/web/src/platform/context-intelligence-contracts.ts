import { z } from "zod";

const HandleSchema = z.string().min(32).max(10_000);
export const ContextProjectOptionSchema = z
  .object({ handle: HandleSchema, name: z.string().trim().min(1).max(240) })
  .strict();
const SourceSchema = z
  .object({
    provider: z.enum(["GOOGLE_GMAIL", "GOOGLE_CALENDAR"]).nullable(),
    observedAt: z.iso.datetime({ offset: true }).nullable(),
    title: z.string().trim().min(1).max(1_000),
    summary: z.string().nullable(),
    sourceUrl: z.url().nullable(),
  })
  .strict();
const ClarificationSchema = z
  .object({ nextQuestion: z.enum(["project", "assignee"]).nullable() })
  .strict();
export const ContextProjectMatchSchema = z
  .object({
    kind: z.literal("project_match"),
    handle: HandleSchema,
    projectName: z.string().nullable(),
    explanation: z.string().trim().min(1).max(4_000),
    source: SourceSchema,
  })
  .strict();
export const ContextTaskDraftSchema = z
  .object({
    kind: z.literal("task_draft"),
    handle: HandleSchema,
    title: z.string().trim().min(1).max(240),
    description: z.string().max(8_000),
    projectHandle: HandleSchema.nullable(),
    projectName: z.string().nullable(),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    acceptanceConditions: z.array(z.string().trim().min(1).max(500)).max(12),
    uncertainties: z.array(z.string().trim().min(1).max(2_000)).max(100),
    clarification: ClarificationSchema,
    source: SourceSchema,
  })
  .strict();
export const ContextReviewQueueSchema = z
  .object({
    items: z.array(
      z.discriminatedUnion("kind", [ContextProjectMatchSchema, ContextTaskDraftSchema]),
    ),
    projects: z.array(ContextProjectOptionSchema),
  })
  .strict();
export const ContextSuggestionInputSchema = z
  .object({ handle: HandleSchema, reason: z.string().trim().min(1).max(1_000) })
  .strict();
export const ContextSuggestionCorrectionInputSchema = ContextSuggestionInputSchema.extend({
  projectHandle: HandleSchema.nullable(),
}).strict();
export const ContextConfirmTaskInputSchema = z
  .object({
    handle: HandleSchema,
    reason: z.string().trim().min(1).max(1_000),
    draft: z
      .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(8_000),
        projectHandle: HandleSchema,
        assignToYou: z.literal(true),
      })
      .strict(),
  })
  .strict();
export const ContextConfirmTaskResultSchema = z
  .object({ task: z.object({ title: z.string().trim().min(1).max(200) }).strict() })
  .strict();

export type ContextProjectSuggestion = z.infer<typeof ContextProjectMatchSchema>;
export type ContextTaskDraft = z.infer<typeof ContextTaskDraftSchema>;
