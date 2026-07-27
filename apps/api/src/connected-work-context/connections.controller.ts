import { createHash, timingSafeEqual } from "node:crypto";

import { AppError } from "@evaluation/contracts";
import { Body, Controller, Delete, Get, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ConnectedWorkContextPolicyGuard } from "./connected-work-context-policy.guard.js";

type Actor = Readonly<{ userId: string; active: boolean }>;
export const CONNECTED_WORK_CONNECTION_SERVICE = "CONNECTED_WORK_CONNECTION_SERVICE";
export const CONNECTED_WORK_RUNTIME_CONFIGURATION = "CONNECTED_WORK_RUNTIME_CONFIGURATION";

export type GoogleConnectionFlowConfiguration =
  | Readonly<{
      mode: "synthetic";
      allowedRedirectUris: readonly string[];
      stateTtlMs: number;
    }>
  | Readonly<{
      mode: "live";
      allowedRedirectUris: readonly string[];
      stateTtlMs: number;
      externalConfigurationReady: false;
    }>;

type GoogleConnectionFlowDependencies = Readonly<{
  configuration: GoogleConnectionFlowConfiguration;
  connection: import("@evaluation/connected-work-context").ConnectedWorkConnectionService;
  sync: import("@evaluation/connected-work-context").ConnectedWorkSyncService;
  clock?: () => number;
}>;

type PendingOAuthState = Readonly<{
  employeeId: string;
  nonceHash: string;
  redirectUri: string;
  expiresAt: number;
}>;

export class GoogleConnectionFlowService {
  private readonly dependencies: GoogleConnectionFlowDependencies;
  private readonly pendingStates = new Map<string, PendingOAuthState>();
  private readonly clock: () => number;

  constructor(dependencies: GoogleConnectionFlowDependencies) {
    this.dependencies = dependencies;
    this.clock = dependencies.clock ?? Date.now;
  }

  start(command: Readonly<{ actor: Actor; redirectUri: string }>) {
    assertActive(command.actor);
    if (this.dependencies.configuration.mode === "live") {
      throw new AppError(
        "EXTERNAL_CONFIGURATION_REQUIRED",
        "errors.connectedContext.externalConfigurationRequired",
        503,
      );
    }
    if (!this.dependencies.configuration.allowedRedirectUris.includes(command.redirectUri)) {
      throw new AppError(
        "CONNECTED_CONTEXT_REDIRECT_FORBIDDEN",
        "errors.connectedContext.redirectForbidden",
        400,
      );
    }
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    this.pendingStates.set(hash(state), {
      employeeId: command.actor.userId,
      nonceHash: hash(nonce),
      redirectUri: command.redirectUri,
      expiresAt: this.clock() + this.dependencies.configuration.stateTtlMs,
    });
    const authorizationUrl = new URL(command.redirectUri);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("nonce", nonce);
    return {
      mode: this.dependencies.configuration.mode,
      synthetic: this.dependencies.configuration.mode === "synthetic",
      authorizationUrl: authorizationUrl.toString(),
    };
  }

  async complete(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      redirectUri: string;
      state: string;
      nonce: string;
    }>,
  ) {
    assertActive(command.actor);
    const stateKey = hash(command.state);
    const pending = this.pendingStates.get(stateKey);
    if (pending === undefined) {
      throw new AppError(
        "CONNECTED_CONTEXT_OAUTH_STATE_INVALID",
        "errors.connectedContext.oauthStateInvalid",
        403,
      );
    }
    if (pending.expiresAt <= this.clock()) {
      this.pendingStates.delete(stateKey);
      throw new AppError(
        "CONNECTED_CONTEXT_OAUTH_STATE_INVALID",
        "errors.connectedContext.oauthStateInvalid",
        403,
      );
    }
    if (pending.employeeId !== command.actor.userId) {
      throw new AppError(
        "CONNECTED_CONTEXT_OAUTH_PRINCIPAL_MISMATCH",
        "errors.connectedContext.oauthPrincipalMismatch",
        403,
      );
    }
    if (
      pending.redirectUri !== command.redirectUri ||
      !this.dependencies.configuration.allowedRedirectUris.includes(command.redirectUri)
    ) {
      throw new AppError(
        "CONNECTED_CONTEXT_REDIRECT_FORBIDDEN",
        "errors.connectedContext.redirectForbidden",
        400,
      );
    }
    if (!sameHash(pending.nonceHash, hash(command.nonce))) {
      throw new AppError(
        "CONNECTED_CONTEXT_OAUTH_NONCE_INVALID",
        "errors.connectedContext.oauthNonceInvalid",
        403,
      );
    }
    this.pendingStates.delete(stateKey);
    await this.dependencies.connection.connect({
      actor: command.actor,
      correlationId: command.correlationId,
      credential: {
        accessToken: crypto.randomUUID(),
        refreshToken: null,
        expiresAt: null,
      },
    });
    const synchronizedProviders = await Promise.all(
      (["GOOGLE_GMAIL", "GOOGLE_CALENDAR"] as const).map(async (provider) => {
        await this.dependencies.sync.sync({ actor: command.actor, provider });
        return provider;
      }),
    );
    return {
      mode: this.dependencies.configuration.mode,
      synthetic: this.dependencies.configuration.mode === "synthetic",
      connected: true,
      synchronizedProviders,
    };
  }
}

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;
type ContextConnection = Pick<
  import("@evaluation/connected-work-context").ConnectedWorkConnectionService,
  "disconnect"
>;
const StartInputSchema = z.object({ redirectUri: z.string().min(1).max(2_000) }).strict();
const CallbackInputSchema = z
  .object({
    state: z.string().min(1).max(2_000),
    nonce: z.string().min(1).max(2_000),
    redirectUri: z.string().min(1).max(2_000),
    code: z.string().min(1).max(10_000).optional(),
  })
  .strict();

export class ConnectionsController {
  private readonly flow: GoogleConnectionFlowService;
  private readonly connection: ContextConnection;
  private readonly configuration: GoogleConnectionFlowConfiguration;

  constructor(
    flow: GoogleConnectionFlowService,
    connection: ContextConnection,
    configuration: GoogleConnectionFlowConfiguration,
  ) {
    this.flow = flow;
    this.connection = connection;
    this.configuration = configuration;
  }

  start(request: Request, body: unknown) {
    const input = parseInput(StartInputSchema, body);
    return this.flow.start({ actor: actor(request), redirectUri: input.redirectUri });
  }

  callback(request: Request, query: unknown) {
    const input = parseInput(CallbackInputSchema, query);
    return this.flow.complete({
      actor: actor(request),
      correlationId: request.correlationId,
      redirectUri: input.redirectUri,
      state: input.state,
      nonce: input.nonce,
    });
  }

  async disconnect(request: Request) {
    await this.connection.disconnect({
      actor: actor(request),
      correlationId: request.correlationId,
    });
    return {
      mode: this.configuration.mode,
      synthetic: this.configuration.mode === "synthetic",
      connected: false,
    };
  }
}

function actor(request: Request): Actor {
  return { userId: request.principal.userId, active: request.principal.active };
}

Controller("api/v1/connected-work/google")(ConnectionsController);
UseGuards(ConnectedWorkContextPolicyGuard)(ConnectionsController);
Inject(GoogleConnectionFlowService)(ConnectionsController, undefined, 0);
Inject(CONNECTED_WORK_CONNECTION_SERVICE)(ConnectionsController, undefined, 1);
Inject(CONNECTED_WORK_RUNTIME_CONFIGURATION)(ConnectionsController, undefined, 2);

const start = Object.getOwnPropertyDescriptor(ConnectionsController.prototype, "start")!;
Req()(ConnectionsController.prototype, "start", 0);
Body()(ConnectionsController.prototype, "start", 1);
Post("start")(ConnectionsController.prototype, "start", start);

const callback = Object.getOwnPropertyDescriptor(ConnectionsController.prototype, "callback")!;
Req()(ConnectionsController.prototype, "callback", 0);
Query()(ConnectionsController.prototype, "callback", 1);
Get("callback")(ConnectionsController.prototype, "callback", callback);

const disconnect = Object.getOwnPropertyDescriptor(ConnectionsController.prototype, "disconnect")!;
Req()(ConnectionsController.prototype, "disconnect", 0);
Delete()(ConnectionsController.prototype, "disconnect", disconnect);

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function assertActive(actor: Actor): void {
  if (!actor.active) {
    throw new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
  }
}

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      "CONNECTED_CONTEXT_INPUT_INVALID",
      "errors.connectedContext.inputInvalid",
      400,
    );
  }
  return result.data;
}
