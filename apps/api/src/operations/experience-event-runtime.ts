import { createHash } from "node:crypto";

import {
  AppError,
  ExperienceWorkflowEventV1Schema,
  WorkSignalV1Schema,
} from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;

export interface ExperienceRecipientAuthorizer {
  authorize(
    input: Readonly<{
      recipientId: string;
      entityRefs: readonly import("@evaluation/contracts").ExperienceEntityRefV1[];
      originatingDomain: import("@evaluation/contracts").WorkSignalV1["originatingDomain"];
    }>,
  ): Promise<boolean>;
}

export interface ExperienceDeliveryQueue {
  enqueue(input: Readonly<{ receiptId: string; correlationId: string }>): Promise<void>;
}

export class ExperienceEventRuntime {
  private readonly database: Database;
  private readonly authorizer: ExperienceRecipientAuthorizer;
  private readonly queue: ExperienceDeliveryQueue;
  private readonly now: () => Date;

  constructor(
    database: Database,
    authorizer: ExperienceRecipientAuthorizer,
    queue: ExperienceDeliveryQueue,
    now: () => Date = () => new Date(),
  ) {
    this.database = database;
    this.authorizer = authorizer;
    this.queue = queue;
    this.now = now;
  }

  async receiveWorkSignal(input: unknown) {
    const signal = WorkSignalV1Schema.parse(input);
    if (
      !(await this.authorizer.authorize({
        recipientId: signal.visibility.recipientId,
        entityRefs: signal.entityRefs,
        originatingDomain: signal.originatingDomain,
      }))
    ) {
      throw new AppError(
        "EXPERIENCE_RECIPIENT_FORBIDDEN",
        "errors.experience.recipientForbidden",
        403,
      );
    }
    const payloadHash = hash(signal);
    let receipt;
    try {
      receipt = await this.database.$transaction(async (transaction) => {
        const existing = await transaction.workSignalReceipt.findUnique({
          where: { idempotencyKey: signal.idempotencyKey },
        });
        if (existing) {
          if (existing.payloadHash !== payloadHash) throw idempotencyConflict();
          return { row: existing, replay: true } as const;
        }
        const row = await transaction.workSignalReceipt.create({
          data: {
            id: signal.signalId,
            schemaVersion: signal.schemaVersion,
            signalType: signal.type,
            sourceClass: signal.sourceClass,
            originatingDomain: signal.originatingDomain,
            entityRefs: signal.entityRefs,
            actorKind: signal.actor.kind,
            actorId: signal.actor.id,
            occurredAt: new Date(signal.occurredAt),
            receivedAt: new Date(signal.receivedAt),
            idempotencyKey: signal.idempotencyKey,
            payloadHash,
            recipientId: signal.visibility.recipientId,
            correlationId: signal.correlationId,
            freshness: signal.freshness,
          },
        });
        return { row, replay: false } as const;
      });
    } catch (error) {
      const concurrent = await this.database.workSignalReceipt.findUnique({
        where: { idempotencyKey: signal.idempotencyKey },
      });
      if (!concurrent) throw error;
      if (concurrent.payloadHash !== payloadHash) throw idempotencyConflict();
      receipt = { row: concurrent, replay: true } as const;
    }
    if (["queued", "error"].includes(receipt.row.deliveryState)) {
      await this.queue.enqueue({ receiptId: receipt.row.id, correlationId: signal.correlationId });
    }
    return { receiptId: receipt.row.id, replay: receipt.replay };
  }

  async recordWorkflowEvent(input: unknown) {
    const event = ExperienceWorkflowEventV1Schema.parse(input);
    const authorized = await this.authorizer.authorize({
      recipientId: event.recipientId,
      entityRefs: [event.entityRef],
      originatingDomain: domainForEntity(event.entityRef.entityType),
    });
    if (!authorized) {
      throw new AppError(
        "EXPERIENCE_RECIPIENT_FORBIDDEN",
        "errors.experience.recipientForbidden",
        403,
      );
    }
    const payloadHash = hash(event);
    const existing = await this.database.experienceWorkflowEventReceipt.findUnique({
      where: { idempotencyKey: event.idempotencyKey },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw idempotencyConflict();
      return { receiptId: existing.id, replay: true };
    }
    try {
      const row = await this.database.experienceWorkflowEventReceipt.create({
        data: {
          id: event.eventId,
          schemaVersion: event.schemaVersion,
          eventType: event.type,
          actorId: event.actorId,
          recipientId: event.recipientId,
          entityRef: event.entityRef,
          operationId: event.operationId,
          idempotencyKey: event.idempotencyKey,
          payloadHash,
          expectedVersion: event.expectedVersion,
          safeReasonCode: event.safeReasonCode,
          correlationId: event.correlationId,
          occurredAt: new Date(event.occurredAt),
        },
      });
      return { receiptId: row.id, replay: false };
    } catch (error) {
      const concurrent = await this.database.experienceWorkflowEventReceipt.findUnique({
        where: { idempotencyKey: event.idempotencyKey },
      });
      if (!concurrent) throw error;
      if (concurrent.payloadHash !== payloadHash) throw idempotencyConflict();
      return { receiptId: concurrent.id, replay: true };
    }
  }

  async listWhatChanged(input: Readonly<{ actorId: string; afterCursor: string | null }>): Promise<{
    items: ReadonlyArray<{
      receiptId: string;
      cursor: string;
      type: string;
      source: string;
      entityRefs: unknown;
      occurredAt: string;
      freshness: unknown;
      state: "delivered" | "acknowledged";
    }>;
    nextCursor: string | null;
  }> {
    const cursor = parseCursor(input.afterCursor);
    const recoverable = await this.database.workSignalReceipt.findMany({
      where: {
        recipientId: input.actorId,
        deliveryState: { in: ["queued", "error"] },
      },
      orderBy: { deliveryCursor: "asc" },
      take: 20,
    });
    await Promise.all(
      recoverable.map((row) =>
        this.queue
          .enqueue({ receiptId: row.id, correlationId: row.correlationId })
          .catch(() => undefined),
      ),
    );
    const rows = await this.database.workSignalReceipt.findMany({
      where: {
        recipientId: input.actorId,
        deliveryState: { in: ["delivered", "acknowledged"] },
        ...(cursor === null ? {} : { deliveryCursor: { gt: cursor } }),
      },
      orderBy: { deliveryCursor: "asc" },
      take: 50,
    });
    const items = rows.map((row) => ({
      receiptId: row.id,
      cursor: row.deliveryCursor.toString(),
      type: row.signalType,
      source: row.originatingDomain,
      entityRefs: row.entityRefs,
      occurredAt: row.occurredAt.toISOString(),
      freshness: row.freshness,
      state: row.deliveryState as "delivered" | "acknowledged",
    }));
    return { items, nextCursor: items.at(-1)?.cursor ?? input.afterCursor };
  }

  async acknowledge(input: Readonly<{ actorId: string; receiptId: string }>) {
    const existing = await this.database.workSignalReceipt.findUnique({
      where: { id: input.receiptId },
    });
    if (existing?.recipientId !== input.actorId) {
      throw new AppError("EXPERIENCE_RECEIPT_FORBIDDEN", "errors.experience.receiptForbidden", 403);
    }
    if (existing.deliveryState === "acknowledged") {
      return { receiptId: input.receiptId, state: "acknowledged" as const };
    }
    if (existing.deliveryState !== "delivered") {
      throw new AppError(
        "EXPERIENCE_RECEIPT_NOT_DELIVERED",
        "errors.experience.receiptNotDelivered",
        409,
      );
    }
    const result = await this.database.workSignalReceipt.updateMany({
      where: { id: input.receiptId, recipientId: input.actorId, deliveryState: "delivered" },
      data: {
        deliveryState: "acknowledged",
        acknowledgedAt: this.now(),
      },
    });
    if (result.count !== 1) {
      throw new AppError("EXPERIENCE_RECEIPT_FORBIDDEN", "errors.experience.receiptForbidden", 403);
    }
    return { receiptId: input.receiptId, state: "acknowledged" as const };
  }
}

function hash(
  value:
    | import("@evaluation/contracts").WorkSignalV1
    | import("@evaluation/contracts").ExperienceWorkflowEventV1,
): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseCursor(cursor: string | null): bigint | null {
  if (cursor === null) return null;
  if (!/^[1-9]\d*$/u.test(cursor)) {
    throw new AppError("EXPERIENCE_CURSOR_INVALID", "errors.experience.cursorInvalid", 400);
  }
  return BigInt(cursor);
}

function idempotencyConflict() {
  return new AppError("IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict", 409);
}

function domainForEntity(
  entityType: import("@evaluation/contracts").ExperienceEntityRefV1["entityType"],
): import("@evaluation/contracts").WorkSignalV1["originatingDomain"] {
  if (["private_inbox_item", "work_item"].includes(entityType)) return "work_items";
  if (["project", "workstream"].includes(entityType)) return "projects";
  if (["update", "evidence"].includes(entityType)) return "updates_evidence";
  if (entityType === "research") return "research_experiments";
  if (entityType === "continuity") return "continuity";
  if (entityType === "connected_context") return "connected_work_context";
  return "evaluation";
}
