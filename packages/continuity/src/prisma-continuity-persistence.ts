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
import type {
  ReturnDelegation,
  ReturnRecord,
  ReturnStore,
  ReturnTransaction,
} from "./return-service.js";

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
    return this.client
      .$transaction((transaction) => operation(new PrismaContinuityTransaction(transaction)), {
        isolationLevel: "Serializable",
      })
      .catch((error: unknown) => {
        if (
          hasCode(error, "P2034") ||
          hasCode(error, "P2002") ||
          hasCode(error, "40001") ||
          hasCode(error, "23505")
        ) {
          throw continuityConflict();
        }
        throw error;
      });
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
  findHandover(id: string) {
    return this.root().findHandover(id);
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
  findReceipt(id: string) {
    return this.root().findReceipt(id);
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
  resolveAccessGap(id: string, input: Record<string, unknown>) {
    return this.root().resolveAccessGap(id, input);
  }
  findDelegation(id: string) {
    return this.root().findDelegation(id);
  }
  findReturn(id: string) {
    return this.root().findReturn(id);
  }
  expireDelegation(id: string, occurredAt: string) {
    return this.root().expireDelegation(id, occurredAt);
  }
  appendReturn(input: Record<string, unknown>) {
    return this.root().appendReturn(input);
  }
  confirmReturn(id: string, input: Record<string, unknown>) {
    return this.root().confirmReturn(id, input);
  }
  finalizeReturn(id: string, input: Record<string, unknown>) {
    return this.root().finalizeReturn(id, input);
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
  listManagerQueue(managerId: string) {
    return this.root().listManagerQueue(managerId);
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

  async activateDelegationInTransaction(
    transaction: DatabaseTransaction,
    record: DelegationRecord,
    windows: ReadonlyMap<string, string>,
    input: Readonly<{ actorId: string; correlationId: string }>,
  ) {
    const adapter = new PrismaContinuityTransaction(transaction);
    const audit = await adapter.appendAudit({
      eventType: record.emergency
        ? "continuity.delegation.emergency_activated"
        : "continuity.delegation.activated",
      actorId: input.actorId,
      subjectId: record.delegateId,
      targetId: record.id,
      reason: record.emergencyReason,
      correlationId: input.correlationId,
    });
    const advanced = await transaction.delegation.updateMany({
      where: { id: record.id, state: "PENDING_DELEGATE", version: record.version },
      data: { state: "ACTIVE", version: { increment: 1 } },
    });
    if (advanced.count !== 1) throw continuityConflict();
    for (const [key, responsibilityWindowId] of windows) {
      const [scopeKind, scopeId] = key.split(":") as ["project" | "workstream", string];
      await transaction.delegationScope.updateMany({
        where: {
          delegationId: record.id,
          ...(scopeKind === "project" ? { projectId: scopeId } : { workstreamId: scopeId }),
        },
        data: { responsibilityWindowId },
      });
    }
    return {
      ...record,
      state: "ACTIVE" as const,
      version: record.version + 1,
      activationAuditEventId: audit.id,
    };
  }

  async expireDelegationAuthority(
    record: DelegationRecord,
    input: Readonly<{ actorId: string; correlationId: string; occurredAt: string }>,
  ) {
    return this.client.$transaction(
      async (transaction) => {
        const adapter = new PrismaContinuityTransaction(transaction);
        await adapter.appendAudit({
          eventType: "continuity.delegation.expired",
          actorId: input.actorId,
          targetId: record.id,
          correlationId: input.correlationId,
        });
        await adapter.expireDelegation(record.id, input.occurredAt, "EXPIRED");
        return { ...record, state: "EXPIRED" as const, version: record.version + 1 };
      },
      { isolationLevel: "Serializable" },
    );
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
    const updated = await this.db.leaveRecord.updateMany({
      where: { id, version: version - 1 },
      data: { state, version },
    });
    if (updated.count !== 1) throw continuityConflict();
    const row = await this.db.leaveRecord.findUniqueOrThrow({ where: { id } });
    return serializeLeave(row);
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
    const input = _input;
    await this.db.leaveEligibilityEffect.create({
      data: {
        leaveId: text(input.leaveId),
        employeeId: text(input.employeeId),
        startsAt: new Date(text(input.startsAt)),
        endsAt: new Date(text(input.endsAt)),
        checkInRequired: false,
        negativeRegularitySignal: false,
        evaluationObligationSuspended: true,
        auditEventId: text(input.auditEventId),
        publishedAt: new Date(),
      },
    });
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

  async findHandover(handoverId: string) {
    const row = await this.db.handoverRecord.findUnique({
      where: { id: handoverId },
      include: { currentRevision: { select: { id: true, revision: true } } },
    });
    return row
      ? {
          id: row.id,
          leaveId: row.leaveId,
          employeeId: row.employeeId,
          currentRevisionId: row.currentRevision?.id ?? null,
          currentRevision: row.currentRevision?.revision ?? 0,
        }
      : null;
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

  async appendHandoverConfirmation(input: Record<string, unknown>) {
    const handoverId = text(input.handoverId);
    const revisionId = text(input.revisionId);
    const employeeId = text(input.employeeId);
    await this.db.handoverConfirmation.upsert({
      where: {
        handoverId_revisionId_employeeId: { handoverId, revisionId, employeeId },
      },
      create: {
        handoverId,
        revisionId,
        employeeId,
        confirmedRevision: number(input.confirmedRevision),
        auditEventId: text(input.auditEventId),
        confirmedAt: new Date(),
      },
      update: {},
    });
  }

  async find(id: string): Promise<DelegationRecord | null> {
    const row = await this.db.delegation.findUnique({
      where: { id },
      include: { periods: true, scopes: true, leave: { select: { departmentId: true } } },
    });
    return row ? serializeDelegation(row) : null;
  }

  async save(record: DelegationRecord): Promise<DelegationRecord> {
    const existing = await this.db.delegation.findUnique({ where: { id: record.id } });
    if (existing) {
      const updated = await this.db.delegation.updateMany({
        where: { id: record.id, version: record.version - 1 },
        data: { state: record.state, version: record.version },
      });
      if (updated.count !== 1) throw continuityConflict();
      return record;
    }
    await this.db.delegation.create({
      data: {
        id: record.id,
        leaveId: record.leaveId,
        ownerId: record.ownerId,
        delegateId: record.delegateId,
        managerId: record.managerId,
        handoverRevisionId: record.handoverRevisionId,
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
    await this.db.delegateConfirmation.upsert({
      where: {
        delegationId_delegateId: {
          delegationId,
          delegateId: text(input.delegateId),
        },
      },
      create: {
        delegationId,
        delegateId: text(input.delegateId),
        receiptConfirmed: true,
        accessConfirmed: true,
        auditEventId: text(input.auditEventId),
        confirmedAt: new Date(),
      },
      update: {},
    });
  }

  async findReceipt(delegationId: string) {
    const row = await this.db.delegateConfirmation.findFirst({
      where: { delegationId },
      select: { delegateId: true, receiptConfirmed: true, accessConfirmed: true },
    });
    return row?.receiptConfirmed && row.accessConfirmed
      ? {
          delegateId: row.delegateId,
          receiptConfirmed: true as const,
          accessConfirmed: true as const,
        }
      : null;
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
      (await this.db.delegationAccessGap.count({
        where: { delegationId, state: "OPEN", resolution: null },
      })) > 0
    );
  }

  async resolveAccessGap(gapId: string, input: Record<string, unknown>) {
    const gap = await this.db.delegationAccessGap.findUnique({ where: { id: gapId } });
    if (!gap || gap.delegationId !== text(input.delegationId)) {
      throw continuityConflict("DELEGATION_ACCESS_GAP_NOT_FOUND", 404);
    }
    await this.db.delegationAccessGapResolution.create({
      data: {
        gapId,
        actorId: text(input.managerId),
        kind: text(input.resolution) as "RESOLVED" | "EMERGENCY_OVERRIDE",
        reason: text(input.reason),
        auditEventId: text(input.auditEventId),
        resolvedAt: new Date(),
      },
    });
  }

  async findDelegation(id: string): Promise<ReturnDelegation | null> {
    const row = await this.db.delegation.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        delegateId: true,
        managerId: true,
        state: true,
        leave: { select: { departmentId: true } },
      },
    });
    if (!row || !["ACTIVE", "RETURNED", "EXPIRED"].includes(row.state)) return null;
    return {
      id: row.id,
      ownerId: row.ownerId,
      delegateId: row.delegateId,
      managerId: row.managerId,
      departmentId: row.leave.departmentId,
      state: row.state as ReturnDelegation["state"],
    };
  }

  async findReturn(id: string) {
    const row = await this.db.returnHandover.findUnique({ where: { id } });
    return row ? serializeReturn(row) : null;
  }

  async expireDelegation(
    id: string,
    occurredAt: string,
    state: "RETURNED" | "EXPIRED" = "RETURNED",
  ) {
    const at = new Date(occurredAt);
    const delegation = await this.db.delegation.findUniqueOrThrow({
      where: { id },
      include: {
        scopes: {
          where: { responsibilityWindowId: { not: null } },
          include: { responsibilityWindow: true },
        },
      },
    });
    for (const scope of delegation.scopes) {
      const acting = scope.responsibilityWindow;
      if (!acting || acting.endsAt === null || at >= acting.endsAt) continue;
      await this.db.responsibilityWindow.update({
        where: { id: acting.id },
        data: { endsAt: at },
      });
      const where =
        acting.projectId !== null
          ? { projectId: acting.projectId }
          : { workstreamId: acting.workstreamId! };
      await this.db.responsibilityWindow.updateMany({
        where: {
          ...where,
          employeeId: delegation.ownerId,
          responsibilityType: "permanent",
          startsAt: acting.endsAt,
        },
        data: { startsAt: at },
      });
    }
    const updated = await this.db.delegation.updateMany({
      where: { id, state: "ACTIVE", version: delegation.version },
      data: { state, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw continuityConflict();
  }

  async appendReturn(input: Record<string, unknown>): Promise<ReturnRecord> {
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
        state: "DRAFT",
        version: 1,
        auditEventId: text(input.auditEventId),
      },
    });
    return serializeReturn(row);
  }

  async confirmReturn(id: string, input: Record<string, unknown>) {
    const updated = await this.db.returnHandover.updateMany({
      where: { id, state: "DRAFT", version: number(input.expectedVersion) },
      data: {
        state: "OWNER_CONFIRMED",
        version: { increment: 1 },
        confirmedById: text(input.confirmedById),
        confirmedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw continuityConflict();
    return serializeReturn(await this.db.returnHandover.findUniqueOrThrow({ where: { id } }));
  }

  async finalizeReturn(id: string, input: Record<string, unknown>) {
    const updated = await this.db.returnHandover.updateMany({
      where: { id, state: "OWNER_CONFIRMED", version: number(input.expectedVersion) },
      data: {
        state: "FINALIZED",
        version: { increment: 1 },
        choice: text(input.choice) as "RETURN" | "EXTEND" | "PERMANENT_TRANSFER",
        finalizedById: text(input.finalizedById),
        finalizedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw continuityConflict();
    return serializeReturn(await this.db.returnHandover.findUniqueOrThrow({ where: { id } }));
  }

  async createCaseIfMissing(input: Omit<OffboardingCase, "id" | "state">) {
    const where = scopeWhere(input.scope);
    const id = crypto.randomUUID();
    const auditEventId = text((input as Record<string, unknown>).auditEventId);
    if (input.scope.kind === "PROJECT") {
      await this.db.$executeRaw`
        INSERT INTO "ReassignmentRequiredCase"
          ("id","formerOwnerId","scopeKind","projectId","state","auditEventId","createdAt","updatedAt")
        VALUES
          (${id}::uuid,${input.formerOwnerId}::uuid,'PROJECT',${input.scope.id}::uuid,'REASSIGNMENT_REQUIRED',${auditEventId}::uuid,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
      `;
    } else {
      await this.db.$executeRaw`
        INSERT INTO "ReassignmentRequiredCase"
          ("id","formerOwnerId","scopeKind","workstreamId","state","auditEventId","createdAt","updatedAt")
        VALUES
          (${id}::uuid,${input.formerOwnerId}::uuid,'WORKSTREAM',${input.scope.id}::uuid,'REASSIGNMENT_REQUIRED',${auditEventId}::uuid,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
      `;
    }
    const row = await this.db.reassignmentRequiredCase.findFirstOrThrow({
      where: { formerOwnerId: input.formerOwnerId, state: "REASSIGNMENT_REQUIRED", ...where },
    });
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
    await this.db.reassignmentQueueItem.updateMany({
      where: { caseId: id, state: "REASSIGNMENT_REQUIRED" },
      data: { state: "RESOLVED", resolvedAt: new Date() },
    });
    return { ...current, state: "RESOLVED" as const };
  }

  async appendNotificationIntent(input: Record<string, unknown>) {
    const caseId = text(input.caseId);
    const record = await this.db.reassignmentRequiredCase.findUniqueOrThrow({
      where: { id: caseId },
      include: {
        project: { select: { departmentId: true } },
        workstream: { select: { project: { select: { departmentId: true } } } },
      },
    });
    const departmentId = record.project?.departmentId ?? record.workstream?.project.departmentId;
    if (!departmentId) throw new Error("Reassignment queue department missing");
    await this.db.reassignmentQueueItem.upsert({
      where: { caseId },
      create: {
        caseId,
        departmentId,
        state: "REASSIGNMENT_REQUIRED",
        auditEventId: record.auditEventId,
      },
      update: {},
    });
  }

  async listManagerQueue(managerId: string): Promise<readonly OffboardingCase[]> {
    const assignments = await this.db.roleAssignment.findMany({
      where: { userId: managerId, role: "manager", scopeType: "department" },
      include: { scope: { select: { departmentId: true } } },
    });
    const departmentIds = assignments.flatMap(({ scope }) =>
      scope.departmentId ? [scope.departmentId] : [],
    );
    const rows = await this.db.reassignmentQueueItem.findMany({
      where: { departmentId: { in: departmentIds }, state: "REASSIGNMENT_REQUIRED" },
      include: {
        case: {
          include: {
            project: { select: { version: true } },
            workstream: { select: { version: true, projectId: true } },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(({ case: record }) => {
      const scope: OwnedScope = record.projectId
        ? { kind: "PROJECT", id: record.projectId, version: record.project?.version ?? 1 }
        : {
            kind: "WORKSTREAM",
            id: record.workstreamId!,
            ...(record.workstream?.projectId ? { projectId: record.workstream.projectId } : {}),
            version: record.workstream?.version ?? 1,
          };
      return serializeCase(record, scope);
    });
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
  handoverRevisionId: string;
  leave: { departmentId: string };
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
    departmentId: row.leave.departmentId,
    handoverRevisionId: row.handoverRevisionId,
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

function serializeReturn(row: {
  id: string;
  delegationId: string;
  actingOwnerId: string;
  originalOwnerId: string;
  state: string;
  version: number;
  choice: string | null;
}): ReturnRecord {
  return {
    id: row.id,
    delegationId: row.delegationId,
    actingOwnerId: row.actingOwnerId,
    originalOwnerId: row.originalOwnerId,
    state: row.state as ReturnRecord["state"],
    version: row.version,
    choice: row.choice as ReturnRecord["choice"],
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

function continuityConflict(code = "VERSION_CONFLICT", status = 409) {
  const error = new Error(code) as Error & { code: string; status: number };
  error.code = code;
  error.status = status;
  return error;
}

function hasCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === code) return true;
  if ("cause" in error && hasCode(error.cause, code)) return true;
  if ("driverAdapterError" in error && hasCode(error.driverAdapterError, code)) return true;
  return "meta" in error && hasCode(error.meta, code);
}
