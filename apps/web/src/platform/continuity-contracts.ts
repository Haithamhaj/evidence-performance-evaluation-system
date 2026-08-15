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
const DelegationCandidate = z
  .object({ id: Uuid, name: z.string().trim().min(1).max(240), departmentId: Uuid })
  .strict();
const Delegation = z
  .object({
    id: Uuid,
    leaveId: Uuid,
    role: z.enum(["manager", "owner", "delegate"]),
    ownerName: z.string().trim().min(1).max(240),
    delegateName: z.string().trim().min(1).max(240),
    state: z.enum(["PENDING_DELEGATE", "ACTIVE", "EXPIRED", "RETURNED"]),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    scopes: z.array(
      z
        .object({
          kind: z.enum(["PROJECT", "WORKSTREAM"]),
          id: Uuid,
          name: z.string().trim().min(1).max(240),
          actions: z.array(z.string().trim().min(1).max(100)).min(1),
        })
        .strict(),
    ),
    delegateConfirmed: z.boolean(),
    openAccessGapCount: z.number().int().nonnegative(),
    returnHandover: z
      .object({
        id: Uuid,
        state: z.enum(["DRAFT", "OWNER_CONFIRMED", "FINALIZED"]),
        version: z.number().int().positive(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const WebContinuityExperienceSchema = z
  .object({
    mode: z.enum(["employee", "manager"]),
    generatedAt: z.iso.datetime({ offset: true }),
    leaves: z.array(Leave),
    availableScopes: z.array(Scope),
    delegationCandidates: z.array(DelegationCandidate),
    delegations: z.array(Delegation),
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

const DelegationAction = z.enum([
  "project.update",
  "project.document.update",
  "project.criteria.approve",
  "project.participants.manage",
  "project.decision.record",
  "project.source.manage",
  "project.stage.close",
  "workstream.update",
  "workstream.document.update",
  "workstream.criteria.approve",
  "workstream.participants.manage",
  "workstream.decision.record",
  "workstream.source.manage",
  "workstream.stage.close",
]);
export const WebDelegationApprovalSchema = z
  .object({
    id: Uuid,
    leaveId: Uuid,
    ownerId: Uuid,
    delegateId: Uuid,
    departmentId: Uuid,
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    projectIds: z.array(Uuid).max(100),
    workstreamIds: z.array(Uuid).max(100),
    actions: z.array(DelegationAction).min(1),
    emergency: z.literal(false),
    emergencyReason: z.null(),
  })
  .strict();
export const WebDelegationConfirmationSchema = z
  .object({
    delegationId: Uuid,
    receiptConfirmed: z.literal(true),
    accessConfirmed: z.literal(true),
  })
  .strict();
export const WebReturnDraftSchema = z
  .object({
    id: Uuid,
    completedWork: z.string().trim().min(1).max(4_000),
    decisionsAndChanges: z.string().trim().min(1).max(4_000),
    openWork: z.string().trim().min(1).max(4_000),
    risksAndNextSteps: z.string().trim().min(1).max(4_000),
  })
  .strict();
export const WebReturnConfirmationSchema = z
  .object({ returnId: Uuid, expectedVersion: z.number().int().positive() })
  .strict();
export const WebReturnFinalizationSchema = z
  .object({
    returnId: Uuid,
    expectedVersion: z.number().int().positive(),
    choice: z.literal("RETURN"),
    occurredAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();
