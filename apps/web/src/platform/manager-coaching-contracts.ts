import { z } from "zod";

const Uuid = z.string().uuid();
const SharedAction = z
  .object({
    id: Uuid,
    employeeId: Uuid,
    employeeName: z.string().trim().min(1).max(240),
    state: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(500),
    objective: z.string().trim().min(1).max(4_000),
    targetDate: z.iso.datetime({ offset: true }).nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
const FormalPlan = z
  .object({
    id: Uuid,
    employeeId: Uuid,
    employeeName: z.string().trim().min(1).max(240),
    state: z.string().trim().min(1).max(80),
    developmentArea: z.string().trim().min(1).max(4_000),
    expectedBehavior: z.string().trim().min(1).max(4_000),
    targetDate: z.iso.datetime({ offset: true }).nullable(),
    version: z.number().int().positive(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const WebManagerCoachingSchema = z
  .object({
    generatedAt: z.iso.datetime({ offset: true }),
    boundary: z.literal("shared_and_formal_only"),
    sharedActions: z.array(SharedAction),
    formalPlans: z.array(FormalPlan),
  })
  .strict();

export type WebManagerCoaching = z.infer<typeof WebManagerCoachingSchema>;
