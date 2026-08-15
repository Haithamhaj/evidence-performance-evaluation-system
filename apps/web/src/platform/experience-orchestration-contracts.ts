import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const OpaqueSourceReferenceSchema = z
  .string()
  .min(3)
  .max(256)
  .regex(/^[a-z][a-z0-9._-]{0,63}:(?:[0-9]{1,20}|[A-Fa-f0-9-]{32,64})$/u);

export const WebSuggestionFeedbackCategorySchema = z.enum([
  "HELPFUL",
  "WRONG_PROJECT",
  "WRONG_SOURCE_RELATION",
  "UNNECESSARY",
  "MISSING_CONTEXT",
  "BAD_DRAFT",
  "WRONG_TIMING",
  "TECHNICAL_ERROR",
]);

export const WebSuggestionFeedbackInputSchema = z
  .object({
    idempotencyKey: UuidSchema,
    category: WebSuggestionFeedbackCategorySchema,
    surface: z.literal("work_prepared_item"),
  })
  .strict();

export const WebSuggestionFeedbackReceiptSchema = z
  .object({
    id: UuidSchema,
    preparedItemId: UuidSchema,
    category: WebSuggestionFeedbackCategorySchema,
    createdAt: UtcInstantSchema,
    replay: z.boolean(),
  })
  .strict();

const PreparedExperienceRouteTraceSchema = z
  .object({
    aiRunId: UuidSchema,
    routeKey: z.literal("experience.prepare-next.v1"),
    outputReference: OpaqueSourceReferenceSchema,
  })
  .strict();

const AssistanceSchema = z
  .object({
    mode: z.enum(["deterministic", "ai_assisted"]),
    label: z.string().trim().min(1).max(240),
    routeTrace: PreparedExperienceRouteTraceSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.mode === "ai_assisted") !== (value.routeTrace !== null)) {
      context.addIssue({
        code: "custom",
        message: "AI assistance mode and route trace must agree",
        path: ["routeTrace"],
      });
    }
  });

export const WebPreparedExperienceItemSchema = z
  .object({
    id: UuidSchema,
    schemaVersion: z.literal("experience-prepared-output.v1"),
    state: z.enum(["prepared", "needs-clarification", "stale"]),
    kind: z.enum(["next_action", "clarification_question"]),
    sourceReferences: z.array(OpaqueSourceReferenceSchema).min(1).max(20),
    why: z.string().trim().min(1).max(1_000),
    freshness: z
      .object({
        status: z.enum(["fresh", "stale"]),
        sourceObservedAt: UtcInstantSchema,
        preparedAt: UtcInstantSchema,
      })
      .strict(),
    consequence: z.string().trim().min(1).max(1_000),
    editableDraft: z
      .object({
        title: z.string().trim().min(1).max(240),
        body: z.string().trim().min(1).max(4_000),
      })
      .strict(),
    assistance: AssistanceSchema,
    correlationId: UuidSchema,
  })
  .strict();

export const WebPreparedExperienceCompositionSchema = z
  .object({
    state: z.enum([
      "idle",
      "preparing",
      "prepared",
      "needs-clarification",
      "unavailable",
      "stale",
      "rejected",
      "error",
    ]),
    items: z.array(WebPreparedExperienceItemSchema).max(1),
  })
  .strict()
  .superRefine((value, context) => {
    const requiresItem = ["prepared", "needs-clarification", "stale"].includes(value.state);
    if (requiresItem !== (value.items.length === 1)) {
      context.addIssue({
        code: "custom",
        message: "Prepared states require exactly one item",
        path: ["items"],
      });
    }
    if (value.items[0] !== undefined && value.items[0].state !== value.state) {
      context.addIssue({
        code: "custom",
        message: "Composition and item states must match",
        path: ["items", 0, "state"],
      });
    }
  });

export type WebPreparedExperienceItem = z.infer<typeof WebPreparedExperienceItemSchema>;
export type WebPreparedExperienceComposition = z.infer<
  typeof WebPreparedExperienceCompositionSchema
>;
export type WebSuggestionFeedbackCategory = z.infer<typeof WebSuggestionFeedbackCategorySchema>;
export type WebSuggestionFeedbackInput = z.infer<typeof WebSuggestionFeedbackInputSchema>;
export type WebSuggestionFeedbackReceipt = z.infer<typeof WebSuggestionFeedbackReceiptSchema>;
