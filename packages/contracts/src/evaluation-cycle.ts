import { z } from "zod";

const utcInstant = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"), {
  message: "timestamp must use UTC Z notation",
});
const sourceReason = z
  .string()
  .min(3)
  .max(500)
  .refine((value) => value === value.trim());

export const FeedbackVisibilityModeSchema = z.enum([
  "identified",
  "manager_blinded",
  "anonymous_aggregated",
]);

export const EligibilityStateSchema = z.enum(["active", "excluded", "approved_leave", "pending"]);

const EligibilityCandidateSchema = z
  .object({
    employeeId: z.string().uuid(),
    state: EligibilityStateSchema,
    sourceReason,
    effectiveFrom: utcInstant,
    effectiveTo: utcInstant,
  })
  .strict()
  .refine((value) => Date.parse(value.effectiveFrom) < Date.parse(value.effectiveTo), {
    message: "eligibility effectiveTo must follow effectiveFrom",
  });

export const OpenCycleInputSchema = z
  .object({
    actorId: z.string().uuid(),
    managerId: z.string().uuid(),
    departmentId: z.string().uuid(),
    version: z.number().int().min(1).max(2_147_483_647),
    visibilityMode: FeedbackVisibilityModeSchema,
    sourceReason,
    effectiveFrom: utcInstant,
    effectiveTo: utcInstant,
    correlationId: z.string().uuid(),
    eligibleEmployees: z.array(EligibilityCandidateSchema).min(1).max(10_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.effectiveFrom) >= Date.parse(value.effectiveTo)) {
      context.addIssue({ code: "custom", message: "cycle effectiveTo must follow effectiveFrom" });
    }
    const employeeIds = value.eligibleEmployees.map(({ employeeId }) => employeeId);
    if (new Set(employeeIds).size !== employeeIds.length) {
      context.addIssue({ code: "custom", message: "eligible employees must be unique" });
    }
    for (const candidate of value.eligibleEmployees) {
      if (
        Date.parse(candidate.effectiveFrom) < Date.parse(value.effectiveFrom) ||
        Date.parse(candidate.effectiveTo) > Date.parse(value.effectiveTo)
      ) {
        context.addIssue({
          code: "custom",
          message: "employee eligibility must remain inside the cycle effective period",
        });
      }
    }
  });

const EligibilityEntrySchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    state: EligibilityStateSchema,
    sourceReason,
    effectiveFrom: utcInstant,
    effectiveTo: utcInstant,
    submittedAt: utcInstant.nullable(),
  })
  .strict();

export const EligibilitySnapshotSchema = z
  .object({
    id: z.string().uuid(),
    cycleId: z.string().uuid(),
    version: z.number().int().positive(),
    visibilityMode: FeedbackVisibilityModeSchema,
    sourceReason,
    effectiveFrom: utcInstant,
    effectiveTo: utcInstant,
    openedAt: utcInstant,
    entries: z.array(EligibilityEntrySchema),
  })
  .strict();

export const ExcludeEligibilityInputSchema = z
  .object({
    actorId: z.string().uuid(),
    cycleId: z.string().uuid(),
    employeeId: z.string().uuid(),
    reason: sourceReason,
    effectiveAt: utcInstant,
    correlationId: z.string().uuid(),
  })
  .strict();

export const CompletionStatusSchema = z
  .object({
    employeeId: z.string().uuid(),
    state: EligibilityStateSchema,
    submittedAt: utcInstant.nullable(),
  })
  .strict();

export type OpenCycleInput = z.infer<typeof OpenCycleInputSchema>;
export type EligibilitySnapshot = z.infer<typeof EligibilitySnapshotSchema>;
export type ExcludeEligibilityInput = z.infer<typeof ExcludeEligibilityInputSchema>;
export type CompletionStatus = z.infer<typeof CompletionStatusSchema>;
