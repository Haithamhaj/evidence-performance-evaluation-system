/* eslint-disable no-unused-vars */
import type { DatabaseClient, DatabaseTransaction } from "@evaluation/database";

import type {
  DelegationRecord,
  DelegationStore,
  DelegationTransaction,
} from "./delegation-service.js";
import type {
  OffboardingCase,
  OffboardingStore,
  OffboardingTransaction,
  OwnedScope,
} from "./offboarding-service.js";
import type { ContinuityStore, ContinuityTransaction, LeaveRow } from "./ports.js";
import type { ReturnDelegation, ReturnStore, ReturnTransaction } from "./return-service.js";

type Db = DatabaseClient | DatabaseTransaction;

export class PrismaContinuityPersistence
  implements ContinuityStore, DelegationStore, ReturnStore, OffboardingStore
{
  constructor(private readonly client: DatabaseClient) {}

  transaction<T>(
    operation: (
      tx: ContinuityTransaction &
        DelegationTransaction &
        ReturnTransaction &
        OffboardingTransaction,
    ) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction((transaction) =>
      operation(new PrismaContinuityTransaction(transaction)),
    );
  }

  private root() {
    return new PrismaContinuityTransaction(this.client);
  }

  createLeave(input: LeaveRow) {
    return this.root().createLeave(input);
  }
  findLeave(id: string) {
    return this.root().findLeave(id);
  }
  updateLeave(id: string, state: LeaveRow["state"], version: number) {
    return this.root().updateLeave(id, state, version);
  }
  appendLeaveDecision(input: Record<string, unknown>) {
    return this.root().appendLeaveDecision(input);
  }
  appendLeaveTransition(input: Record<string, unknown>) {
    return this.root().appendLeaveTransition(input);
  }
  appendEligibilityEffect(input: Record<string, unknown>) {
    return this.root().appendEligibilityEffect(input);
  }
  appendAudit(input: Record<string, unknown>) {
    return this.root().appendAudit(input);
  }
  findApprovedLeaveAt(employeeId: string, occurredAt: string) {
    return this.root().findApprovedLeaveAt(employeeId, occurredAt);
  }
  currentHandoverRevision(handoverId: string) {
    return this.root().currentHandoverRevision(handoverId);
  }
  appendHandoverRevision(input: Record<string, unknown>) {
    return this.root().appendHandoverRevision(input);
  }
  appendHandoverConfirmation(input: Record<string, unknown>) {
    return this.root().appendHandoverConfirmation(input);
  }
  find(id: string) {
    return this.root().find(id);
  }
  save(record: DelegationRecord) {
    return this.root().save(record);
  }
  confirmReceipt(id: string, input: Record<string, unknown>) {
    return this.root().confirmReceipt(id, input);
  }
  isReceiptConfirmed(id: string) {
    return this.root().isReceiptConfirmed(id);
  }
  reportAccessGap(id: string, input: Record<string, unknown>) {
    return this.root().reportAccessGap(id, input);
  }
  hasOpenAccessGap(id: string) {
    return this.root().hasOpenAccessGap(id);
  }
  findDelegation(id: string) {
    return this.root().findDelegation(id);
  }
  expireDelegation(id: string, occurredAt: string) {
    return this.root().expireDelegation(id, occurredAt);
  }
  appendReturn(input: Record<string, unknown>) {
    return this.root().appendReturn(input);
  }
  createCaseIfMissing(input: Omit<OffboardingCase, "id" | "state">) {
    return this.root().createCaseIfMissing(input);
  }
  findCase(id: string) {
    return this.root().findCase(id);
  }
  markResolved(id: string, input: Record<string, unknown>) {
    return this.root().markResolved(id, input);
  }
  appendNotificationIntent(input: Record<string, unknown>) {
    return this.root().appendNotificationIntent(input);
  }

  async resolveCaseInTransaction(
    transaction: DatabaseTransaction,
    caseId: string,
    input: Readonly<{
      actorId: string;
      successorId: string;
      effectiveAt: string;
      reason: string;
      correlationId: string;
    }>,
  ) {
    const adapter = new PrismaContinuityTransaction(transaction);
    const audit = await adapter.appendAudit({
      eventType: "continuity.reassignment.resolved",
      actorId: input.actorId,
      subjectId: input.successorId,
      targetId: caseId,
      reason: input.reason,
      correlationId: input.correlationId,
    });
    return adapter.markResolved(caseId, { ...input, auditEventId: audit.id });
  }
}

class PrismaContinuityTransaction
  implements ContinuityTransaction, DelegationTransaction, ReturnTransaction, OffboardingTransaction
{
  constructor(private readonly db: Db) {}

  async createLeave(input: LeaveRow): Promise<LeaveRow> {
    return serializeLeave(
      await this.db.leaveRecord.create({
        data: {
          id: input.id,
          employeeId: input.employeeId,
          departmentId: input.departmentId,
          state: input.state,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          reasonCategory: input.reasonCategory,
          affectedScopes: input.affectedScopes as never,
          version: input.version,
        },
      }),
    );
  }

  async findLeave(id: string): Promise<LeaveRow | null> {
    const row = await this.db.leaveRecord.findUnique({ where: { id } });
    return row ? serializeLeave(row) : null;
  }

  async updateLeave(id: string, state: LeaveRow["state"], version: number): Promise<LeaveRow> {
    return serializeLeave(
      await this.db.leaveRecord.update({ where: { id }, data: { state, version } }),
    );
  }

  async appendLeaveDecision(input: Record<string, unknown>) {
    await this.db.leaveDecision.create({
      data: {
        leaveId: text(input.leaveId),
        managerId: text(input.managerId),
        decision: text(input.decision) as "APPROVED" | "REJECTED",
        reason: text(input.reason),
        auditEventId: text(input.auditEventId),
        decidedAt: new Date(),
      },
    });
  }

  async appendLeaveTransition(input: Record<string, unknown>) {
    await this.db.leaveTransition.create({
      data: {
        leaveId: text(input.leaveId),
        fromState: text(input.fromState) as LeaveRow["state"],
        toState: text(input.toState) as LeaveRow["state"],
        actorId: text(input.actorId),
        reason: optionalText(input.reason),
        auditEventId: text(input.auditEventId),
        occurredAt: new Date(),
      },
    });
  }

  async appendEligibilityEffect(_input: Record<string, unknown>) {
    // Eligibility is projected from the approved leave interval; no duplicate mutable score row.
  }

  async appendAudit(input: Record<string, unknown>) {
    const actorId = text(input.actorId);
    return this.db.auditEvent.create({
      data: {
        eventType: text(input.eventType),
        actorKind: "human",
        actorId,
        effectiveSubjectId: optionalText(input.subjectId) ?? actorId,
        scopeType: optionalText(input.scopeType) ?? "system",
        scopeId: optionalText(input.scopeId) ?? optionalText(input.targetId) ?? actorId,
        targetType: "continuity_record",
        targetId: optionalText(input.targetId) ?? actorId,
        reason: optionalText(input.reason),
        correlationId: text(input.correlationId),
        source: "api",
      },
      select: { id: true },
    });
  }

  async findApprovedLeaveAt(employeeId: string, occurredAt: string): Promise<LeaveRow | null> {
    const row = await this.db.leaveRecord.findFirst({
      where: {
        employeeId,
        state: { in: ["APPROVED", "ACTIVE"] },
        startsAt: { lte: new Date(occurredAt) },
        endsAt: { gt: new Date(occurredAt) },
      },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    });
    return row ? serializeLeave(row) : null;
  }

  async currentHandoverRevision(handoverId: string) {
    return this.db.handoverRevision.count({ where: { handoverId } });
  }

  async appendHandoverRevision(input: Record<string, unknown>) {
    const handoverId = text(input.handoverId);
    const leaveId = text(input.leaveId);
    const employeeId = text(input.employeeId);
    await this.db.handoverRecord.upsert({
      where: { id: handoverId },
      create: { id: handoverId, leaveId, employeeId },
      update: {},
    });
    const items = input.items as readonly Record<string, unknown>[];
    const revision = await this.db.handoverRevision.create({
      data: {
        handoverId,
        revision: number(input.revision),
        authorId: text(input.actorId),
        auditEventId: text(input.auditEventId),
        items: {
          create: items.map((item, position) => {
            const scope = item.scope as { kind: "PROJECT" | "WORKSTREAM"; id: string };
            return {
              scopeKind: scope.kind,
              ...(scope.kind === "PROJECT" ? { projectId: scope.id } : { workstreamId: scope.id }),
              currentState: text(item.currentState),
              completedWork: text(item.completedWork),
              openWork: text(item.openWork),
              blockersAndRisks: text(item.blockersAndRisks),
              immediateNextStep: text(item.immediateNextStep),
              keyLinks: item.keyLinks as never,
              requiredAccess: item.requiredAccess as never,
              pendingDecisions: item.pendingDecisions as never,
              proposedDelegateId: optionalText(item.proposedDelegateId),
              position,
            };
          }),
        },
      },
      select: { id: true, revision: true },
    });
    await this.db.handoverRecord.update({
      where: { id: handoverId },
      data: { currentRevisionId: revision.id },
    });
    return { revision: revision.revision };
  }

  async appendHandoverConfirmation(_input: Record<string, unknown>) {
    // The append-only audit event is the employee confirmation receipt.
  }

  async find(id: string): Promise<DelegationRecord | null> {
    const row = await this.db.delegation.findUnique({
      where: { id },
      include: { periods: true, scopes: true },
    });
    return row ? serializeDelegation(row) : null;
  }

  async save(record: DelegationRecord): Promise<DelegationRecord> {
    const existing = await this.db.delegation.findUnique({ where: { id: record.id } });
    if (existing) {
      await this.db.delegation.update({
        where: { id: record.id },
        data: { state: record.state, version: record.version },
      });
      return record;
    }
    await this.db.delegation.create({
      data: {
        id: record.id,
        leaveId: record.leaveId,
        ownerId: record.ownerId,
        delegateId: record.delegateId,
        managerId: record.managerId,
        state: record.state,
        emergency: record.emergency,
        emergencyReason: record.emergencyReason,
        version: record.version,
        periods: {
          create: { startsAt: new Date(record.startsAt), endsAt: new Date(record.endsAt) },
        },
        scopes: {
          create: [
            ...record.projectIds.flatMap((projectId) =>
              record.actions
                .filter((action) => action.startsWith("project."))
                .map((action) => ({ scopeKind: "PROJECT" as const, projectId, action })),
            ),
            ...record.workstreamIds.flatMap((workstreamId) =>
              record.actions
                .filter((action) => action.startsWith("workstream."))
                .map((action) => ({ scopeKind: "WORKSTREAM" as const, workstreamId, action })),
            ),
          ],
        },
      },
    });
    return record;
  }

  async confirmReceipt(delegationId: string, input: Record<string, unknown>) {
    await this.db.delegateConfirmation.create({
      data: {
        delegationId,
        delegateId: text(input.delegateId),
        receiptConfirmed: true,
        accessConfirmed: true,
        auditEventId: text(input.auditEventId),
        confirmedAt: new Date(),
      },
    });
  }

  async isReceiptConfirmed(delegationId: string) {
    return (
      (await this.db.delegateConfirmation.count({
        where: { delegationId, receiptConfirmed: true, accessConfirmed: true },
      })) > 0
    );
  }

  async reportAccessGap(delegationId: string, input: Record<string, unknown>) {
    await this.db.delegationAccessGap.create({
      data: {
        delegationId,
        delegateId: text(input.delegateId),
        description: text(input.description),
        auditEventId: text(input.auditEventId),
        reportedAt: new Date(),
      },
    });
  }

  async hasOpenAccessGap(delegationId: string) {
    return (
      (await this.db.delegationAccessGap.count({ where: { delegationId, state: "OPEN" } })) > 0
    );
  }

  async findDelegation(id: string): Promise<ReturnDelegation | null> {
    const row = await this.db.delegation.findUnique({
      where: { id },
      select: { id: true, ownerId: true, delegateId: true, state: true },
    });
    if (!row || !["ACTIVE", "RETURNED", "EXPIRED"].includes(row.state)) return null;
    return { ...row, state: row.state as ReturnDelegation["state"] };
  }

  async expireDelegation(id: string, _occurredAt: string) {
    await this.db.delegation.update({ where: { id }, data: { state: "RETURNED" } });
  }

  async appendReturn(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const row = await this.db.returnHandover.create({
      data: {
        id: text(input.id),
        delegationId: text(input.delegationId),
        actingOwnerId: text(input.actingOwnerId),
        originalOwnerId: text(input.originalOwnerId),
        completedWork: text(input.completedWork),
        decisionsAndChanges: text(input.decisionsAndChanges),
        openWork: text(input.openWork),
        risksAndNextSteps: text(input.risksAndNextSteps),
        choice: text(input.choice) as "RETURN" | "EXTEND" | "PERMANENT_TRANSFER",
        confirmedById: optionalText(input.confirmedById),
        auditEventId: text(input.auditEventId),
      },
    });
    return { ...row, createdAt: row.createdAt.toISOString() };
  }

  async createCaseIfMissing(input: Omit<OffboardingCase, "id" | "state">) {
    const where = scopeWhere(input.scope);
    const existing = await this.db.reassignmentRequiredCase.findFirst({
      where: { formerOwnerId: input.formerOwnerId, state: "REASSIGNMENT_REQUIRED", ...where },
    });
    const row =
      existing ??
      (await this.db.reassignmentRequiredCase.create({
        data: {
          formerOwnerId: input.formerOwnerId,
          scopeKind: input.scope.kind,
          ...where,
          auditEventId: text((input as Record<string, unknown>).auditEventId),
        },
      }));
    return serializeCase(row, input.scope);
  }

  async findCase(id: string): Promise<OffboardingCase | null> {
    const row = await this.db.reassignmentRequiredCase.findUnique({
      where: { id },
      include: {
        project: { select: { version: true } },
        workstream: { select: { version: true, projectId: true } },
      },
    });
    if (!row) return null;
    const scope: OwnedScope = row.projectId
      ? { kind: "PROJECT", id: row.projectId, version: row.project?.version ?? 1 }
      : {
          kind: "WORKSTREAM",
          id: row.workstreamId!,
          ...(row.workstream?.projectId ? { projectId: row.workstream.projectId } : {}),
          version: row.workstream?.version ?? 1,
        };
    return serializeCase(row, scope);
  }

  async markResolved(id: string, input: Record<string, unknown>) {
    const current = await this.findCase(id);
    if (!current) throw new Error("reassignment case missing");
    await this.db.reassignmentResolution.create({
      data: {
        caseId: id,
        actorId: text(input.actorId ?? input.managerId ?? input.successorId),
        kind: "PERMANENT_REASSIGNMENT",
        successorId: optionalText(input.successorId),
        effectiveAt: new Date(text(input.effectiveAt)),
        reason: text(input.reason),
        auditEventId: text(input.auditEventId),
      },
    });
    await this.db.reassignmentRequiredCase.update({ where: { id }, data: { state: "RESOLVED" } });
    return { ...current, state: "RESOLVED" as const };
  }

  async appendNotificationIntent(_input: Record<string, unknown>) {
    // Durable queue wiring is intentionally outside E6A; the case itself is the operational queue.
  }
}

function serializeLeave(row: {
  id: string;
  employeeId: string;
  departmentId: string;
  state: string;
  startsAt: Date;
  endsAt: Date;
  reasonCategory: string;
  affectedScopes: unknown;
  version: number;
}): LeaveRow {
  return {
    id: row.id,
    employeeId: row.employeeId,
    departmentId: row.departmentId,
    state: row.state as LeaveRow["state"],
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    reasonCategory: row.reasonCategory as LeaveRow["reasonCategory"],
    affectedScopes: row.affectedScopes as LeaveRow["affectedScopes"],
    version: row.version,
  };
}

function serializeDelegation(row: {
  id: string;
  leaveId: string;
  ownerId: string;
  delegateId: string;
  managerId: string;
  state: string;
  emergency: boolean;
  emergencyReason: string | null;
  version: number;
  periods: readonly { startsAt: Date; endsAt: Date }[];
  scopes: readonly { projectId: string | null; workstreamId: string | null; action: string }[];
}): DelegationRecord {
  const period = row.periods[0];
  if (!period) throw new Error("delegation period missing");
  return {
    id: row.id,
    leaveId: row.leaveId,
    ownerId: row.ownerId,
    delegateId: row.delegateId,
    managerId: row.managerId,
    departmentId: "00000000-0000-4000-8000-000000000000",
    state: row.state as DelegationRecord["state"],
    startsAt: period.startsAt.toISOString(),
    endsAt: period.endsAt.toISOString(),
    projectIds: [
      ...new Set(row.scopes.flatMap((scope) => (scope.projectId ? [scope.projectId] : []))),
    ],
    workstreamIds: [
      ...new Set(row.scopes.flatMap((scope) => (scope.workstreamId ? [scope.workstreamId] : []))),
    ],
    actions: [...new Set(row.scopes.map((scope) => scope.action))] as DelegationRecord["actions"],
    emergency: row.emergency,
    emergencyReason: row.emergencyReason,
    version: row.version,
  };
}

function serializeCase(
  row: { id: string; formerOwnerId: string; state: string; createdAt: Date },
  scope: OwnedScope,
): OffboardingCase {
  return {
    id: row.id,
    formerOwnerId: row.formerOwnerId,
    scope,
    state: row.state as OffboardingCase["state"],
    createdAt: row.createdAt.toISOString(),
  };
}

function scopeWhere(scope: OwnedScope) {
  return scope.kind === "PROJECT" ? { projectId: scope.id } : { workstreamId: scope.id };
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.length === 0)
    throw new Error("continuity persistence field missing");
  return value;
}
function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function number(value: unknown): number {
  if (typeof value !== "number") throw new Error("continuity persistence number missing");
  return value;
}
