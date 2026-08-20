import { z } from "zod";

const UuidSchema = z.uuid();
const DateTimeSchema = z.iso.datetime({ offset: true });
const NamedEntitySchema = z
  .object({ id: UuidSchema, name: z.string().trim().min(1).max(240) })
  .strict();

const ConfirmedContributionSchema = z
  .object({
    id: UuidSchema,
    project: NamedEntitySchema,
    workItem: NamedEntitySchema.nullable(),
    sourceKind: z.enum(["text", "link", "image", "file", "code", "github", "voice"]),
    verificationState: z.enum([
      "unverified",
      "pending",
      "supported",
      "partial",
      "conflicting",
      "rejected",
    ]),
    confirmedAt: DateTimeSchema,
  })
  .strict();

const FinalizedEvaluationHistorySchema = z
  .object({
    assignmentId: UuidSchema,
    cycle: z
      .object({
        id: UuidSchema,
        type: z.enum(["CALIBRATION_NON_BASELINE", "STANDARD"]),
        startsAt: DateTimeSchema,
        endsAt: DateTimeSchema,
      })
      .strict(),
    finalizedAt: DateTimeSchema,
    acknowledgment: z
      .object({
        kind: z.enum(["ACKNOWLEDGED", "ACKNOWLEDGED_WITH_RESERVATION", "NO_RESPONSE"]),
        recordedAt: DateTimeSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();

const ProjectProgressSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("awaiting_contract") }).strict(),
  z.object({ state: z.literal("awaiting_information") }).strict(),
  z
    .object({
      state: z.literal("accepted"),
      percent: z.number().min(0).max(100),
      updatedAt: DateTimeSchema,
    })
    .strict(),
]);

const ProjectMilestoneSchema = z
  .object({
    id: UuidSchema,
    name: z.string().trim().min(1).max(240),
    kind: z.enum(["milestone", "deliverable", "operational_kpi"]),
    state: z.enum(["awaiting_evidence", "not_started", "in_progress", "complete"]),
    percent: z.number().min(0).max(100).nullable(),
  })
  .strict();

const ProjectKpiSchema = z
  .object({
    id: UuidSchema,
    name: z.string().trim().min(1).max(240),
    current: z.number(),
    target: z.number(),
    unit: z.string().trim().min(1).max(40),
    direction: z.enum(["increase", "decrease", "maintain"]),
    observedAt: DateTimeSchema,
  })
  .strict();

export const EmployeeInsightsV1Schema = z
  .object({
    schemaVersion: z.literal("employee-insights.v1"),
    generatedAt: DateTimeSchema,
    personal: z
      .object({
        confirmedContributions: z.array(ConfirmedContributionSchema).max(100),
        finalizedEvaluations: z.array(FinalizedEvaluationHistorySchema).max(20),
      })
      .strict(),
    projects: z
      .array(
        z
          .object({
            id: UuidSchema,
            name: z.string().trim().min(1).max(240),
            status: z.enum(["active", "paused"]),
            progress: ProjectProgressSchema,
            sourceHealth: z.enum(["sufficient", "insufficient", "awaiting_contract"]),
            milestones: z.array(ProjectMilestoneSchema).max(100),
            kpi: ProjectKpiSchema.nullable(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

export type EmployeeInsightsV1 = z.infer<typeof EmployeeInsightsV1Schema>;
