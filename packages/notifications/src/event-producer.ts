import { randomUUID } from "node:crypto";

import { NotificationDomainEventSchema } from "@evaluation/contracts";

export class NotificationEventProducer {
  private readonly intents: import("./intent-service.js").NotificationIntentService;
  private readonly queue: import("./delivery-queue.js").NotificationDeliveryQueue;

  constructor(
    intents: import("./intent-service.js").NotificationIntentService,
    queue: import("./delivery-queue.js").NotificationDeliveryQueue,
  ) {
    this.intents = intents;
    this.queue = queue;
  }

  async publish(input: unknown) {
    const event = NotificationDomainEventSchema.parse(input);
    const intent = await this.intents.create(toIntent(event));
    await this.queue.enqueue({ intentId: intent.id, correlationId: randomUUID() });
    return intent;
  }
}

function toIntent(event: import("@evaluation/contracts").NotificationDomainEvent) {
  const common = {
    recipientId: event.recipientId,
    source: { eventId: event.eventId, eventVersion: event.eventVersion },
    dedupeKey: `${event.type}:${event.eventId}:v${String(event.eventVersion)}`,
    channels: ["IN_APP", "EMAIL"] as const,
  };
  switch (event.type) {
    case "CHECK_IN_DUE":
      return {
        ...common,
        category: "CHECK_IN_DUE" as const,
        urgency: "ACTION_REQUIRED" as const,
        template: { version: 1, key: "check_in_due", arguments: {} },
        action: { kind: "CHECK_IN" as const, resourceId: event.obligationId },
        deliverAfter: new Date(event.dueAt),
      };
    case "REASSIGNMENT_REQUIRED":
      return {
        ...common,
        category: "REASSIGNMENT_ACTION" as const,
        urgency: "CRITICAL" as const,
        template: { version: 1, key: "reassignment_action", arguments: {} },
        action: { kind: "OPEN_CONTINUITY" as const, resourceId: event.caseId },
        deliverAfter: new Date(event.occurredAt),
      };
    case "EXPORT_READY":
      return {
        ...common,
        category: "EXPORT_READY" as const,
        urgency: "INFORMATION" as const,
        template: { version: 1, key: "export_ready", arguments: {} },
        action: { kind: "DOWNLOAD_EXPORT" as const, resourceId: event.artifactId },
        deliverAfter: new Date(event.occurredAt),
      };
    case "SYSTEM_HEALTH_ACTION_REQUIRED":
      return {
        ...common,
        category: "SYSTEM_HEALTH" as const,
        urgency: "ACTION_REQUIRED" as const,
        template: {
          version: 1,
          key: "system_health_action_required",
          arguments: { dependency: event.dependency },
        },
        action: { kind: "OPEN_ADMIN_HEALTH" as const, resourceId: event.dependency },
        deliverAfter: new Date(event.occurredAt),
      };
  }
}
