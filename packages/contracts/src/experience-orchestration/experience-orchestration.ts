import { z } from "zod";

const UuidSchema = z.string().uuid();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const OpaqueSourceReferenceSchema = z
  .string()
  .min(3)
  .max(256)
  .regex(/^[a-z][a-z0-9._-]{0,63}:(?:[0-9]{1,20}|[A-Fa-f0-9-]{32,64})$/u);

export const ExperienceOrchestrationStateSchema = z.enum([
  "idle",
  "preparing",
  "prepared",
  "needs-clarification",
  "unavailable",
  "stale",
  "rejected",
  "error",
]);

export const PreparedExperienceRouteTraceSchema = z
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
        path: ["routeTrace"],
        message: "AI assistance requires a route trace; deterministic assistance cannot claim one",
      });
    }
  });

export const PreparedExperienceItemSchema = z
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

export const PreparedExperienceCompositionSchema = z
  .object({
    state: ExperienceOrchestrationStateSchema,
    items: z.array(PreparedExperienceItemSchema).max(1),
  })
  .strict()
  .superRefine((value, context) => {
    const requiresItem = ["prepared", "needs-clarification", "stale"].includes(value.state);
    if (requiresItem !== (value.items.length === 1)) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Prepared, clarification, and stale states require exactly one item",
      });
    }
    if (value.items[0] !== undefined && value.items[0].state !== value.state) {
      context.addIssue({
        code: "custom",
        path: ["items", 0, "state"],
        message: "Composition and item states must match",
      });
    }
  });

export const ExperienceOrchestrationJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    jobType: z.literal("experience.prepare-next"),
    employeeId: UuidSchema,
    correlationId: UuidSchema,
    idempotencyKey: UuidSchema,
  })
  .strict();

export type ExperienceOrchestrationState = z.infer<typeof ExperienceOrchestrationStateSchema>;
export type PreparedExperienceItem = z.infer<typeof PreparedExperienceItemSchema>;
export type PreparedExperienceComposition = z.infer<typeof PreparedExperienceCompositionSchema>;
export type ExperienceOrchestrationJob = z.infer<typeof ExperienceOrchestrationJobSchema>;
