import {
  AppError,
  CapturePrivateInboxInputSchema,
  DismissPrivateInboxInputSchema,
  PromotePrivateInboxInputSchema,
  WorkItemDetailSchema,
} from "@evaluation/contracts";
import { canUsePrivateCapture } from "@evaluation/permissions";
import { z } from "zod";

import { serializeInboxItem, forbiddenError } from "./inbox-query-service.js";
import { assertWorkItemScope, getAllowedWorkItemTransitions } from "./invariants.js";
import { assertEligibleAssignee, authorizeProject } from "./service-authorization.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type AuditWriter = import("@evaluation/contracts").AuditWriter<Transaction>;

const ActorSchema = z
  .object({ userId: z.string().uuid(), active: z.boolean(), roles: z.array(z.string()) })
  .strict();
const CommandBaseSchema = z
  .object({ actor: ActorSchema, correlationId: z.string().uuid() })
  .strict();
const CaptureCommandSchema = CommandBaseSchema.extend({
  input: CapturePrivateInboxInputSchema,
}).strict();
const DismissCommandSchema = CommandBaseSchema.extend({
  inboxItemId: z.string().uuid(),
  input: DismissPrivateInboxInputSchema,
}).strict();
const PromoteCommandSchema = CommandBaseSchema.extend({
  inboxItemId: z.string().uuid(),
  input: PromotePrivateInboxInputSchema,
}).strict();

export class PrivateInboxService {
  private readonly client: DatabaseClient;
  private readonly auditWriter: AuditWriter;
  private readonly clock: () => Date;
  private readonly privateUploads: PrivateCaptureUploadOwnershipValidator;
  private readonly experience:
    import("./private-inbox-experience.js").PrivateInboxExperiencePublisher | undefined;

  constructor(
    client: DatabaseClient,
    auditWriter: AuditWriter,
    privateUploads: PrivateCaptureUploadOwnershipValidator,
    clock: () => Date = () => new Date(),
    experience?: import("./private-inbox-experience.js").PrivateInboxExperiencePublisher,
  ) {
    this.client = client;
    this.auditWriter = auditWriter;
    this.privateUploads = privateUploads;
    this.clock = clock;
    this.experience = experience;
  }

  async capture(command: unknown): Promise<import("@evaluation/contracts").PrivateInboxItem> {
    const parsed = CaptureCommandSchema.parse(command);
    const current = validClock(this.clock());
    assertCaptureAuthorized(parsed.actor);
    if (parsed.input.sourceUploadId !== null) {
      await this.privateUploads.assertOwned({
        actor: parsed.actor,
        privateCaptureUploadId: parsed.input.sourceUploadId,
      });
    }
    const captured = await serializable(this.client, async (transaction) => {
      if (parsed.input.projectId !== null) {
        await authorizeProject(transaction, parsed.actor, parsed.input.projectId, current);
      }
      const item = await transaction.privateInboxItem.create({
        data: {
          employeeId: parsed.actor.userId,
          text: parsed.input.text,
          projectId: parsed.input.projectId,
          sourceType: parsed.input.sourceType,
          sourceUploadId: parsed.input.sourceUploadId,
        },
      });
      await this.auditWriter.append(transaction, {
        eventType: "private_inbox.captured",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.actor.userId,
        scopeType: parsed.input.projectId === null ? "system" : "project",
        scopeId: parsed.input.projectId ?? parsed.actor.userId,
        targetType: "private_inbox_item",
        targetId: item.id,
        reason: "Employee captured a private Inbox item",
        safeDiff: {
          linkedToProject: parsed.input.projectId !== null,
          sourceType: parsed.input.sourceType,
          hasPrivateUpload: parsed.input.sourceUploadId !== null,
          version: 1,
        },
        correlationId: parsed.correlationId,
        source: "api",
      });
      const wakeUp = await this.experience?.appendCaptured(transaction, {
        actorId: parsed.actor.userId,
        correlationId: parsed.correlationId,
        inboxItemId: item.id,
        occurredAt: item.createdAt,
        version: item.version,
      });
      return { item: serializeInboxItem(item), wakeUp };
    });
    if (captured.wakeUp !== undefined) {
      await this.experience?.wake(captured.wakeUp).catch(() => undefined);
    }
    return captured.item;
  }

  async dismiss(command: unknown): Promise<import("@evaluation/contracts").PrivateInboxItem> {
    const parsed = DismissCommandSchema.parse(command);
    assertCaptureAuthorized(parsed.actor);
    return serializable(this.client, async (transaction) => {
      await lockInboxItem(transaction, parsed.inboxItemId);
      const item = await loadOwnedInboxItem(transaction, parsed.actor.userId, parsed.inboxItemId);
      assertOpenVersion(item, parsed.input.expectedVersion);
      const updated = await transaction.privateInboxItem.update({
        where: { id: item.id },
        data: { status: "dismissed", version: { increment: 1 } },
      });
      await this.auditWriter.append(transaction, {
        eventType: "private_inbox.dismissed",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.actor.userId,
        scopeType: item.projectId === null ? "system" : "project",
        scopeId: item.projectId ?? parsed.actor.userId,
        targetType: "private_inbox_item",
        targetId: item.id,
        reason: parsed.input.reason,
        safeDiff: { fromStatus: item.status, toStatus: updated.status, version: updated.version },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serializeInboxItem(updated);
    });
  }

  async promote(command: unknown): Promise<import("@evaluation/contracts").WorkItemDetail> {
    const parsed = PromoteCommandSchema.parse(command);
    const current = validClock(this.clock());
    assertCaptureAuthorized(parsed.actor);
    return serializable(this.client, async (transaction) => {
      await lockInboxItem(transaction, parsed.inboxItemId);
      const inbox = await loadOwnedInboxItem(transaction, parsed.actor.userId, parsed.inboxItemId);
      assertOpenVersion(inbox, parsed.input.expectedVersion);
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
      const { reason } = parsed.input;
      const content = {
        title: parsed.input.title,
        description: parsed.input.description,
        projectId: parsed.input.projectId,
        workstreamId: parsed.input.workstreamId,
        assigneeId: parsed.input.assigneeId,
        dueAt: parsed.input.dueAt,
        priority: parsed.input.priority,
        requirements: parsed.input.requirements,
        acceptanceConditions: parsed.input.acceptanceConditions,
        blocker: parsed.input.blocker,
        nextAction: parsed.input.nextAction,
      };
      const workItem = await transaction.workItem.create({
        data: {
          ...content,
          dueAt: content.dueAt === null ? null : new Date(content.dueAt),
          createdById: parsed.actor.userId,
        },
      });
      await transaction.workItemAssignmentHistory.create({
        data: {
          workItemId: workItem.id,
          fromAssigneeId: null,
          toAssigneeId: content.assigneeId,
          actorId: parsed.actor.userId,
          reason,
          resultingVersion: 1,
        },
      });
      await transaction.privateInboxItem.update({
        where: { id: inbox.id },
        data: {
          projectId: project.id,
          status: "promoted",
          promotedWorkItemId: workItem.id,
          version: { increment: 1 },
        },
      });
      await this.auditWriter.append(transaction, {
        eventType: "private_inbox.promoted",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: content.assigneeId,
        scopeType: "project",
        scopeId: project.id,
        targetType: "work_item",
        targetId: workItem.id,
        reason,
        safeDiff: {
          inboxItemId: inbox.id,
          workItemId: workItem.id,
          status: "planned",
          version: 1,
        },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serializeWorkItem(workItem);
    });
  }
}

export interface PrivateCaptureUploadOwnershipValidator {
  assertOwned(
    command: Readonly<{
      actor: Readonly<{ userId: string; active: boolean; roles: readonly string[] }>;
      privateCaptureUploadId: string;
    }>,
  ): Promise<void>;
}

export type { PrivateInboxExperiencePublisher } from "./private-inbox-experience.js";

function assertCaptureAuthorized(actor: { active: boolean; roles: readonly string[] }) {
  if (!canUsePrivateCapture(actor)) throw forbiddenError();
}

async function loadOwnedInboxItem(
  transaction: Transaction,
  employeeId: string,
  inboxItemId: string,
) {
  const item = await transaction.privateInboxItem.findUnique({ where: { id: inboxItemId } });
  if (item === null || item.employeeId !== employeeId) throw forbiddenError();
  return item;
}

function assertOpenVersion(
  item: { status: string; version: number },
  expectedVersion: number,
): void {
  if (item.status !== "open") {
    throw new AppError(
      "PRIVATE_INBOX_ALREADY_RESOLVED",
      "errors.privateInbox.alreadyResolved",
      409,
    );
  }
  if (item.version !== expectedVersion) {
    throw new AppError("VERSION_CONFLICT", "errors.versionConflict", 409);
  }
}

async function lockInboxItem(transaction: Transaction, inboxItemId: string): Promise<void> {
  await transaction.$queryRaw`
    SELECT id FROM "PrivateInboxItem" WHERE id = ${inboxItemId}::uuid FOR UPDATE
  `;
}

function serializeWorkItem(item: {
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
    allowedActions: ["edit", "transition", "assign", "add_update"],
    allowedTransitions: getAllowedWorkItemTransitions(item.status),
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
