import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  ResponsibilityAtSchema,
  ResponsibilityWindowSchema,
  TransferOwnershipSchema,
} from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";
import { z } from "zod";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type AuditWriter = import("@evaluation/contracts").AuditWriter<Transaction>;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const ProjectTransferSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    projectId: z.string().uuid(),
    input: TransferOwnershipSchema,
  })
  .strict();
const WorkstreamTransferSchema = ProjectTransferSchema.extend({
  workstreamId: z.string().uuid(),
}).strict();
const ProjectAtSchema = z
  .object({ actor: ActorSchema, projectId: z.string().uuid(), at: ResponsibilityAtSchema.shape.at })
  .strict();
const WorkstreamAtSchema = ProjectAtSchema.extend({ workstreamId: z.string().uuid() }).strict();
const ProjectHistorySchema = z
  .object({ actor: ActorSchema, projectId: z.string().uuid() })
  .strict();
const WorkstreamHistorySchema = ProjectHistorySchema.extend({
  workstreamId: z.string().uuid(),
}).strict();

type TransferScope = Readonly<{
  kind: "project" | "workstream";
  projectId: string;
  workstreamId: string | null;
}>;

type OwnershipTransferResult = Readonly<{
  id: string;
  transferKind: "acting" | "permanent";
  closedWindowId: string;
  newOwnerWindowId: string;
  returnWindowId: string | null;
  effectiveAt: string;
  version: number;
}>;

export type ReassignmentOwnershipCommand = Readonly<{
  actor: Readonly<{ userId: string; active: boolean }>;
  correlationId: string;
  scope: Readonly<{ kind: "PROJECT" | "WORKSTREAM"; id: string; projectId?: string }>;
  successorId: string;
  effectiveAt: string;
  expectedVersion: number;
  reason: string;
}>;

export type ActingDelegationCommand = Readonly<{
  actor: Readonly<{ userId: string; active: boolean }>;
  correlationId: string;
  delegationId: string;
  ownerId: string;
  delegateId: string;
  startsAt: string;
  endsAt: string;
  handoverRevisionId: string;
  reason: string;
  scopes: ReadonlyArray<
    Readonly<{ kind: "PROJECT" | "WORKSTREAM"; id: string; projectId?: string }>
  >;
}>;

export type ContinuityAuthorityDecision<T> = Readonly<{
  actor: Readonly<{ userId: string; active: boolean }>;
  correlationId: string;
  delegationId: string;
  ownerId: string;
  delegateId: string;
  handoverRevisionId: string;
  choice: "RETURN" | "EXTEND" | "PERMANENT_TRANSFER";
  occurredAt: string;
  currentEndsAt: string;
  extendedEndsAt: string | null;
  reason: string;
  scopes: ReadonlyArray<
    Readonly<{ kind: "PROJECT" | "WORKSTREAM"; id: string; projectId?: string }>
  >;
  result: T;
}>;

export class ResponsibilityService {
  private readonly client: DatabaseClient;
  private readonly auditWriter: AuditWriter;
  private readonly clock: () => Date;

  constructor(client: DatabaseClient, auditWriter: AuditWriter, clock: () => Date) {
    this.client = client;
    this.auditWriter = auditWriter;
    this.clock = clock;
  }

  async transferProjectOwner(command: unknown): Promise<OwnershipTransferResult> {
    const parsed = ProjectTransferSchema.parse(command);
    return this.transferOwner(
      { kind: "project", projectId: parsed.projectId, workstreamId: null },
      parsed,
    );
  }

  async transferWorkstreamOwner(command: unknown): Promise<OwnershipTransferResult> {
    const parsed = WorkstreamTransferSchema.parse(command);
    return this.transferOwner(
      {
        kind: "workstream",
        projectId: parsed.projectId,
        workstreamId: parsed.workstreamId,
      },
      parsed,
    );
  }

  async resolvePermanentReassignment(
    command: ReassignmentOwnershipCommand,
    afterTransfer?: (transaction: Transaction) => Promise<void>,
  ): Promise<OwnershipTransferResult> {
    const input = {
      actor: command.actor,
      correlationId: command.correlationId,
      projectId: command.scope.kind === "PROJECT" ? command.scope.id : command.scope.projectId,
      ...(command.scope.kind === "WORKSTREAM" ? { workstreamId: command.scope.id } : {}),
      input: {
        transferKind: "permanent" as const,
        toUserId: command.successorId,
        effectiveAt: command.effectiveAt,
        expectedVersion: command.expectedVersion,
        reason: command.reason,
      },
    };
    return command.scope.kind === "PROJECT"
      ? this.transferOwner(
          { kind: "project", projectId: command.scope.id, workstreamId: null },
          ProjectTransferSchema.parse(input),
          afterTransfer,
        )
      : this.transferOwner(
          {
            kind: "workstream",
            projectId: command.scope.projectId!,
            workstreamId: command.scope.id,
          },
          WorkstreamTransferSchema.parse(input),
          afterTransfer,
        );
  }

  async activateActingDelegation(
    command: ActingDelegationCommand,
    afterActivation: (
      transaction: Transaction,
      windows: ReadonlyMap<string, string>,
    ) => Promise<void>,
  ): Promise<ReadonlyMap<string, string>> {
    const current = validClock(this.clock());
    const startsAt = new Date(command.startsAt);
    const endsAt = new Date(command.endsAt);
    validClock(startsAt);
    validClock(endsAt);
    if (startsAt >= endsAt) throw resourceError("RESPONSIBILITY_PERIOD_INVALID", 400);
    const scopes = [...command.scopes]
      .map((scope) =>
        scope.kind === "PROJECT"
          ? ({ kind: "project", projectId: scope.id, workstreamId: null } as const)
          : ({
              kind: "workstream",
              projectId: scope.projectId!,
              workstreamId: scope.id,
            } as const),
      )
      .sort((left, right) => resourceId(left).localeCompare(resourceId(right)));
    return serializable(this.client, async (transaction) => {
      const windows = new Map<string, string>();
      for (const scope of scopes) {
        await lockResource(transaction, scope);
        const authorization = await authorizeTransfer(transaction, command.actor, scope, current);
        if (authorization.status !== "active" && authorization.status !== "paused") {
          throw resourceError("RESOURCE_STATE_INVALID", 409);
        }
        const target = await transaction.user.findFirst({
          where: {
            id: command.delegateId,
            active: true,
            roleAssignments: {
              some: {
                role: "employee",
                scopeType: "department",
                scopeId: authorization.departmentScopeId,
              },
            },
          },
          select: { id: true },
        });
        if (target === null) throw resourceError("RESPONSIBILITY_TARGET_INVALID", 400);
        const closedWindow = await transaction.responsibilityWindow.findFirst({
          where: {
            ...scopeWhere(scope),
            employeeId: command.ownerId,
            responsibilityType: { in: ["original", "permanent"] },
            startsAt: { lte: startsAt },
            OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
          },
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        });
        if (closedWindow === null || startsAt <= closedWindow.startsAt) {
          throw resourceError("PRIMARY_OWNER_REQUIRED", 409);
        }
        await ensureMembership(transaction, scope, target.id, startsAt, {
          actor: command.actor,
          correlationId: command.correlationId,
          projectId: scope.projectId,
          ...(scope.workstreamId ? { workstreamId: scope.workstreamId } : {}),
          input: {
            transferKind: "acting",
            toUserId: target.id,
            effectiveAt: command.startsAt,
            endsAt: command.endsAt,
            delegationType: "approved_leave",
            relatedHandoverReference: command.handoverRevisionId,
            expectedVersion: authorization.version,
            reason: command.reason,
          },
        } as never);
        await transaction.responsibilityWindow.update({
          where: { id: closedWindow.id },
          data: { endsAt: startsAt },
        });
        await transaction.roleAssignment.upsert({
          where: {
            userId_role_scopeType_scopeId: {
              userId: target.id,
              role: "acting_owner",
              scopeType: scope.kind,
              scopeId: resourceId(scope),
            },
          },
          create: {
            userId: target.id,
            role: "acting_owner",
            scopeType: scope.kind,
            scopeId: resourceId(scope),
          },
          update: {},
        });
        const common = {
          ...scopeCreateData(scope),
          reason: command.reason,
          managerDecisionById: command.actor.userId,
          managerDecisionAt: current,
          managerDecisionReason: command.reason,
          relatedHandoverReference: command.handoverRevisionId,
          createdById: command.actor.userId,
        };
        const acting = await transaction.responsibilityWindow.create({
          data: {
            ...common,
            employeeId: target.id,
            responsibilityType: "acting",
            startsAt,
            endsAt,
            delegationType: "approved_leave",
          },
        });
        const returning = await transaction.responsibilityWindow.create({
          data: {
            ...common,
            employeeId: command.ownerId,
            responsibilityType: "permanent",
            startsAt: endsAt,
          },
        });
        const transfer = await transaction.ownershipTransfer.create({
          data: {
            ...scopeCreateData(scope),
            transferKind: "acting",
            closedWindowId: closedWindow.id,
            newOwnerWindowId: acting.id,
            returnWindowId: returning.id,
            effectiveAt: startsAt,
            reason: command.reason,
            managerDecisionById: command.actor.userId,
            managerDecisionAt: current,
            managerDecisionReason: command.reason,
          },
        });
        await incrementVersion(transaction, scope, authorization.version);
        await this.auditWriter.append(transaction, {
          eventType:
            scope.kind === "project" ? "project.owner_transferred" : "workstream.owner_transferred",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: target.id,
          scopeType: scope.kind,
          scopeId: resourceId(scope),
          targetType: "ownership_transfer",
          targetId: transfer.id,
          reason: command.reason,
          safeDiff: {
            delegationId: command.delegationId,
            fromUserId: command.ownerId,
            toUserId: target.id,
            transferKind: "acting",
            effectiveAt: command.startsAt,
            endsAt: command.endsAt,
          },
          correlationId: command.correlationId,
          source: "api",
        });
        windows.set(`${scope.kind}:${resourceId(scope)}`, acting.id);
      }
      await afterActivation(transaction, windows);
      return windows;
    });
  }

  async finalizeContinuityAuthority<T>(
    prepare: (transaction: Transaction) => Promise<ContinuityAuthorityDecision<T>>,
  ): Promise<T> {
    const current = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      const decision = await prepare(transaction);
      const occurredAt = validClock(new Date(decision.occurredAt));
      const currentEndsAt = validClock(new Date(decision.currentEndsAt));
      const extendedEndsAt = decision.extendedEndsAt
        ? validClock(new Date(decision.extendedEndsAt))
        : null;
      const scopes = [...decision.scopes]
        .map((scope) =>
          scope.kind === "PROJECT"
            ? ({ kind: "project", projectId: scope.id, workstreamId: null } as const)
            : ({
                kind: "workstream",
                projectId: scope.projectId!,
                workstreamId: scope.id,
              } as const),
        )
        .sort((left, right) => resourceId(left).localeCompare(resourceId(right)));

      for (const scope of scopes) {
        await lockResource(transaction, scope);
        const authorization = await authorizeTransfer(transaction, decision.actor, scope, current);
        if (authorization.status !== "active" && authorization.status !== "paused") {
          throw resourceError("RESOURCE_STATE_INVALID", 409);
        }
        const scopeFilter = scopeWhere(scope);
        if (decision.choice === "EXTEND") {
          if (!extendedEndsAt || extendedEndsAt <= currentEndsAt) {
            throw resourceError("RESPONSIBILITY_PERIOD_INVALID", 400);
          }
          const shifted = await transaction.responsibilityWindow.updateMany({
            where: {
              ...scopeFilter,
              employeeId: decision.ownerId,
              responsibilityType: "permanent",
              startsAt: currentEndsAt,
              relatedHandoverReference: decision.handoverRevisionId,
            },
            data: { startsAt: extendedEndsAt },
          });
          if (shifted.count !== 1) throw resourceError("PRIMARY_OWNER_REQUIRED", 409);
          await transaction.responsibilityWindow.create({
            data: {
              ...scopeCreateData(scope),
              employeeId: decision.delegateId,
              responsibilityType: "acting",
              startsAt: currentEndsAt,
              endsAt: extendedEndsAt,
              reason: decision.reason,
              managerDecisionById: decision.actor.userId,
              managerDecisionAt: current,
              managerDecisionReason: decision.reason,
              relatedHandoverReference: decision.handoverRevisionId,
              delegationType: "approved_leave",
              createdById: decision.actor.userId,
            },
          });
          await incrementVersion(transaction, scope, authorization.version);
          continue;
        }

        const acting = await transaction.responsibilityWindow.findFirst({
          where: {
            ...scopeFilter,
            employeeId: decision.delegateId,
            responsibilityType: "acting",
            relatedHandoverReference: decision.handoverRevisionId,
            startsAt: { lte: occurredAt },
            endsAt: { gt: occurredAt },
          },
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        });
        if (!acting?.endsAt) throw resourceError("PRIMARY_OWNER_REQUIRED", 409);
        await transaction.responsibilityWindow.update({
          where: { id: acting.id },
          data: { endsAt: occurredAt },
        });
        const shifted = await transaction.responsibilityWindow.updateMany({
          where: {
            ...scopeFilter,
            employeeId: decision.ownerId,
            responsibilityType: "permanent",
            startsAt: acting.endsAt,
            relatedHandoverReference: decision.handoverRevisionId,
          },
          data: { startsAt: occurredAt },
        });
        if (shifted.count !== 1) throw resourceError("PRIMARY_OWNER_REQUIRED", 409);

        if (decision.choice === "RETURN") {
          await incrementVersion(transaction, scope, authorization.version);
          continue;
        }
        await applyContinuityPermanentTransfer(
          transaction,
          scope,
          authorization,
          decision,
          new Date(occurredAt.getTime() + 1),
          current,
          this.auditWriter,
        );
      }
      return decision.result;
    });
  }

  async responsibilitiesAt(command: unknown) {
    const parsed = ProjectAtSchema.parse(command);
    return this.queryAt(
      { kind: "project", projectId: parsed.projectId, workstreamId: null },
      parsed.actor,
      new Date(parsed.at),
    );
  }

  async workstreamResponsibilitiesAt(command: unknown) {
    const parsed = WorkstreamAtSchema.parse(command);
    return this.queryAt(
      {
        kind: "workstream",
        projectId: parsed.projectId,
        workstreamId: parsed.workstreamId,
      },
      parsed.actor,
      new Date(parsed.at),
    );
  }

  async responsibilityHistory(command: unknown) {
    const parsed = ProjectHistorySchema.parse(command);
    return this.queryHistory(
      { kind: "project", projectId: parsed.projectId, workstreamId: null },
      parsed.actor,
    );
  }

  async workstreamResponsibilityHistory(command: unknown) {
    const parsed = WorkstreamHistorySchema.parse(command);
    return this.queryHistory(
      {
        kind: "workstream",
        projectId: parsed.projectId,
        workstreamId: parsed.workstreamId,
      },
      parsed.actor,
    );
  }

  private async transferOwner(
    scope: TransferScope,
    command: z.infer<typeof ProjectTransferSchema> | z.infer<typeof WorkstreamTransferSchema>,
    afterTransfer?: (transaction: Transaction) => Promise<void>,
  ): Promise<OwnershipTransferResult> {
    const current = validClock(this.clock());
    const effectiveAt = new Date(command.input.effectiveAt);
    return serializable(this.client, async (transaction) => {
      await lockResource(transaction, scope);
      const authorization = await authorizeTransfer(transaction, command.actor, scope, current);
      if (authorization.status !== "active" && authorization.status !== "paused") {
        throw resourceError("RESOURCE_STATE_INVALID", 409);
      }
      if (authorization.version !== command.input.expectedVersion) {
        throw resourceError("VERSION_CONFLICT", 409);
      }
      const target = await transaction.user.findFirst({
        where: {
          id: command.input.toUserId,
          active: true,
          roleAssignments: {
            some: {
              role: "employee",
              scopeType: "department",
              scopeId: authorization.departmentScopeId,
            },
          },
        },
        select: { id: true },
      });
      if (target === null) throw resourceError("RESPONSIBILITY_TARGET_INVALID", 400);

      const closedWindow = await transaction.responsibilityWindow.findFirst({
        where: {
          ...scopeWhere(scope),
          responsibilityType: { in: ["original", "acting", "permanent"] },
          startsAt: { lte: effectiveAt },
          OR: [{ endsAt: null }, { endsAt: { gt: effectiveAt } }],
        },
        orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      });
      if (closedWindow === null) throw resourceError("PRIMARY_OWNER_REQUIRED", 409);
      if (closedWindow.responsibilityType === "acting") {
        throw resourceError("NESTED_ACTING_TRANSFER", 409);
      }
      if (closedWindow.employeeId === target.id) {
        throw resourceError("RESOURCE_STATE_INVALID", 409);
      }
      if (effectiveAt.getTime() <= closedWindow.startsAt.getTime()) {
        throw resourceError("RESPONSIBILITY_PERIOD_INVALID", 400);
      }

      await ensureMembership(transaction, scope, target.id, effectiveAt, command);
      await transaction.responsibilityWindow.update({
        where: { id: closedWindow.id },
        data: { endsAt: effectiveAt },
      });

      const ownerRole =
        command.input.transferKind === "acting"
          ? "acting_owner"
          : scope.kind === "project"
            ? "project_owner"
            : "workstream_owner";
      await transaction.roleAssignment.upsert({
        where: {
          userId_role_scopeType_scopeId: {
            userId: target.id,
            role: ownerRole,
            scopeType: scope.kind,
            scopeId: resourceId(scope),
          },
        },
        create: {
          userId: target.id,
          role: ownerRole,
          scopeType: scope.kind,
          scopeId: resourceId(scope),
        },
        update: {},
      });

      const commonWindowData = {
        ...scopeCreateData(scope),
        reason: command.input.reason,
        managerDecisionById: command.actor.userId,
        managerDecisionAt: current,
        managerDecisionReason: command.input.reason,
        relatedHandoverReference: command.input.relatedHandoverReference ?? null,
        createdById: command.actor.userId,
      };
      const newOwnerWindow = await transaction.responsibilityWindow.create({
        data:
          command.input.transferKind === "acting"
            ? {
                ...commonWindowData,
                employeeId: target.id,
                responsibilityType: "acting",
                startsAt: effectiveAt,
                endsAt: new Date(command.input.endsAt),
                delegationType: command.input.delegationType,
              }
            : {
                ...commonWindowData,
                employeeId: target.id,
                responsibilityType: "permanent",
                startsAt: effectiveAt,
              },
      });
      const returnWindow =
        command.input.transferKind === "acting"
          ? await transaction.responsibilityWindow.create({
              data: {
                ...commonWindowData,
                employeeId: closedWindow.employeeId,
                responsibilityType: "permanent",
                startsAt: new Date(command.input.endsAt),
              },
            })
          : null;
      const transfer = await transaction.ownershipTransfer.create({
        data: {
          ...scopeCreateData(scope),
          transferKind: command.input.transferKind,
          closedWindowId: closedWindow.id,
          newOwnerWindowId: newOwnerWindow.id,
          returnWindowId: returnWindow?.id ?? null,
          effectiveAt,
          reason: command.input.reason,
          managerDecisionById: command.actor.userId,
          managerDecisionAt: current,
          managerDecisionReason: command.input.reason,
        },
      });
      await incrementVersion(transaction, scope, command.input.expectedVersion);
      await this.auditWriter.append(transaction, {
        eventType:
          scope.kind === "project" ? "project.owner_transferred" : "workstream.owner_transferred",
        actor: { kind: "human", id: command.actor.userId },
        effectiveSubjectId: target.id,
        scopeType: scope.kind,
        scopeId: resourceId(scope),
        targetType: "ownership_transfer",
        targetId: transfer.id,
        reason: command.input.reason,
        safeDiff: {
          projectId: scope.projectId,
          workstreamId: scope.workstreamId,
          fromUserId: closedWindow.employeeId,
          toUserId: target.id,
          transferKind: command.input.transferKind,
          effectiveAt: effectiveAt.toISOString(),
          returnWindowId: returnWindow?.id ?? null,
          version: command.input.expectedVersion + 1,
        },
        correlationId: command.correlationId,
        source: "api",
      });
      await afterTransfer?.(transaction);
      return {
        id: transfer.id,
        transferKind: transfer.transferKind,
        closedWindowId: transfer.closedWindowId,
        newOwnerWindowId: transfer.newOwnerWindowId,
        returnWindowId: transfer.returnWindowId,
        effectiveAt: transfer.effectiveAt.toISOString(),
        version: command.input.expectedVersion + 1,
      };
    });
  }

  private async queryAt(
    scope: TransferScope,
    actor: Readonly<{ userId: string; active: boolean }>,
    at: Date,
  ) {
    validClock(at);
    return this.client.$transaction(async (transaction) => {
      await authorizeRead(transaction, actor, scope, validClock(this.clock()));
      const rows = await transaction.responsibilityWindow.findMany({
        where: {
          ...scopeWhere(scope),
          startsAt: { lte: at },
          OR: [{ endsAt: null }, { endsAt: { gt: at } }],
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      });
      return rows.map(serializeWindow);
    });
  }

  private async queryHistory(
    scope: TransferScope,
    actor: Readonly<{ userId: string; active: boolean }>,
  ) {
    return this.client.$transaction(async (transaction) => {
      await authorizeRead(transaction, actor, scope, validClock(this.clock()));
      const rows = await transaction.responsibilityWindow.findMany({
        where: scopeWhere(scope),
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      });
      return rows.map(serializeWindow);
    });
  }
}

async function applyContinuityPermanentTransfer<T>(
  transaction: Transaction,
  scope: TransferScope,
  authorization: Awaited<ReturnType<typeof authorizeTransfer>>,
  decision: ContinuityAuthorityDecision<T>,
  effectiveAt: Date,
  current: Date,
  auditWriter: AuditWriter,
) {
  const target = await transaction.user.findFirst({
    where: {
      id: decision.delegateId,
      active: true,
      roleAssignments: {
        some: {
          role: "employee",
          scopeType: "department",
          scopeId: authorization.departmentScopeId,
        },
      },
    },
    select: { id: true },
  });
  if (!target) throw resourceError("RESPONSIBILITY_TARGET_INVALID", 400);
  const closedWindow = await transaction.responsibilityWindow.findFirst({
    where: {
      ...scopeWhere(scope),
      employeeId: decision.ownerId,
      responsibilityType: { in: ["original", "permanent"] },
      startsAt: { lte: effectiveAt },
      OR: [{ endsAt: null }, { endsAt: { gt: effectiveAt } }],
    },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
  });
  if (!closedWindow || effectiveAt <= closedWindow.startsAt) {
    throw resourceError("PRIMARY_OWNER_REQUIRED", 409);
  }
  await ensureMembership(transaction, scope, target.id, effectiveAt, {
    actor: decision.actor,
    correlationId: decision.correlationId,
    projectId: scope.projectId,
    ...(scope.workstreamId ? { workstreamId: scope.workstreamId } : {}),
    input: {
      transferKind: "permanent",
      toUserId: target.id,
      effectiveAt: effectiveAt.toISOString(),
      expectedVersion: authorization.version,
      reason: decision.reason,
    },
  } as never);
  await transaction.responsibilityWindow.update({
    where: { id: closedWindow.id },
    data: { endsAt: effectiveAt },
  });
  const ownerRole = scope.kind === "project" ? "project_owner" : "workstream_owner";
  await transaction.roleAssignment.upsert({
    where: {
      userId_role_scopeType_scopeId: {
        userId: target.id,
        role: ownerRole,
        scopeType: scope.kind,
        scopeId: resourceId(scope),
      },
    },
    create: {
      userId: target.id,
      role: ownerRole,
      scopeType: scope.kind,
      scopeId: resourceId(scope),
    },
    update: {},
  });
  const newOwnerWindow = await transaction.responsibilityWindow.create({
    data: {
      ...scopeCreateData(scope),
      employeeId: target.id,
      responsibilityType: "permanent",
      startsAt: effectiveAt,
      reason: decision.reason,
      managerDecisionById: decision.actor.userId,
      managerDecisionAt: current,
      managerDecisionReason: decision.reason,
      relatedHandoverReference: decision.handoverRevisionId,
      createdById: decision.actor.userId,
    },
  });
  const transfer = await transaction.ownershipTransfer.create({
    data: {
      ...scopeCreateData(scope),
      transferKind: "permanent",
      closedWindowId: closedWindow.id,
      newOwnerWindowId: newOwnerWindow.id,
      effectiveAt,
      reason: decision.reason,
      managerDecisionById: decision.actor.userId,
      managerDecisionAt: current,
      managerDecisionReason: decision.reason,
    },
  });
  await incrementVersion(transaction, scope, authorization.version);
  await auditWriter.append(transaction, {
    eventType:
      scope.kind === "project" ? "project.owner_transferred" : "workstream.owner_transferred",
    actor: { kind: "human", id: decision.actor.userId },
    effectiveSubjectId: target.id,
    scopeType: scope.kind,
    scopeId: resourceId(scope),
    targetType: "ownership_transfer",
    targetId: transfer.id,
    reason: decision.reason,
    safeDiff: {
      delegationId: decision.delegationId,
      fromUserId: decision.ownerId,
      toUserId: target.id,
      transferKind: "permanent",
      effectiveAt: effectiveAt.toISOString(),
      version: authorization.version + 1,
    },
    correlationId: decision.correlationId,
    source: "api",
  });
}

export function createResponsibilityService(
  client: DatabaseClient,
  writer: AuditWriter = databaseAuditWriter as AuditWriter,
  clock: () => Date = () => new Date(),
): ResponsibilityService {
  return new ResponsibilityService(client, writer, clock);
}

async function lockResource(transaction: Transaction, scope: TransferScope): Promise<void> {
  if (scope.kind === "project") {
    await transaction.$queryRaw`SELECT id FROM "Project" WHERE id = ${scope.projectId}::uuid FOR UPDATE`;
  } else {
    await transaction.$queryRaw`SELECT id FROM "Workstream" WHERE id = ${scope.workstreamId}::uuid FOR UPDATE`;
  }
}

async function authorizeTransfer(
  transaction: Transaction,
  actor: Readonly<{ userId: string; active: boolean }>,
  scope: TransferScope,
  now: Date,
) {
  const user = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { active: true },
  });
  if (user === null || !user.active || !actor.active) throw authorizationError("INACTIVE");
  const resource = await loadResource(transaction, scope);
  const departmentScopeId = await departmentScopeFor(transaction, resource.departmentId);
  const roles = await transaction.roleAssignment.findMany({
    where: { userId: actor.userId },
    select: { role: true, scopeType: true, scopeId: true },
  });
  const decision = decide(
    { subjectId: actor.userId, active: user.active, roles },
    "responsibility.transfer",
    scope.kind === "project"
      ? { kind: "project", projectId: scope.projectId, departmentId: departmentScopeId }
      : {
          kind: "workstream",
          workstreamId: scope.workstreamId!,
          projectId: scope.projectId,
          departmentId: departmentScopeId,
        },
    { now: now.toISOString() },
  );
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
  return { ...resource, departmentScopeId };
}

async function authorizeRead(
  transaction: Transaction,
  actor: Readonly<{ userId: string; active: boolean }>,
  scope: TransferScope,
  now: Date,
): Promise<void> {
  const user = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { active: true },
  });
  if (user === null || !user.active || !actor.active) throw authorizationError("INACTIVE");
  const resource = await loadResource(transaction, scope);
  const departmentScopeId = await departmentScopeFor(transaction, resource.departmentId);
  const roles = await transaction.roleAssignment.findMany({
    where: { userId: actor.userId },
    select: { role: true, scopeType: true, scopeId: true },
  });
  const windows = await transaction.responsibilityWindow.findMany({
    where: {
      employeeId: actor.userId,
      OR: [{ projectId: scope.projectId }, { workstream: { projectId: scope.projectId } }],
    },
    select: {
      projectId: true,
      workstreamId: true,
      workstream: { select: { projectId: true } },
      responsibilityType: true,
      startsAt: true,
      endsAt: true,
    },
  });
  const decision = decide(
    { subjectId: actor.userId, active: user.active, roles },
    "resource.read",
    scope.kind === "project"
      ? { kind: "project", projectId: scope.projectId, departmentId: departmentScopeId }
      : {
          kind: "workstream",
          workstreamId: scope.workstreamId!,
          projectId: scope.projectId,
          departmentId: departmentScopeId,
        },
    {
      now: now.toISOString(),
      responsibilityWindows: windows.map((window) => {
        const period = {
          subjectId: actor.userId,
          responsibilityType: window.responsibilityType,
          startsAt: window.startsAt.toISOString(),
          endsAt: window.endsAt?.toISOString() ?? null,
        };
        if (typeof window.workstreamId === "string") {
          return {
            ...period,
            scopeType: "workstream" as const,
            scopeId: window.workstreamId,
            projectId: window.workstream?.projectId ?? scope.projectId,
          };
        }
        return { ...period, scopeType: "project" as const, scopeId: scope.projectId };
      }),
    },
  );
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
}

async function loadResource(transaction: Transaction, scope: TransferScope) {
  if (scope.kind === "project") {
    const project = await transaction.project.findUnique({
      where: { id: scope.projectId },
      select: { departmentId: true, status: true, version: true },
    });
    if (project === null) throw resourceError("PROJECT_NOT_FOUND", 404);
    return project;
  }
  const workstream = await transaction.workstream.findFirst({
    where: { id: scope.workstreamId!, projectId: scope.projectId },
    select: {
      status: true,
      version: true,
      project: { select: { departmentId: true } },
    },
  });
  if (workstream === null) throw resourceError("WORKSTREAM_NOT_FOUND", 404);
  return {
    status: workstream.status,
    version: workstream.version,
    departmentId: workstream.project.departmentId,
  };
}

async function departmentScopeFor(transaction: Transaction, departmentId: string) {
  const scope = await transaction.authorizationScope.findFirst({
    where: { departmentId, scopeType: "department" },
    select: { id: true },
  });
  if (scope === null) throw resourceError("RESPONSIBILITY_SCOPE_INVALID", 500);
  return scope.id;
}

async function ensureMembership(
  transaction: Transaction,
  scope: TransferScope,
  employeeId: string,
  effectiveAt: Date,
  command: z.infer<typeof ProjectTransferSchema> | z.infer<typeof WorkstreamTransferSchema>,
): Promise<void> {
  const where = {
    employeeId,
    startsAt: { lte: effectiveAt },
    OR: [{ endsAt: null }, { endsAt: { gt: effectiveAt } }],
  };
  if (scope.kind === "project") {
    const existing = await transaction.projectMember.findFirst({
      where: { ...where, projectId: scope.projectId },
    });
    if (existing === null) {
      await transaction.projectMember.create({
        data: {
          projectId: scope.projectId,
          employeeId,
          startsAt: effectiveAt,
          reason: command.input.reason,
          createdById: command.actor.userId,
        },
      });
    }
  } else {
    const existing = await transaction.workstreamMember.findFirst({
      where: { ...where, workstreamId: scope.workstreamId! },
    });
    if (existing === null) {
      await transaction.workstreamMember.create({
        data: {
          workstreamId: scope.workstreamId!,
          employeeId,
          startsAt: effectiveAt,
          reason: command.input.reason,
          createdById: command.actor.userId,
        },
      });
    }
  }
}

async function incrementVersion(
  transaction: Transaction,
  scope: TransferScope,
  expectedVersion: number,
): Promise<void> {
  const updated =
    scope.kind === "project"
      ? await transaction.project.updateMany({
          where: { id: scope.projectId, version: expectedVersion },
          data: { version: { increment: 1 } },
        })
      : await transaction.workstream.updateMany({
          where: { id: scope.workstreamId!, projectId: scope.projectId, version: expectedVersion },
          data: { version: { increment: 1 } },
        });
  if (updated.count !== 1) throw resourceError("VERSION_CONFLICT", 409);
}

function scopeWhere(scope: TransferScope) {
  return scope.kind === "project"
    ? { projectId: scope.projectId }
    : { workstreamId: scope.workstreamId! };
}

function scopeCreateData(scope: TransferScope) {
  return scope.kind === "project"
    ? { projectId: scope.projectId }
    : { workstreamId: scope.workstreamId! };
}

function resourceId(scope: TransferScope): string {
  return scope.kind === "project" ? scope.projectId : scope.workstreamId!;
}

function serializeWindow(row: {
  id: string;
  employeeId: string;
  projectId: string | null;
  workstreamId: string | null;
  responsibilityType: import("@evaluation/contracts").ResponsibilityType;
  startsAt: Date;
  endsAt: Date | null;
  reason: string;
  delegationType: string | null;
  relatedHandoverReference: string | null;
  managerDecisionById: string | null;
  managerDecisionAt: Date | null;
  managerDecisionReason: string | null;
}) {
  return ResponsibilityWindowSchema.parse({
    id: row.id,
    employeeId: row.employeeId,
    projectId: row.projectId,
    workstreamId: row.workstreamId,
    responsibilityType: row.responsibilityType,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    reason: row.reason,
    delegationType: row.delegationType,
    relatedHandoverReference: row.relatedHandoverReference,
    managerDecisionById: row.managerDecisionById,
    managerDecisionAt: row.managerDecisionAt?.toISOString() ?? null,
    managerDecisionReason: row.managerDecisionReason,
  });
}

function validClock(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw resourceError("RESPONSIBILITY_CLOCK_INVALID", 500);
  return value;
}

function authorizationError(reason: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(`AUTHZ_${reason}`, "errors.authorization.denied", 403);
}

function resourceError(code: string, status: number): AppError {
  return new AppError(code, `errors.responsibilities.${code.toLowerCase()}`, status);
}

async function serializable<T>(
  client: DatabaseClient,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  try {
    return await client.$transaction(operation, { isolationLevel: "Serializable" });
  } catch (error) {
    if (hasErrorCode(error, "P2034") || hasNestedCode(error, "40001")) {
      throw resourceError("VERSION_CONFLICT", 409);
    }
    if (hasNestedCode(error, "23P01")) throw resourceError("OWNER_WINDOW_CONFLICT", 409);
    throw error;
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function hasNestedCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === code) return true;
  if ("originalCode" in error && error.originalCode === code) return true;
  if ("cause" in error && hasNestedCode(error.cause, code)) return true;
  if ("driverAdapterError" in error && hasNestedCode(error.driverAdapterError, code)) return true;
  return "meta" in error && hasNestedCode(error.meta, code);
}
