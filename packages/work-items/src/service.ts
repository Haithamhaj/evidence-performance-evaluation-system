import {
  AppError,
  AssignWorkItemInputSchema,
  CreateWorkItemInputSchema,
  TransitionWorkItemInputSchema,
  WorkItemDetailSchema,
} from "@evaluation/contracts";
import { z } from "zod";

import { assertWorkItemScope, assertWorkItemTransition } from "./invariants.js";
import {
  assertEligibleAssignee,
  authorizeProject,
  loadAuthorizedItem,
  lockWorkItem,
} from "./service-authorization.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type AuditWriter = import("@evaluation/contracts").AuditWriter<Transaction>;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const CommandBaseSchema = z
  .object({ actor: ActorSchema, correlationId: z.string().uuid() })
  .strict();
const CreateCommandSchema = CommandBaseSchema.extend({
  input: CreateWorkItemInputSchema,
}).strict();
const TransitionCommandSchema = CommandBaseSchema.extend({
  workItemId: z.string().uuid(),
  input: TransitionWorkItemInputSchema,
}).strict();
const AssignCommandSchema = CommandBaseSchema.extend({
  workItemId: z.string().uuid(),
  input: AssignWorkItemInputSchema,
}).strict();

export class WorkItemService {
  private readonly client: DatabaseClient;
  private readonly auditWriter: AuditWriter;
  private readonly clock: () => Date;

  constructor(
    client: DatabaseClient,
    auditWriter: AuditWriter,
    clock: () => Date = () => new Date(),
  ) {
    this.client = client;
    this.auditWriter = auditWriter;
    this.clock = clock;
  }

  async create(command: unknown): Promise<import("@evaluation/contracts").WorkItemDetail> {
    const parsed = CreateCommandSchema.parse(command);
    const current = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      const project = await authorizeProject(
        transaction,
        parsed.actor,
        parsed.input.projectId,
        current,
      );
      const workstream =
        parsed.input.workstreamId === null
          ? null
          : await transaction.workstream.findUnique({
              where: { id: parsed.input.workstreamId },
              select: { id: true, projectId: true, status: true },
            });
      assertWorkItemScope({ projectId: project.id, workstream });
      if (workstream !== null && !["active", "paused"].includes(workstream.status)) {
        throw stateError();
      }
      await assertEligibleAssignee(
        transaction,
        parsed.input.assigneeId,
        project.id,
        workstream?.id ?? null,
        current,
      );
      const item = await transaction.workItem.create({
        data: {
          ...parsed.input,
          dueAt: parsed.input.dueAt === null ? null : new Date(parsed.input.dueAt),
          createdById: parsed.actor.userId,
        },
      });
      if (parsed.input.assigneeId !== null) {
        await transaction.workItemAssignmentHistory.create({
          data: {
            workItemId: item.id,
            fromAssigneeId: null,
            toAssigneeId: parsed.input.assigneeId,
            actorId: parsed.actor.userId,
            reason: "Initial assignment",
            resultingVersion: 1,
          },
        });
      }
      await this.auditWriter.append(transaction, {
        eventType: "work_item.created",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.input.assigneeId ?? parsed.actor.userId,
        scopeType: "project",
        scopeId: project.id,
        targetType: "work_item",
        targetId: item.id,
        reason: "Work Item created",
        safeDiff: {
          projectId: project.id,
          workstreamId: workstream?.id ?? null,
          status: "planned",
          version: 1,
        },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serialize(item);
    });
  }

  async transition(command: unknown): Promise<import("@evaluation/contracts").WorkItemDetail> {
    const parsed = TransitionCommandSchema.parse(command);
    const current = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      await lockWorkItem(transaction, parsed.workItemId);
      const item = await loadAuthorizedItem(transaction, parsed.actor, parsed.workItemId, current);
      if (item.version !== parsed.input.expectedVersion) throw versionError();
      assertWorkItemTransition(item.status, parsed.input.status);
      const updated = await transaction.workItem.update({
        where: { id: item.id },
        data: { status: parsed.input.status, version: { increment: 1 } },
      });
      await transaction.workItemStatusHistory.create({
        data: {
          workItemId: item.id,
          fromStatus: item.status,
          toStatus: parsed.input.status,
          actorId: parsed.actor.userId,
          reason: parsed.input.reason,
          resultingVersion: updated.version,
        },
      });
      await appendAudit(this.auditWriter, transaction, parsed, updated, {
        fromStatus: item.status,
        toStatus: updated.status,
      });
      return serialize(updated);
    });
  }

  async assign(command: unknown): Promise<import("@evaluation/contracts").WorkItemDetail> {
    const parsed = AssignCommandSchema.parse(command);
    const current = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      await lockWorkItem(transaction, parsed.workItemId);
      const item = await loadAuthorizedItem(transaction, parsed.actor, parsed.workItemId, current);
      if (item.version !== parsed.input.expectedVersion) throw versionError();
      if (item.status === "done" || item.status === "cancelled") throw stateError();
      if (item.assigneeId === parsed.input.assigneeId) throw stateError();
      await assertEligibleAssignee(
        transaction,
        parsed.input.assigneeId,
        item.projectId,
        item.workstreamId,
        current,
      );
      const updated = await transaction.workItem.update({
        where: { id: item.id },
        data: { assigneeId: parsed.input.assigneeId, version: { increment: 1 } },
      });
      await transaction.workItemAssignmentHistory.create({
        data: {
          workItemId: item.id,
          fromAssigneeId: item.assigneeId,
          toAssigneeId: parsed.input.assigneeId,
          actorId: parsed.actor.userId,
          reason: parsed.input.reason,
          resultingVersion: updated.version,
        },
      });
      await appendAudit(this.auditWriter, transaction, parsed, updated, {
        fromAssigneeId: item.assigneeId,
        toAssigneeId: updated.assigneeId,
      });
      return serialize(updated);
    });
  }
}

function serialize(item: {
  id: string;
  projectId: string;
  workstreamId: string | null;
  title: string;
  description: string;
  status: import("@evaluation/contracts").WorkItemStatus;
  priority: import("@evaluation/contracts").WorkItemPriority;
  assigneeId: string | null;
  dueAt: Date | null;
  requirements: unknown;
  acceptanceConditions: unknown;
  blocker: string | null;
  nextAction: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return WorkItemDetailSchema.parse({
    id: item.id,
    projectId: item.projectId,
    workstreamId: item.workstreamId,
    title: item.title,
    description: item.description,
    status: item.status,
    priority: item.priority,
    assigneeId: item.assigneeId,
    dueAt: item.dueAt?.toISOString() ?? null,
    requirements: item.requirements,
    acceptanceConditions: item.acceptanceConditions,
    blocker: item.blocker,
    nextAction: item.nextAction,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    allowedActions:
      item.status === "done" || item.status === "cancelled"
        ? ["add_update"]
        : ["edit", "transition", "assign", "add_update"],
  });
}

async function appendAudit(
  auditWriter: AuditWriter,
  transaction: Transaction,
  command: z.infer<typeof TransitionCommandSchema> | z.infer<typeof AssignCommandSchema>,
  item: { id: string; projectId: string; version: number },
  safeDiff: Record<string, unknown>,
): Promise<void> {
  await auditWriter.append(transaction, {
    eventType: "work_item.changed",
    actor: { kind: "human", id: command.actor.userId },
    effectiveSubjectId: command.actor.userId,
    scopeType: "project",
    scopeId: item.projectId,
    targetType: "work_item",
    targetId: item.id,
    reason: command.input.reason,
    safeDiff: { ...safeDiff, version: item.version },
    correlationId: command.correlationId,
    source: "api",
  });
}

function serializable<T>(
  client: DatabaseClient,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return client.$transaction(operation, { isolationLevel: "Serializable" });
}

function validClock(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw new Error("Clock returned an invalid date");
  return value;
}

function stateError(): AppError {
  return new AppError("WORK_ITEM_STATE_INVALID", "errors.workItems.stateInvalid", 409);
}

function versionError(): AppError {
  return new AppError("VERSION_CONFLICT", "errors.versionConflict", 409);
}
