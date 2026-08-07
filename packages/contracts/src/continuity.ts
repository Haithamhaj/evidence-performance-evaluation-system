import { z } from "zod";

const UuidSchema = z.string().uuid();
const VersionSchema = z.number().int().positive();
const UtcSchema = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"), {
  message: "timestamp must use UTC Z notation",
});
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const ContinuityScopeKindSchema = z.enum(["PROJECT", "WORKSTREAM"]);
export const ContinuityScopeSchema = z
  .object({ kind: ContinuityScopeKindSchema, id: UuidSchema })
  .strict();

export const UtcIntervalSchema = z
  .object({ startsAt: UtcSchema, endsAt: UtcSchema })
  .strict()
  .superRefine(({ startsAt, endsAt }, context) => {
    if (Date.parse(startsAt) >= Date.parse(endsAt)) {
      context.addIssue({ code: "custom", message: "endsAt must be after startsAt", path: ["endsAt"] });
    }
  });

export const LeaveStateSchema = z.enum([
  "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ACTIVE", "RETURNED", "CANCELLED",
]);
export const LeaveReasonCategorySchema = z.enum([
  "PLANNED_LEAVE", "UNPLANNED_LEAVE", "OTHER_APPROVED_ABSENCE",
]);
export const LeaveRecordSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, employeeId: UuidSchema, departmentId: UuidSchema,
  state: LeaveStateSchema, interval: UtcIntervalSchema, reasonCategory: LeaveReasonCategorySchema,
  affectedScopes: z.array(ContinuityScopeSchema).min(1).max(100), version: VersionSchema,
  createdAt: UtcSchema,
}).strict();
export const LeaveDecisionSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, leaveId: UuidSchema, managerId: UuidSchema,
  decision: z.enum(["APPROVED", "REJECTED"]), reason: requiredText(2_000), decidedAt: UtcSchema,
}).strict();
export const LeaveTransitionSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, leaveId: UuidSchema, fromState: LeaveStateSchema,
  toState: LeaveStateSchema, actorId: UuidSchema, reason: requiredText(2_000).nullable(), occurredAt: UtcSchema,
}).strict();

export const HandoverItemSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, scope: ContinuityScopeSchema,
  currentState: requiredText(4_000), completedWork: requiredText(4_000), openWork: requiredText(4_000),
  blockersAndRisks: requiredText(4_000), immediateNextStep: requiredText(4_000),
  keyLinks: z.array(z.url()).max(50), requiredAccess: z.array(requiredText(500)).max(50),
  pendingDecisions: z.array(requiredText(2_000)).max(50), proposedDelegateId: UuidSchema.nullable(),
}).strict();
export const HandoverRevisionSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, handoverId: UuidSchema, revision: VersionSchema,
  authorId: UuidSchema, items: z.array(HandoverItemSchema).min(1).max(100), createdAt: UtcSchema,
}).strict();

export const DelegationStateSchema = z.enum([
  "DRAFT", "PENDING_MANAGER", "PENDING_DELEGATE", "ACTIVE", "EXPIRED", "RETURNED", "CANCELLED",
]);
export const ActingOwnerActionSchema = z.enum([
  "project.update", "project.document.update", "project.criteria.approve",
  "project.participants.manage", "project.decision.record", "project.source.manage", "project.stage.close",
  "workstream.update", "workstream.document.update", "workstream.criteria.approve",
  "workstream.participants.manage", "workstream.decision.record", "workstream.source.manage",
  "workstream.stage.close",
]);
export const DelegationScopeSchema = z.object({
  projectIds: z.array(UuidSchema).max(100), workstreamIds: z.array(UuidSchema).max(100),
  actions: z.array(ActingOwnerActionSchema).min(1),
}).strict().refine(({ projectIds, workstreamIds }) => projectIds.length + workstreamIds.length > 0, {
  message: "at least one exact project or workstream scope is required",
});
export const DelegationSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, leaveId: UuidSchema, ownerId: UuidSchema,
  delegateId: UuidSchema, managerId: UuidSchema, state: DelegationStateSchema, period: UtcIntervalSchema,
  scope: DelegationScopeSchema, emergency: z.boolean(), emergencyReason: requiredText(2_000).nullable(),
  version: VersionSchema,
}).strict().superRefine(({ emergency, emergencyReason }, context) => {
  if (emergency && !emergencyReason) context.addIssue({ code: "custom", message: "emergency reason is required", path: ["emergencyReason"] });
  if (!emergency && emergencyReason) context.addIssue({ code: "custom", message: "emergency reason is not allowed", path: ["emergencyReason"] });
});
export const DelegateConfirmationSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, delegationId: UuidSchema, delegateId: UuidSchema,
  receiptConfirmed: z.literal(true), accessConfirmed: z.literal(true), confirmedAt: UtcSchema,
}).strict();
export const DelegationAccessGapSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, delegationId: UuidSchema, delegateId: UuidSchema,
  description: requiredText(4_000), state: z.enum(["OPEN", "RESOLVED"]), reportedAt: UtcSchema,
}).strict();

export const ReturnChoiceSchema = z.enum(["RETURN", "EXTEND", "PERMANENT_TRANSFER"]);
export const ReturnHandoverSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, delegationId: UuidSchema, actingOwnerId: UuidSchema,
  originalOwnerId: UuidSchema, completedWork: requiredText(4_000), decisionsAndChanges: requiredText(4_000),
  openWork: requiredText(4_000), risksAndNextSteps: requiredText(4_000), choice: ReturnChoiceSchema,
  confirmedById: UuidSchema.nullable(), createdAt: UtcSchema,
}).strict();

export const ReassignmentCaseStateSchema = z.enum(["REASSIGNMENT_REQUIRED", "RESOLVED", "CANCELLED"]);
export const ReassignmentRequiredCaseSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, formerOwnerId: UuidSchema, scope: ContinuityScopeSchema,
  state: ReassignmentCaseStateSchema, createdAt: UtcSchema,
}).strict();
export const ReassignmentResolutionSchema = z.object({
  schemaVersion: z.literal(1), id: UuidSchema, caseId: UuidSchema, actorId: UuidSchema,
  actorRole: z.literal("MANAGER"), resolution: z.enum(["PERMANENT_REASSIGNMENT", "PAUSE", "CLOSE", "MERGE"]),
  successorId: UuidSchema.nullable(), effectiveAt: UtcSchema, reason: requiredText(2_000), createdAt: UtcSchema,
}).strict();
export const DeactivationReceiptSchema = z.object({
  schemaVersion: z.literal(1), userId: UuidSchema, administratorId: UuidSchema, deactivatedAt: UtcSchema,
  preservedHistory: z.literal(true), reassignmentCaseIds: z.array(UuidSchema),
}).strict();
export const RetentionReferenceSchema = z.object({
  schemaVersion: z.literal(1), policyVersionId: UuidSchema, archiveOnly: z.literal(true),
  automaticDeletion: z.literal(false),
}).strict();
export const OperationalLeaveProjectionSchema = z.object({
  employeeId: UuidSchema, state: z.enum(["APPROVED", "ACTIVE", "RETURNED"]), startsAt: UtcSchema,
  endsAt: UtcSchema, checkInRequired: z.literal(false), negativeRegularitySignal: z.literal(false),
}).strict();

export type LeaveRecord = z.infer<typeof LeaveRecordSchema>;
export type Delegation = z.infer<typeof DelegationSchema>;
export type HandoverRevision = z.infer<typeof HandoverRevisionSchema>;
export type ReturnHandover = z.infer<typeof ReturnHandoverSchema>;
export type ReassignmentRequiredCase = z.infer<typeof ReassignmentRequiredCaseSchema>;
