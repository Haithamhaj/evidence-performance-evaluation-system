/* eslint-disable no-unused-vars */
import { databaseAuditWriter } from "@evaluation/audit";
import { deactivateInternalUser } from "@evaluation/auth";
import { AppError } from "@evaluation/contracts";
import {
  DelegationService,
  ActingAuthorityReader,
  HandoverService,
  LeaveService,
  OffboardingService,
  PrismaContinuityPersistence,
  PrismaActingAuthoritySource,
  ReturnService,
  type ContinuityAuthorizationPort,
  type ContinuityScope,
  type ContinuityScopeReader,
  type OwnedScope,
} from "@evaluation/continuity";
import { createDatabaseClient } from "@evaluation/database";
import { createResponsibilityService, ResponsibilityService } from "@evaluation/projects";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { ContinuityPolicyGuard } from "./continuity-policy.guard.js";
import { DelegationController } from "./delegation.controller.js";
import { HandoverController } from "./handover.controller.js";
import { LeaveController } from "./leave.controller.js";
import { ReassignmentController } from "./reassignment.controller.js";

export const CONTINUITY_DATABASE = Symbol("CONTINUITY_DATABASE");
const CONTINUITY_LIFECYCLE = Symbol("CONTINUITY_LIFECYCLE");
type Database = ReturnType<typeof createDatabaseClient>;

export class ContinuityModule {}

/** Database-backed composition used by the module and deterministic acceptance journeys. */
export function createDatabaseContinuityRuntime(database: Database) {
  const persistence = new PrismaContinuityPersistence(database);
  const responsibilities = createResponsibilityService(database, databaseAuditWriter as never);
  return {
    persistence,
    responsibilities,
    leave: new LeaveService(persistence, scopeReader(database), managerAuthorization(database)),
    handover: new HandoverService(persistence, scopeReader(database)),
    delegation: new DelegationService(
      persistence,
      managerAuthorization(database),
      delegationSource(database),
      delegationAuthority(database, responsibilities, persistence),
    ),
    actingAuthority: new ActingAuthorityReader(new PrismaActingAuthoritySource(database)),
    returns: new ReturnService(
      persistence,
      managerAuthorization(database),
      returnDecisionPort(database, responsibilities, persistence),
    ),
    offboarding: new OffboardingService(
      persistence,
      deactivationPort(database),
      ownershipPort(database, responsibilities, persistence),
      reassignmentAuthorization(database),
      persistence,
    ),
  };
}

Module({
  imports: [AuthModule],
  controllers: [LeaveController, HandoverController, DelegationController, ReassignmentController],
  providers: [
    { provide: CONTINUITY_DATABASE, useFactory: () => createDatabaseClient(databaseUrl()) },
    {
      provide: CONTINUITY_LIFECYCLE,
      useFactory: (database: Database) => ({ onModuleDestroy: () => database.$disconnect() }),
      inject: [CONTINUITY_DATABASE],
    },
    {
      provide: PrismaContinuityPersistence,
      useFactory: (database: Database) => new PrismaContinuityPersistence(database),
      inject: [CONTINUITY_DATABASE],
    },
    {
      provide: ResponsibilityService,
      useFactory: (database: Database) =>
        createResponsibilityService(database, databaseAuditWriter as never),
      inject: [CONTINUITY_DATABASE],
    },
    {
      provide: LeaveService,
      useFactory: (store: PrismaContinuityPersistence, database: Database) =>
        new LeaveService(store, scopeReader(database), managerAuthorization(database)),
      inject: [PrismaContinuityPersistence, CONTINUITY_DATABASE],
    },
    {
      provide: HandoverService,
      useFactory: (store: PrismaContinuityPersistence, database: Database) =>
        new HandoverService(store, scopeReader(database)),
      inject: [PrismaContinuityPersistence, CONTINUITY_DATABASE],
    },
    {
      provide: DelegationService,
      useFactory: (
        store: PrismaContinuityPersistence,
        database: Database,
        responsibilities: ResponsibilityService,
      ) =>
        new DelegationService(
          store,
          managerAuthorization(database),
          delegationSource(database),
          delegationAuthority(database, responsibilities, store),
        ),
      inject: [PrismaContinuityPersistence, CONTINUITY_DATABASE, ResponsibilityService],
    },
    {
      provide: ActingAuthorityReader,
      useFactory: (database: Database) =>
        new ActingAuthorityReader(new PrismaActingAuthoritySource(database)),
      inject: [CONTINUITY_DATABASE],
    },
    {
      provide: ReturnService,
      useFactory: (
        store: PrismaContinuityPersistence,
        database: Database,
        responsibilities: ResponsibilityService,
      ) =>
        new ReturnService(
          store,
          managerAuthorization(database),
          returnDecisionPort(database, responsibilities, store),
        ),
      inject: [PrismaContinuityPersistence, CONTINUITY_DATABASE, ResponsibilityService],
    },
    {
      provide: OffboardingService,
      useFactory: (
        store: PrismaContinuityPersistence,
        database: Database,
        responsibilities: ResponsibilityService,
      ) =>
        new OffboardingService(
          store,
          deactivationPort(database),
          ownershipPort(database, responsibilities, store),
          reassignmentAuthorization(database),
          store,
        ),
      inject: [PrismaContinuityPersistence, CONTINUITY_DATABASE, ResponsibilityService],
    },
    ContinuityPolicyGuard,
  ],
  exports: [ActingAuthorityReader],
})(ContinuityModule);

function delegationSource(database: Database) {
  return {
    async verifyApprovalSource(input: {
      leaveId: string;
      ownerId: string;
      delegateId: string;
      departmentId: string;
      startsAt: string;
      endsAt: string;
      projectIds: readonly string[];
      workstreamIds: readonly string[];
    }) {
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      const leave = await database.leaveRecord.findUnique({
        where: { id: input.leaveId },
        include: {
          handovers: {
            where: { employeeId: input.ownerId },
            include: {
              currentRevision: {
                include: {
                  confirmations: { where: { employeeId: input.ownerId }, take: 1 },
                },
              },
            },
          },
        },
      });
      if (
        !leave ||
        leave.employeeId !== input.ownerId ||
        leave.departmentId !== input.departmentId ||
        !["APPROVED", "ACTIVE"].includes(leave.state) ||
        startsAt < leave.startsAt ||
        endsAt > leave.endsAt
      ) {
        throw continuityError("DELEGATION_LEAVE_INVALID");
      }
      const handover = leave.handovers[0];
      if (!handover?.currentRevision || handover.currentRevision.confirmations.length !== 1) {
        throw continuityError("DELEGATION_HANDOVER_CONFIRMATION_REQUIRED");
      }
      const affected = new Set(
        (leave.affectedScopes as Array<{ kind: string; id: string }>).map(
          (scope) => `${scope.kind}:${scope.id}`,
        ),
      );
      if (
        input.projectIds.some((id) => !affected.has(`PROJECT:${id}`)) ||
        input.workstreamIds.some((id) => !affected.has(`WORKSTREAM:${id}`))
      ) {
        throw continuityError("DELEGATION_SCOPE_INVALID");
      }
      const departmentScope = await database.authorizationScope.findFirst({
        where: { departmentId: input.departmentId, scopeType: "department" },
        select: { id: true },
      });
      const delegate = departmentScope
        ? await database.user.findFirst({
            where: {
              id: input.delegateId,
              active: true,
              roleAssignments: {
                some: {
                  role: "employee",
                  scopeType: "department",
                  scopeId: departmentScope.id,
                },
              },
            },
            select: { id: true },
          })
        : null;
      if (!delegate) throw continuityError("DELEGATION_DELEGATE_INVALID");
      const [ownedProjects, ownedWorkstreams] = await Promise.all([
        database.responsibilityWindow.count({
          where: {
            employeeId: input.ownerId,
            projectId: { in: [...input.projectIds] },
            responsibilityType: { in: ["original", "permanent"] },
            startsAt: { lte: startsAt },
            OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
            project: { departmentId: input.departmentId },
          },
        }),
        database.responsibilityWindow.count({
          where: {
            employeeId: input.ownerId,
            workstreamId: { in: [...input.workstreamIds] },
            responsibilityType: { in: ["original", "permanent"] },
            startsAt: { lte: startsAt },
            OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
            workstream: { project: { departmentId: input.departmentId } },
          },
        }),
      ]);
      if (
        ownedProjects !== new Set(input.projectIds).size ||
        ownedWorkstreams !== new Set(input.workstreamIds).size
      ) {
        throw continuityError("DELEGATION_OWNER_SCOPE_INVALID");
      }
      return { handoverRevisionId: handover.currentRevision.id };
    },
  };
}

function delegationAuthority(
  database: Database,
  responsibilities: ResponsibilityService,
  persistence: PrismaContinuityPersistence,
) {
  return {
    async activate(
      record: import("@evaluation/continuity").DelegationRecord,
      input: { actorId: string; correlationId: string },
    ) {
      const workstreams = await database.workstream.findMany({
        where: { id: { in: [...record.workstreamIds] } },
        select: { id: true, projectId: true },
      });
      let activated: import("@evaluation/continuity").DelegationRecord | undefined;
      await responsibilities.activateActingDelegation(
        {
          actor: { userId: input.actorId, active: true },
          correlationId: input.correlationId,
          delegationId: record.id,
          ownerId: record.ownerId,
          delegateId: record.delegateId,
          startsAt: record.startsAt,
          endsAt: record.endsAt,
          handoverRevisionId: record.handoverRevisionId,
          reason: record.emergencyReason ?? "Approved leave continuity delegation",
          scopes: [
            ...record.projectIds.map((id) => ({ kind: "PROJECT" as const, id })),
            ...workstreams.map((scope) => ({
              kind: "WORKSTREAM" as const,
              id: scope.id,
              projectId: scope.projectId,
            })),
          ],
        },
        async (transaction, windows) => {
          activated = await persistence.activateDelegationInTransaction(
            transaction,
            record,
            windows,
            input,
          );
        },
      );
      if (!activated) throw new Error("Atomic delegation activation missing");
      return activated;
    },
    async expire(
      record: import("@evaluation/continuity").DelegationRecord,
      input: { actorId: string; correlationId: string; occurredAt: string },
    ) {
      return persistence.expireDelegationAuthority(record, input);
    },
  };
}

function returnDecisionPort(
  database: Database,
  responsibilities: ResponsibilityService,
  persistence: PrismaContinuityPersistence,
) {
  return {
    async permanentTransfer(
      delegation: import("@evaluation/continuity").ReturnDelegation,
      input: {
        managerId: string;
        occurredAt: string;
        reason: string;
        correlationId: string;
      },
    ) {
      if (delegation.state === "ACTIVE") {
        await persistence.transaction(async (transaction) => {
          await transaction.expireDelegation(delegation.id, input.occurredAt);
        });
      }
      const scopes = await database.delegationScope.findMany({
        where: { delegationId: delegation.id },
        select: {
          projectId: true,
          workstreamId: true,
          workstream: { select: { projectId: true } },
        },
        distinct: ["projectId", "workstreamId"],
      });
      const effectiveAt = new Date(Date.parse(input.occurredAt) + 1).toISOString();
      for (const row of scopes) {
        const scope = row.projectId
          ? ({ kind: "PROJECT" as const, id: row.projectId } as const)
          : ({
              kind: "WORKSTREAM" as const,
              id: row.workstreamId!,
              projectId: row.workstream!.projectId,
            } as const);
        const scopeFilter =
          scope.kind === "PROJECT" ? { projectId: scope.id } : { workstreamId: scope.id };
        const currentOwner = await database.responsibilityWindow.findFirst({
          where: {
            ...scopeFilter,
            startsAt: { lte: new Date(effectiveAt) },
            OR: [{ endsAt: null }, { endsAt: { gt: new Date(effectiveAt) } }],
          },
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
          select: { employeeId: true, responsibilityType: true },
        });
        if (
          currentOwner?.employeeId === delegation.delegateId &&
          currentOwner.responsibilityType === "permanent"
        ) {
          continue;
        }
        const resource =
          scope.kind === "PROJECT"
            ? await database.project.findUniqueOrThrow({
                where: { id: scope.id },
                select: { version: true },
              })
            : await database.workstream.findUniqueOrThrow({
                where: { id: scope.id },
                select: { version: true },
              });
        await responsibilities.resolvePermanentReassignment({
          actor: { userId: input.managerId, active: true },
          correlationId: input.correlationId,
          scope,
          successorId: delegation.delegateId,
          effectiveAt,
          expectedVersion: resource.version,
          reason: input.reason,
        });
      }
    },
  };
}

function continuityError(code: string) {
  return new AppError(code, "errors.continuity.invalid", 409);
}

function managerAuthorization(database: Database): ContinuityAuthorizationPort {
  return {
    async canManageEmployee(managerId, employeeId, departmentId) {
      const scope = await database.authorizationScope.findFirst({
        where: { departmentId, scopeType: "department" },
        select: { id: true },
      });
      if (!scope) return false;
      const [manager, employee] = await Promise.all([
        database.roleAssignment.findFirst({
          where: { userId: managerId, role: "manager", scopeType: "department", scopeId: scope.id },
        }),
        database.roleAssignment.findFirst({
          where: {
            userId: employeeId,
            role: "employee",
            scopeType: "department",
            scopeId: scope.id,
          },
        }),
      ]);
      return manager !== null && employee !== null;
    },
  };
}

function scopeReader(database: Database): ContinuityScopeReader {
  return {
    async assertEmployeeScope(employeeId: string, scope: ContinuityScope) {
      const occurredAt = new Date();
      const common = {
        employeeId,
        startsAt: { lte: occurredAt },
        OR: [{ endsAt: null }, { endsAt: { gt: occurredAt } }],
      };
      const membership =
        scope.kind === "PROJECT"
          ? await database.projectMember.findFirst({ where: { ...common, projectId: scope.id } })
          : await database.workstreamMember.findFirst({
              where: { ...common, workstreamId: scope.id },
            });
      if (!membership) throw new Error("CONTINUITY_SCOPE_INVALID");
    },
  };
}

function deactivationPort(database: Database) {
  return {
    async deactivate(input: {
      administratorId: string;
      userId: string;
      occurredAt: string;
      correlationId: string;
    }) {
      const existingReceipt = await database.deactivationReceipt.findUnique({
        where: { idempotencyKey: input.correlationId },
      });
      if (existingReceipt) {
        return {
          userId: existingReceipt.userId,
          deactivatedAt: existingReceipt.deactivatedAt.toISOString(),
        };
      }
      const result = await deactivateInternalUser(
        database as never,
        databaseAuditWriter as never,
        input,
      );
      const audit = await database.auditEvent.findFirstOrThrow({
        where: { correlationId: input.correlationId, eventType: "identity.deactivated" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      await database.deactivationReceipt.upsert({
        where: { idempotencyKey: input.correlationId },
        create: {
          idempotencyKey: input.correlationId,
          userId: input.userId,
          administratorId: input.administratorId,
          preservedHistory: true,
          auditEventId: audit.id,
          deactivatedAt: new Date(input.occurredAt),
        },
        update: {},
      });
      return result;
    },
  };
}

function ownershipPort(
  database: Database,
  responsibilities: ResponsibilityService,
  persistence: PrismaContinuityPersistence,
) {
  return {
    async listActiveOwnedScopes(
      userId: string,
      occurredAt: string,
    ): Promise<readonly OwnedScope[]> {
      const at = new Date(occurredAt);
      const rows = await database.responsibilityWindow.findMany({
        where: {
          employeeId: userId,
          responsibilityType: { in: ["original", "permanent"] },
          startsAt: { lte: at },
          OR: [{ endsAt: null }, { endsAt: { gt: at } }],
        },
        include: {
          project: { select: { version: true } },
          workstream: { select: { version: true, projectId: true } },
        },
      });
      const scopes: OwnedScope[] = [];
      for (const row of rows) {
        if (row.projectId) {
          scopes.push({ kind: "PROJECT", id: row.projectId, version: row.project?.version ?? 1 });
          continue;
        }
        if (row.workstreamId) {
          scopes.push({
            kind: "WORKSTREAM",
            id: row.workstreamId,
            ...(row.workstream?.projectId ? { projectId: row.workstream.projectId } : {}),
            version: row.workstream?.version ?? 1,
          });
        }
      }
      return scopes;
    },
    async resolveReassignment(input: {
      caseId: string;
      scope: OwnedScope;
      actorId: string;
      successorId: string;
      effectiveAt: string;
      expectedVersion: number;
      reason: string;
      correlationId: string;
    }) {
      let resolved: Awaited<ReturnType<typeof persistence.resolveCaseInTransaction>> | undefined;
      await responsibilities.resolvePermanentReassignment(
        {
          actor: { userId: input.actorId, active: true },
          correlationId: input.correlationId,
          scope: input.scope,
          successorId: input.successorId,
          effectiveAt: input.effectiveAt,
          expectedVersion: input.expectedVersion,
          reason: input.reason,
        },
        async (transaction) => {
          resolved = await persistence.resolveCaseInTransaction(transaction, input.caseId, input);
        },
      );
      if (!resolved) throw new Error("Atomic reassignment case resolution missing");
      return resolved;
    },
  };
}

function reassignmentAuthorization(database: Database) {
  return {
    async canResolveReassignment(actorId: string, scope: OwnedScope) {
      const departmentId =
        scope.kind === "PROJECT"
          ? (
              await database.project.findUnique({
                where: { id: scope.id },
                select: { departmentId: true },
              })
            )?.departmentId
          : (
              await database.workstream.findUnique({
                where: { id: scope.id },
                select: { project: { select: { departmentId: true } } },
              })
            )?.project.departmentId;
      if (!departmentId) return false;
      const authorizationScope = await database.authorizationScope.findFirst({
        where: { departmentId, scopeType: "department" },
        select: { id: true },
      });
      if (!authorizationScope) return false;
      return (
        (await database.roleAssignment.count({
          where: {
            userId: actorId,
            role: "manager",
            scopeType: "department",
            scopeId: authorizationScope.id,
          },
        })) > 0
      );
    },
  };
}

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL must be configured");
  return value;
}
