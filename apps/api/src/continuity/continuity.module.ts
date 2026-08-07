/* eslint-disable no-unused-vars */
import { databaseAuditWriter } from "@evaluation/audit";
import { deactivateInternalUser } from "@evaluation/auth";
import {
  DelegationService,
  HandoverService,
  LeaveService,
  OffboardingService,
  PrismaContinuityPersistence,
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
      useFactory: (store: PrismaContinuityPersistence, database: Database) =>
        new DelegationService(store, managerAuthorization(database)),
      inject: [PrismaContinuityPersistence, CONTINUITY_DATABASE],
    },
    {
      provide: ReturnService,
      useFactory: (store: PrismaContinuityPersistence) => new ReturnService(store),
      inject: [PrismaContinuityPersistence],
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
        ),
      inject: [PrismaContinuityPersistence, CONTINUITY_DATABASE, ResponsibilityService],
    },
    ContinuityPolicyGuard,
  ],
})(ContinuityModule);

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
