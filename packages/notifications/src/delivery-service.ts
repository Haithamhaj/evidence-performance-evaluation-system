import { randomUUID } from "node:crypto";

import type { NotificationCategory } from "@evaluation/contracts";

import { EmailDeliveryError } from "./adapters/in-memory-email.js";

export class NotificationDeliveryService {
  private readonly database: import("@evaluation/database").DatabaseClient;
  private readonly preferences: import("./preference-service.js").NotificationPreferenceService;
  private readonly email: import("./adapters/in-memory-email.js").EmailAdapter;

  constructor(
    database: import("@evaluation/database").DatabaseClient,
    preferences: import("./preference-service.js").NotificationPreferenceService,
    email: import("./adapters/in-memory-email.js").EmailAdapter,
  ) {
    this.database = database;
    this.preferences = preferences;
    this.email = email;
  }

  async deliver(intentId: string, correlationId: string) {
    const intent = await this.database.notificationIntent.findUniqueOrThrow({
      where: { id: intentId },
      include: { deliveryAttempts: { orderBy: { attempt: "asc" } } },
    });
    const inAppAttempt = intent.deliveryAttempts.find(({ channel }) => channel === "IN_APP");
    if (!inAppAttempt) {
      await this.database.$transaction([
        this.database.notificationIntent.update({
          where: { id: intent.id },
          data: { inAppState: "READY" },
        }),
        this.database.notificationDeliveryAttempt.create({
          data: {
            id: randomUUID(),
            intentId: intent.id,
            channel: "IN_APP",
            state: "READY",
            attempt: 1,
            correlationId,
          },
        }),
      ]);
    }

    const emailRequested = (intent.channels as string[]).includes("EMAIL");
    if (!emailRequested) return { inAppState: "READY" as const, emailState: "MUTED" as const };
    const previousEmail = [...intent.deliveryAttempts]
      .filter(({ channel }) => channel === "EMAIL")
      .sort((left, right) => right.attempt - left.attempt)[0];
    if (previousEmail?.state === "SENT" || previousEmail?.state === "FAILED") {
      return { inAppState: "READY" as const, emailState: previousEmail.state };
    }
    if (
      !(await this.preferences.emailAllowed(
        intent.recipientId,
        intent.category as NotificationCategory,
      ))
    ) {
      if (!previousEmail) {
        await this.recordEmailAttempt(intent.id, 1, "MUTED", correlationId);
      }
      return { inAppState: "READY" as const, emailState: "MUTED" as const };
    }

    const attempt = (previousEmail?.attempt ?? 0) + 1;
    try {
      const result = await this.email.send({
        recipientId: intent.recipientId,
        templateKey: intent.templateKey,
        templateArguments: intent.templateArguments as Record<string, string>,
        actionKind: intent.actionKind,
      });
      await this.recordEmailAttempt(intent.id, attempt, "SENT", correlationId, result.receipt);
      return { inAppState: "READY" as const, emailState: "SENT" as const };
    } catch (error) {
      const category = error instanceof EmailDeliveryError ? error.category : "TRANSIENT";
      const state = category === "TRANSIENT" ? "RETRY_SCHEDULED" : "FAILED";
      const nextRetryAt = category === "TRANSIENT" ? new Date(Date.now() + 60_000) : undefined;
      await this.recordEmailAttempt(
        intent.id,
        attempt,
        state,
        correlationId,
        undefined,
        category,
        nextRetryAt,
      );
      return { inAppState: "READY" as const, emailState: state };
    }
  }

  private async recordEmailAttempt(
    intentId: string,
    attempt: number,
    state: "SENT" | "RETRY_SCHEDULED" | "FAILED" | "MUTED",
    correlationId: string,
    providerReceipt?: string,
    failureCategory?: "TRANSIENT" | "PERMANENT",
    nextRetryAt?: Date,
  ) {
    return this.database.notificationDeliveryAttempt.create({
      data: {
        id: randomUUID(),
        intentId,
        channel: "EMAIL",
        state,
        attempt,
        providerReceipt: providerReceipt ?? null,
        failureCategory: failureCategory ?? null,
        nextRetryAt: nextRetryAt ?? null,
        correlationId,
      },
    });
  }
}
