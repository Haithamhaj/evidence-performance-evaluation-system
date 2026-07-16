import { Body, Controller, Inject, Injectable, Module, Post, Req, UseGuards } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "@evaluation/auth";
import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";

import { AuthGuard } from "../auth/auth.guard.js";
import { AuthModule } from "../auth/auth.module.js";
import { createAiGovernanceComposition } from "./admin-composition.js";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;
type RoutePrincipal = Pick<AuthenticatedPrincipal, "active" | "userId">;

export const AI_ROUTING_DATABASE = Symbol("AI_ROUTING_DATABASE");

function authorizationError(reasonCode: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(
    `AUTHZ_${reasonCode}`,
    "errors.authorization.denied",
    reasonCode === "UNAUTHENTICATED" ? 401 : 403,
  );
}

export async function changeAuthorizedAiRoute(
  client: DatabaseClient,
  principal: RoutePrincipal,
  input: unknown,
) {
  return createAiGovernanceComposition(client).changeRoute(principal, input);
}

export function registerAuthorizedAiLocalTrustPolicy(
  client: DatabaseClient,
  principal: RoutePrincipal,
  input: unknown,
) {
  return createAiGovernanceComposition(client).registerLocalTrustPolicy(principal, input);
}

export function registerAuthorizedAiProviderConfig(
  client: DatabaseClient,
  principal: RoutePrincipal,
  input: unknown,
) {
  return createAiGovernanceComposition(client).registerProviderConfig(principal, input);
}

export function registerAuthorizedAiOutputSchema(
  client: DatabaseClient,
  principal: RoutePrincipal,
  input: unknown,
) {
  return createAiGovernanceComposition(client).registerOutputSchema(principal, input);
}

export class ManagedAiRoutingDatabase {
  readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

export class AiRouteManagementService {
  private readonly database: ManagedAiRoutingDatabase;

  constructor(database: ManagedAiRoutingDatabase) {
    this.database = database;
  }

  change(principal: RoutePrincipal, input: unknown) {
    return changeAuthorizedAiRoute(this.database.client, principal, input);
  }
}

Injectable()(AiRouteManagementService);
Inject(AI_ROUTING_DATABASE)(AiRouteManagementService, undefined, 0);

export class AiRouteAuthenticationGuard {
  private readonly authGuard: AuthGuard;

  constructor(authGuard: AuthGuard) {
    this.authGuard = authGuard;
  }

  canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    return this.authGuard.canActivate(context);
  }
}

Injectable()(AiRouteAuthenticationGuard);
Inject(AuthGuard)(AiRouteAuthenticationGuard, undefined, 0);

type AiRouteRequest = Readonly<{ principal?: AuthenticatedPrincipal }>;

export class AiRoutingController {
  private readonly service: AiRouteManagementService;

  constructor(service: AiRouteManagementService) {
    this.service = service;
  }

  change(input: unknown, request: AiRouteRequest) {
    if (request.principal === undefined) throw authorizationError("UNAUTHENTICATED");
    return this.service.change(request.principal, input);
  }
}

const changeDescriptor = Object.getOwnPropertyDescriptor(AiRoutingController.prototype, "change");
if (changeDescriptor === undefined)
  throw new Error("AI route change handler descriptor is missing");
Controller("ai-config/routes")(AiRoutingController);
Body()(AiRoutingController.prototype, "change", 0);
Req()(AiRoutingController.prototype, "change", 1);
Post()(AiRoutingController.prototype, "change", changeDescriptor);
UseGuards(AiRouteAuthenticationGuard)(AiRoutingController.prototype, "change", changeDescriptor);
Inject(AiRouteManagementService)(AiRoutingController, undefined, 0);

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (value === undefined || value.length === 0) throw new Error("DATABASE_URL must be configured");
  return value;
}

export class AiRoutingModule {}

Module({
  imports: [AuthModule],
  controllers: [AiRoutingController],
  providers: [
    {
      provide: AI_ROUTING_DATABASE,
      useFactory: () => new ManagedAiRoutingDatabase(createDatabaseClient(requiredDatabaseUrl())),
    },
    AiRouteManagementService,
    AiRouteAuthenticationGuard,
  ],
  exports: [AiRouteManagementService],
})(AiRoutingModule);
