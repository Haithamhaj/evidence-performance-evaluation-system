/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import { z } from "zod";

const Utc = z.iso.datetime({ offset: true }).refine((value) => value.endsWith("Z"));
const Action = z.enum([
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
const Approval = z
  .object({
    id: z.string().uuid(),
    leaveId: z.string().uuid(),
    ownerId: z.string().uuid(),
    delegateId: z.string().uuid(),
    managerId: z.string().uuid(),
    departmentId: z.string().uuid(),
    startsAt: Utc,
    endsAt: Utc,
    projectIds: z.array(z.string().uuid()).max(100),
    workstreamIds: z.array(z.string().uuid()).max(100),
    actions: z.array(Action).min(1),
    emergency: z.boolean(),
    emergencyReason: z.string().trim().min(1).max(2_000).nullable(),
    correlationId: z.string().uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    if (Date.parse(input.startsAt) >= Date.parse(input.endsAt)) {
      context.addIssue({ code: "custom", message: "invalid delegation interval" });
    }
    if (input.projectIds.length + input.workstreamIds.length === 0) {
      context.addIssue({ code: "custom", message: "exact scope required" });
    }
    if (input.emergency !== Boolean(input.emergencyReason)) {
      context.addIssue({ code: "custom", message: "emergency reason mismatch" });
    }
  });
const Confirmation = z
  .object({
    delegationId: z.string().uuid(),
    delegateId: z.string().uuid(),
    receiptConfirmed: z.literal(true),
    accessConfirmed: z.literal(true),
    correlationId: z.string().uuid(),
  })
  .strict();
const Gap = z
  .object({
    delegationId: z.string().uuid(),
    delegateId: z.string().uuid(),
    description: z.string().trim().min(1).max(4_000),
    correlationId: z.string().uuid(),
  })
  .strict();
const ResolveGap = z
  .object({
    delegationId: z.string().uuid(),
    gapId: z.string().uuid(),
    managerId: z.string().uuid(),
    resolution: z.enum(["RESOLVED", "EMERGENCY_OVERRIDE"]),
    reason: z.string().trim().min(1).max(2_000),
    correlationId: z.string().uuid(),
  })
  .strict();
const Transition = z
  .object({
    delegationId: z.string().uuid(),
    actorId: z.string().uuid(),
    correlationId: z.string().uuid(),
  })
  .strict();

export type DelegationRecord = Readonly<{
  id: string;
  leaveId: string;
  ownerId: string;
  delegateId: string;
  managerId: string;
  departmentId: string;
  handoverRevisionId: string;
  state: "PENDING_DELEGATE" | "ACTIVE" | "EXPIRED";
  startsAt: string;
  endsAt: string;
  projectIds: readonly string[];
  workstreamIds: readonly string[];
  actions: readonly z.infer<typeof Action>[];
  emergency: boolean;
  emergencyReason: string | null;
  emergencyAuditEventId?: string;
  version: number;
}>;

export interface DelegationTransaction {
  find(id: string): Promise<DelegationRecord | null>;
  save(record: DelegationRecord): Promise<DelegationRecord>;
  findReceipt(delegationId: string): Promise<Readonly<{
    delegateId: string;
    receiptConfirmed: true;
    accessConfirmed: true;
  }> | null>;
  confirmReceipt(delegationId: string, input: Record<string, unknown>): Promise<void>;
  isReceiptConfirmed(delegationId: string): Promise<boolean>;
  reportAccessGap(delegationId: string, input: Record<string, unknown>): Promise<void>;
  hasOpenAccessGap(delegationId: string): Promise<boolean>;
  resolveAccessGap(gapId: string, input: Record<string, unknown>): Promise<void>;
  appendAudit(event: Record<string, unknown>): Promise<{ id: string }>;
}

export interface DelegationStore extends DelegationTransaction {
  transaction<T>(operation: (tx: DelegationTransaction) => Promise<T>): Promise<T>;
}

export type DelegationAuthorization = Readonly<{
  canManageEmployee(managerId: string, employeeId: string, departmentId: string): Promise<boolean>;
}>;

export interface DelegationSourcePort {
  verifyApprovalSource(
    input: Readonly<{
      leaveId: string;
      ownerId: string;
      delegateId: string;
      departmentId: string;
      startsAt: string;
      endsAt: string;
      projectIds: readonly string[];
      workstreamIds: readonly string[];
    }>,
  ): Promise<Readonly<{ handoverRevisionId: string }>>;
}

export interface DelegationAuthorityPort {
  activate(
    record: DelegationRecord,
    input: Readonly<{
      actorId: string;
      correlationId: string;
    }>,
  ): Promise<DelegationRecord>;
  expire(
    record: DelegationRecord,
    input: Readonly<{
      actorId: string;
      correlationId: string;
      occurredAt: string;
    }>,
  ): Promise<DelegationRecord>;
}

export class DelegationService {
  constructor(
    private readonly store: DelegationStore,
    private readonly authorization: DelegationAuthorization,
    private readonly sources: DelegationSourcePort,
    private readonly authority: DelegationAuthorityPort,
  ) {}

  async approve(input: unknown): Promise<DelegationRecord> {
    const parsed = Approval.parse(input);
    if (
      !(await this.authorization.canManageEmployee(
        parsed.managerId,
        parsed.ownerId,
        parsed.departmentId,
      ))
    ) {
      throw failure("AUTHZ_SCOPE", 403);
    }
    const source = await this.sources.verifyApprovalSource(parsed);
    const pending = await this.store.transaction(async (tx) => {
      if (await tx.find(parsed.id)) throw failure("DELEGATION_ALREADY_EXISTS", 409);
      const audit = await tx.appendAudit({
        eventType: parsed.emergency
          ? "continuity.delegation.emergency_approved"
          : "continuity.delegation.manager_approved",
        actorId: parsed.managerId,
        subjectId: parsed.delegateId,
        targetId: parsed.id,
        reason: parsed.emergencyReason,
        correlationId: parsed.correlationId,
      });
      return tx.save({
        id: parsed.id,
        leaveId: parsed.leaveId,
        ownerId: parsed.ownerId,
        delegateId: parsed.delegateId,
        managerId: parsed.managerId,
        departmentId: parsed.departmentId,
        handoverRevisionId: source.handoverRevisionId,
        state: "PENDING_DELEGATE",
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        projectIds: parsed.projectIds,
        workstreamIds: parsed.workstreamIds,
        actions: parsed.actions,
        emergency: parsed.emergency,
        emergencyReason: parsed.emergencyReason,
        version: 1,
        emergencyAuditEventId: parsed.emergency ? audit.id : undefined,
      } as DelegationRecord);
    });
    return parsed.emergency
      ? this.authority.activate(pending, {
          actorId: parsed.managerId,
          correlationId: parsed.correlationId,
        })
      : pending;
  }

  async confirm(input: unknown): Promise<DelegationRecord> {
    const parsed = Confirmation.parse(input);
    return this.store.transaction(async (tx) => {
      const record = await required(tx, parsed.delegationId);
      if (record.delegateId !== parsed.delegateId) throw failure("AUTHZ_SCOPE", 403);
      const existing = await tx.findReceipt(record.id);
      if (existing !== null) {
        if (
          existing.delegateId !== parsed.delegateId ||
          !existing.receiptConfirmed ||
          !existing.accessConfirmed
        ) {
          throw failure("DELEGATE_CONFIRMATION_CONFLICT", 409);
        }
        return record;
      }
      if (record.state !== "PENDING_DELEGATE") throw failure("DELEGATION_TRANSITION_INVALID", 409);
      const audit = await tx.appendAudit({
        eventType: "continuity.delegation.delegate_confirmed",
        actorId: parsed.delegateId,
        targetId: record.id,
        correlationId: parsed.correlationId,
      });
      await tx.confirmReceipt(record.id, { ...parsed, auditEventId: audit.id });
      return record;
    });
  }

  async reportGap(input: unknown): Promise<DelegationRecord> {
    const parsed = Gap.parse(input);
    return this.store.transaction(async (tx) => {
      const record = await required(tx, parsed.delegationId);
      if (record.delegateId !== parsed.delegateId) throw failure("AUTHZ_SCOPE", 403);
      const audit = await tx.appendAudit({
        eventType: "continuity.delegation.access_gap_reported",
        actorId: parsed.delegateId,
        targetId: record.id,
        correlationId: parsed.correlationId,
      });
      await tx.reportAccessGap(record.id, { ...parsed, auditEventId: audit.id });
      return record;
    });
  }

  async resolveGap(input: unknown): Promise<DelegationRecord> {
    const parsed = ResolveGap.parse(input);
    return this.store.transaction(async (tx) => {
      const record = await required(tx, parsed.delegationId);
      if (
        record.managerId !== parsed.managerId ||
        !(await this.authorization.canManageEmployee(
          parsed.managerId,
          record.ownerId,
          record.departmentId,
        ))
      ) {
        throw failure("AUTHZ_SCOPE", 403);
      }
      const audit = await tx.appendAudit({
        eventType:
          parsed.resolution === "EMERGENCY_OVERRIDE"
            ? "continuity.delegation.access_gap_emergency_override"
            : "continuity.delegation.access_gap_resolved",
        actorId: parsed.managerId,
        targetId: parsed.gapId,
        reason: parsed.reason,
        correlationId: parsed.correlationId,
      });
      await tx.resolveAccessGap(parsed.gapId, { ...parsed, auditEventId: audit.id });
      return record;
    });
  }

  async activate(input: unknown): Promise<DelegationRecord> {
    const parsed = Transition.parse(input);
    const record = await this.store.transaction(async (tx) => {
      const record = await required(tx, parsed.delegationId);
      if (
        record.managerId !== parsed.actorId ||
        !(await this.authorization.canManageEmployee(
          parsed.actorId,
          record.ownerId,
          record.departmentId,
        ))
      ) {
        throw failure("AUTHZ_SCOPE", 403);
      }
      if (record.state !== "PENDING_DELEGATE") throw failure("DELEGATION_TRANSITION_INVALID", 409);
      if (!(await tx.isReceiptConfirmed(record.id))) {
        throw failure("DELEGATE_CONFIRMATION_REQUIRED", 409);
      }
      if (await tx.hasOpenAccessGap(record.id)) throw failure("DELEGATION_ACCESS_GAP_OPEN", 409);
      return record;
    });
    return this.authority.activate(record, {
      actorId: parsed.actorId,
      correlationId: parsed.correlationId,
    });
  }

  async expire(input: unknown): Promise<DelegationRecord> {
    const parsed = Transition.parse(input);
    const record = await this.store.transaction(async (tx) => {
      const record = await required(tx, parsed.delegationId);
      if (
        record.managerId !== parsed.actorId ||
        !(await this.authorization.canManageEmployee(
          parsed.actorId,
          record.ownerId,
          record.departmentId,
        ))
      ) {
        throw failure("AUTHZ_SCOPE", 403);
      }
      if (record.state !== "ACTIVE") throw failure("DELEGATION_TRANSITION_INVALID", 409);
      return record;
    });
    return this.authority.expire(record, {
      actorId: parsed.actorId,
      correlationId: parsed.correlationId,
      occurredAt: new Date().toISOString(),
    });
  }
}

async function required(tx: DelegationTransaction, id: string) {
  const record = await tx.find(id);
  if (!record) throw failure("DELEGATION_NOT_FOUND", 404);
  return record;
}

function failure(code: string, status: number) {
  return new AppError(code, "errors.continuity.invalid", status);
}
