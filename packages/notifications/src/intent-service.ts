import { randomUUID } from "node:crypto";

import { NotificationIntentSchema, type NotificationCategory } from "@evaluation/contracts";

type IntentInput = Readonly<{
  recipientId: string;
  category: NotificationCategory;
  urgency: "INFORMATION" | "ACTION" | "ACTION_REQUIRED" | "CRITICAL";
  template: Readonly<{ version: number; key: string; arguments: Readonly<Record<string, string>> }>;
  action: Readonly<{
    kind:
      | "CHECK_IN"
      | "REVIEW_DOCUMENT"
      | "REVIEW_CRITERIA"
      | "CONFIRM_EVIDENCE"
      | "OPEN_EVALUATION"
      | "OPEN_COACHING"
      | "OPEN_CONTINUITY"
      | "RECONNECT"
      | "RETRY_AI"
      | "DOWNLOAD_EXPORT"
      | "OPEN_ADMIN_HEALTH";
    resourceId: string;
  }>;
  source: Readonly<{ eventId: string; eventVersion: number }>;
  dedupeKey: string;
  channels: readonly ("IN_APP" | "EMAIL")[];
  deliverAfter: Date;
}>;

export type NotificationIntentRecord = Readonly<{
  id: string;
  recipientId: string;
  category: string;
  urgency: string;
  actionKind: string;
  actionResourceId: string;
  inAppState: string;
  readAt: Date | null;
  createdAt: Date;
}>;

export class NotificationIntentService {
  private readonly database: import("@evaluation/database").DatabaseClient;

  constructor(database: import("@evaluation/database").DatabaseClient) {
    this.database = database;
  }

  async create(input: IntentInput): Promise<NotificationIntentRecord> {
    const now = new Date();
    const parsed = NotificationIntentSchema.parse({
      ...input,
      id: randomUUID(),
      schemaVersion: 1,
      channels: [...input.channels],
      deliverAfter: input.deliverAfter.toISOString(),
      createdAt: now.toISOString(),
    });
    return this.database.notificationIntent.upsert({
      where: {
        recipientId_category_dedupeKey: {
          recipientId: parsed.recipientId,
          category: parsed.category,
          dedupeKey: parsed.dedupeKey,
        },
      },
      update: {},
      create: {
        id: parsed.id,
        schemaVersion: parsed.schemaVersion,
        recipientId: parsed.recipientId,
        category: parsed.category,
        urgency: parsed.urgency,
        templateVersion: parsed.template.version,
        templateKey: parsed.template.key,
        templateArguments: parsed.template.arguments,
        actionKind: parsed.action.kind,
        actionResourceId: parsed.action.resourceId,
        sourceEventId: parsed.source.eventId,
        sourceEventVersion: parsed.source.eventVersion,
        dedupeKey: parsed.dedupeKey,
        channels: parsed.channels,
        deliverAfter: new Date(parsed.deliverAfter),
        createdAt: new Date(parsed.createdAt),
      },
    });
  }

  async inbox(
    recipientId: string,
    options: Readonly<{ cursor?: string; limit?: number }> = {},
  ): Promise<readonly NotificationIntentRecord[]> {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    return this.database.notificationIntent.findMany({
      where: { recipientId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
  }

  async open(
    intentId: string,
    actorId: string,
    authorizeTarget: (action: Readonly<{ kind: string; resourceId: string }>) => Promise<boolean>,
  ) {
    const intent = await this.database.notificationIntent.findUnique({ where: { id: intentId } });
    if (!intent || intent.recipientId !== actorId) return { allowed: false as const, reason: "DENIED" };
    const allowed = await authorizeTarget({
      kind: intent.actionKind,
      resourceId: intent.actionResourceId,
    });
    if (!allowed) return { allowed: false as const, reason: "TARGET_ACCESS_REVOKED" };
    await this.database.notificationIntent.update({
      where: { id: intent.id },
      data: { readAt: intent.readAt ?? new Date() },
    });
    return {
      allowed: true as const,
      action: { kind: intent.actionKind, resourceId: intent.actionResourceId },
    };
  }
}
