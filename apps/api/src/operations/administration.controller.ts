/* eslint-disable no-unused-vars */
import { AdminCommandService, AdminHealthComposition } from "@evaluation/administration";
import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { OperationsPolicyGuard, type OperationsRequest } from "./operations-policy.guard.js";
import { AuthoritativeOperationsEventPublisher } from "./authoritative-event-publisher.js";

export class AdministrationController {
  constructor(
    private readonly commands: AdminCommandService,
    private readonly health: AdminHealthComposition,
    private readonly events: AuthoritativeOperationsEventPublisher,
  ) {}

  execute(request: OperationsRequest, body: unknown) {
    return this.commands.execute({ ...object(body), actorId: request.principal!.userId });
  }

  async readHealth(request: OperationsRequest) {
    const health = await this.health.read();
    await this.events.publishHealth(request.principal!.userId, health);
    return health;
  }
}

Controller("api/v1/operations/administration")(AdministrationController);
UseGuards(OperationsPolicyGuard)(AdministrationController);
Inject(AdminCommandService)(AdministrationController, undefined, 0);
Inject(AdminHealthComposition)(AdministrationController, undefined, 1);
Inject(AuthoritativeOperationsEventPublisher)(AdministrationController, undefined, 2);
decorate("execute", Post("commands"), [Req(), Body()]);
decorate("readHealth", Get("health"), [Req()]);

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function decorate(
  method: keyof AdministrationController,
  route: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(AdministrationController.prototype, method)!;
  parameters.forEach((parameter, index) =>
    parameter(AdministrationController.prototype, method, index),
  );
  route(AdministrationController.prototype, method, descriptor);
}
