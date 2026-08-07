/* eslint-disable no-unused-vars */
import { NotificationCategorySchema } from "@evaluation/contracts";
import {
  NotificationIntentService,
  NotificationPreferenceService,
} from "@evaluation/notifications";
import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";

import { OperationsPolicyGuard, type OperationsRequest } from "./operations-policy.guard.js";
import { OperationsTargetAuthorizer } from "./target-authorizer.js";

export class NotificationsController {
  constructor(
    private readonly intents: NotificationIntentService,
    private readonly preferences: NotificationPreferenceService,
    private readonly targets: OperationsTargetAuthorizer,
  ) {}

  inbox(request: OperationsRequest, cursor?: string, limit?: string) {
    return this.intents.inbox(actor(request), {
      ...(cursor ? { cursor } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }

  setPreference(request: OperationsRequest, body: unknown) {
    const value = object(body);
    return this.preferences.set({
      recipientId: actor(request),
      category: NotificationCategorySchema.parse(value.category),
      emailEnabled: value.emailEnabled === true,
    });
  }

  open(request: OperationsRequest, intentId: string) {
    const actorId = actor(request);
    return this.intents.open(intentId, actorId, (action) =>
      this.targets.authorize(actorId, action),
    );
  }
}

Controller("api/v1/operations/notifications")(NotificationsController);
UseGuards(OperationsPolicyGuard)(NotificationsController);
Inject(NotificationIntentService)(NotificationsController, undefined, 0);
Inject(NotificationPreferenceService)(NotificationsController, undefined, 1);
Inject(OperationsTargetAuthorizer)(NotificationsController, undefined, 2);
decorate("inbox", Get(), [Req(), Query("cursor"), Query("limit")]);
decorate("setPreference", Post("preferences"), [Req(), Body()]);
decorate("open", Post(":intentId/open"), [Req(), Param("intentId")]);

function actor(request: OperationsRequest) {
  return request.principal!.userId;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function decorate(
  method: keyof NotificationsController,
  route: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(NotificationsController.prototype, method)!;
  parameters.forEach((parameter, index) =>
    parameter(NotificationsController.prototype, method, index),
  );
  route(NotificationsController.prototype, method, descriptor);
}
