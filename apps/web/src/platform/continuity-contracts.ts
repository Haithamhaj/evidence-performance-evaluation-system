import { z } from "zod";

const Uuid = z.string().uuid();
const Scope = z
  .object({
    kind: z.enum(["PROJECT", "WORKSTREAM"]),
    id: Uuid,
    name: z.string().trim().min(1).max(240),
    departmentId: Uuid,
  })
  .strict();
const Handover = z
  .object({
    id: Uuid,
    revision: z.number().int().positive(),
    itemCount: z.number().int().nonnegative(),
    confirmed: z.boolean(),
  })
  .strict();
const Leave = z
  .object({
    id: Uuid,
    employeeId: Uuid,
    employeeName: z.string().trim().min(1).max(240),
    state: z.enum(["SUBMITTED", "APPROVED", "ACTIVE", "REJECTED", "CANCELLED", "RETURNED"]),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    affectedScopeCount: z.number().int().nonnegative(),
    affectedScopes: z.array(Scope).optional(),
    version: z.number().int().positive(),
    handover: Handover.nullable(),
  })
  .strict();

export const WebContinuityExperienceSchema = z
  .object({
    mode: z.enum(["employee", "manager"]),
    generatedAt: z.iso.datetime({ offset: true }),
    leaves: z.array(Leave),
    availableScopes: z.array(Scope),
  })
  .strict();

export type WebContinuityExperience = z.infer<typeof WebContinuityExperienceSchema>;

export const WebSubmitLeaveSchema = z
  .object({
    id: Uuid,
    departmentId: Uuid,
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    reasonCategory: z.enum(["PLANNED_LEAVE", "UNPLANNED_LEAVE", "OTHER_APPROVED_ABSENCE"]),
    affectedScopes: z
      .array(z.object({ kind: z.enum(["PROJECT", "WORKSTREAM"]), id: Uuid }).strict())
      .min(1),
  })
  .strict();
export const WebLeaveDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();
export const WebHandoverConfirmationSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();
const HandoverItemInput = z
  .object({
    scope: z.object({ kind: z.enum(["PROJECT", "WORKSTREAM"]), id: Uuid }).strict(),
    currentState: z.string().trim().min(1).max(4_000),
    completedWork: z.string().trim().min(1).max(4_000),
    openWork: z.string().trim().min(1).max(4_000),
    blockersAndRisks: z.string().trim().min(1).max(4_000),
    immediateNextStep: z.string().trim().min(1).max(4_000),
    keyLinks: z.array(z.url()).max(50),
    requiredAccess: z.array(z.string().trim().min(1).max(500)).max(50),
    pendingDecisions: z.array(z.string().trim().min(1).max(2_000)).max(50),
    proposedDelegateId: Uuid.nullable(),
  })
  .strict();
export const WebHandoverRevisionSchema = z
  .object({
    leaveId: Uuid,
    expectedRevision: z.number().int().nonnegative(),
    items: z.array(HandoverItemInput).min(1).max(100),
  })
  .strict();
