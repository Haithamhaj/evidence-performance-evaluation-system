import { z } from "zod";

const Uuid = z.string().uuid();
const ProgressSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("awaiting_contract") }).strict(),
  z.object({ state: z.literal("awaiting_information") }).strict(),
  z
    .object({
      state: z.literal("accepted"),
      snapshotId: Uuid,
      percent: z.number().min(0).max(100),
      reason: z.string(),
      updatedAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
]);

export const ProjectProgressViewSchema: z.ZodType<
  import("./project-progress-panel").ProjectProgressView
> = z
  .object({
    project: z
      .object({
        id: Uuid,
        name: z.string(),
        description: z.string(),
        status: z.enum(["draft", "active", "paused", "completed", "archived"]),
      })
      .strict(),
    contract: z
      .object({
        id: Uuid,
        contractVersion: z.number().int().positive(),
        version: z.number().int().positive(),
        state: z.literal("active"),
        calculationKind: z.enum(["weighted", "stage_gate"]),
        effectiveAt: z.iso.datetime({ offset: true }),
        components: z.array(
          z
            .object({
              id: Uuid,
              kind: z.enum(["milestone", "deliverable", "kpi", "acceptance"]),
              name: z.string(),
              description: z.string(),
              weight: z.number().nullable(),
              baseline: z.number().nullable(),
              target: z.number().nullable(),
              unit: z.string().nullable(),
              direction: z.enum(["increase", "decrease", "maintain"]).nullable(),
              requiredEvidence: z.array(z.string()),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    progress: ProgressSchema,
    pulse: z
      .object({
        officialProgress: z.number().min(0).max(100).nullable(),
        previousOfficialProgress: z.number().min(0).max(100).nullable(),
        sourceCoverage: z.enum(["SUFFICIENT", "INSUFFICIENT"]),
        milestoneStates: z.array(
          z
            .object({
              componentId: Uuid,
              name: z.string(),
              kind: z.enum(["milestone", "deliverable", "kpi", "acceptance"]),
              percent: z.number().min(0).max(100).nullable(),
              state: z.enum(["complete", "in_progress", "not_started", "awaiting_evidence"]),
            })
            .strict(),
        ),
        nextRequiredEvidence: z.array(
          z
            .object({
              componentId: Uuid,
              componentName: z.string(),
              label: z.string(),
            })
            .strict(),
        ),
        explanation: z.array(
          z
            .object({
              kind: z.enum(["increase", "decrease", "no_change"]),
              delta: z.number(),
              text: z.string(),
              snapshotId: Uuid,
              observedAt: z.iso.datetime({ offset: true }),
            })
            .strict(),
        ),
      })
      .strict(),
    contractDraftSourceRequest: z
      .object({
        documentVersionId: Uuid,
        sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/u),
        sourceVersion: z.number().int().positive(),
      })
      .strict()
      .nullable(),
  })
  .strip();
