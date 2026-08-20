import { createHash, randomUUID } from "node:crypto";

import { WorkSignalV1Schema } from "@evaluation/contracts";

type Transaction = import("@evaluation/database").DatabaseTransaction;

export type PrivateInboxCapturedSignal = Readonly<{
  actorId: string;
  correlationId: string;
  inboxItemId: string;
  occurredAt: Date;
  version: number;
}>;

export type PrivateInboxExperienceWakeUp = Readonly<{
  receiptId: string;
  correlationId: string;
}>;

export interface PrivateInboxExperiencePublisher {
  appendCaptured(
    transaction: Transaction,
    input: PrivateInboxCapturedSignal,
  ): Promise<PrivateInboxExperienceWakeUp>;
  wake(input: PrivateInboxExperienceWakeUp): Promise<void>;
}

export class DatabasePrivateInboxExperiencePublisher implements PrivateInboxExperiencePublisher {
  private readonly queue: Readonly<{
    enqueue(input: PrivateInboxExperienceWakeUp): Promise<void>;
  }>;

  constructor(queue: Readonly<{ enqueue(input: PrivateInboxExperienceWakeUp): Promise<void> }>) {
    this.queue = queue;
  }

  async appendCaptured(transaction: Transaction, input: PrivateInboxCapturedSignal) {
    const timestamp = input.occurredAt.toISOString();
    const signal = WorkSignalV1Schema.parse({
      schemaVersion: 1,
      signalId: randomUUID(),
      type: "user.capture_submitted",
      sourceClass: "user_domain_action",
      originatingDomain: "work_items",
      entityRefs: [
        {
          entityType: "private_inbox_item",
          entityId: input.inboxItemId,
          version: input.version,
        },
      ],
      actor: { kind: "human", id: input.actorId },
      occurredAt: timestamp,
      receivedAt: timestamp,
      idempotencyKey: `private-inbox:${input.inboxItemId}:v${input.version}`,
      visibility: { kind: "owner", recipientId: input.actorId },
      correlationId: input.correlationId,
      freshness: {
        state: "fresh",
        evaluatedAt: timestamp,
        sourceUpdatedAt: timestamp,
        safeReasonCode: "private_capture_committed",
        recoveryMode: "none",
        expectedVersion: input.version,
      },
    });
    await transaction.workSignalReceipt.create({
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
        payloadHash: createHash("sha256").update(JSON.stringify(signal)).digest("hex"),
        recipientId: signal.visibility.recipientId,
        correlationId: signal.correlationId,
        freshness: signal.freshness,
      },
    });
    return { receiptId: signal.signalId, correlationId: signal.correlationId };
  }

  wake(input: PrivateInboxExperienceWakeUp) {
    return this.queue.enqueue(input);
  }
}
