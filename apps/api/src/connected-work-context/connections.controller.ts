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
    }>
  | Readonly<{
      mode: "google-local";
      appEnvironment: "local";
      nodeEnvironment: "development" | "test";
      allowedRedirectUris: readonly string[];
      stateTtlMs: number;
      oauthConfiguration: Extract<
        import("@evaluation/connected-work-context").GoogleOAuthConfiguration,
        { externalConfigurationReady: true }
      >;
    }>;

type GoogleConnectionFlowDependencies = Readonly<{
  configuration: GoogleConnectionFlowConfiguration;
  connection: import("@evaluation/connected-work-context").ConnectedWorkConnectionService;
  sync: import("@evaluation/connected-work-context").ConnectedWorkSyncService;
  oauthClient?: Pick<
    import("@evaluation/connected-work-context").GoogleOAuthClient,
    "createAuthorizationUrl" | "exchangeAuthorizationCode" | "revoke"
  >;
  clock?: () => number;
}>;

type PendingOAuthState = Readonly<{
  employeeId: string;
  nonceHash: string | null;
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
    const nonce = this.dependencies.configuration.mode === "synthetic" ? crypto.randomUUID() : null;
    this.pendingStates.set(hash(state), {
      employeeId: command.actor.userId,
      nonceHash: nonce === null ? null : hash(nonce),
      redirectUri: command.redirectUri,
      expiresAt: this.clock() + this.dependencies.configuration.stateTtlMs,
    });
    let authorizationUrl: string;
    if (this.dependencies.configuration.mode === "synthetic") {
      const syntheticUrl = new URL(command.redirectUri);
      syntheticUrl.searchParams.set("state", state);
      syntheticUrl.searchParams.set("nonce", nonce!);
      authorizationUrl = syntheticUrl.toString();
    } else {
      authorizationUrl = this.requireLocalOAuthClient().createAuthorizationUrl({ state });
    }
    return {
      mode: publicMode(this.dependencies.configuration),
      synthetic: this.dependencies.configuration.mode === "synthetic",
      authorizationUrl,
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
    if (this.dependencies.configuration.mode !== "synthetic") {
      throw externalConfigurationRequiredError();
    }
    const pending = this.requirePendingState(command.actor, command.state);
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
    if (pending.nonceHash === null || !sameHash(pending.nonceHash, hash(command.nonce))) {
      throw new AppError(
        "CONNECTED_CONTEXT_OAUTH_NONCE_INVALID",
        "errors.connectedContext.oauthNonceInvalid",
        403,
      );
    }
    this.pendingStates.delete(hash(command.state));
    await this.dependencies.connection.connect({
      actor: command.actor,
      correlationId: command.correlationId,
      credential: {
        accessToken: crypto.randomUUID(),
        refreshToken: null,
        expiresAt: null,
      },
    });
    const synchronizedProviders = await this.synchronize(command.actor);
    return {
      mode: "synthetic" as const,
      synthetic: true,
      connected: true,
      synchronizedProviders,
    };
  }

  async completeLocal(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      state: string;
      code: string;
    }>,
  ) {
    assertActive(command.actor);
    if (this.dependencies.configuration.mode !== "google-local") {
      throw externalConfigurationRequiredError();
    }
    const pending = this.requirePendingState(command.actor, command.state);
    this.pendingStates.delete(hash(command.state));
    const oauthClient = this.requireLocalOAuthClient();
    let credential: import("@evaluation/connected-work-context").OAuthCredential | null = null;
    let connected = false;
    try {
      credential = await oauthClient.exchangeAuthorizationCode(command.code);
      await this.dependencies.connection.connect({
        actor: command.actor,
        correlationId: command.correlationId,
        credential,
      });
      connected = true;
      const synchronizedProviders = await this.synchronize(command.actor);
      return {
        mode: "live" as const,
        synthetic: false,
        connected: true,
        returnUri: pending.redirectUri,
        synchronizedProviders,
      };
    } catch {
      if (connected) {
        try {
          await this.dependencies.connection.disconnect({
            actor: command.actor,
            correlationId: command.correlationId,
          });
        } catch {
          // ConnectionService and local vault fail closed before provider revocation is attempted.
        }
      } else if (credential !== null) {
        try {
          await oauthClient.revoke(credential);
        } catch {
          // The credential was never made usable by a connected account.
        }
      }
      return {
        mode: "live" as const,
        synthetic: false,
        connected: false,
        returnUri: pending.redirectUri,
        synchronizedProviders: [] as const,
      };
    }
  }

  private requirePendingState(actor: Actor, state: string): PendingOAuthState {
    const stateKey = hash(state);
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
    if (pending.employeeId !== actor.userId) {
      throw new AppError(
        "CONNECTED_CONTEXT_OAUTH_PRINCIPAL_MISMATCH",
        "errors.connectedContext.oauthPrincipalMismatch",
        403,
      );
    }
    return pending;
  }

  private requireLocalOAuthClient() {
    if (this.dependencies.oauthClient === undefined) throw externalConfigurationRequiredError();
    return this.dependencies.oauthClient;
  }

  private async synchronize(actor: Actor) {
    const synchronizedProviders: Array<"GOOGLE_GMAIL" | "GOOGLE_CALENDAR"> = [];
    for (const provider of ["GOOGLE_GMAIL", "GOOGLE_CALENDAR"] as const) {
      await this.dependencies.sync.sync({ actor, provider });
      synchronizedProviders.push(provider);
    }
    return synchronizedProviders;
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
const LocalCompletionInputSchema = z
  .object({
    state: z.string().min(1).max(2_000),
    code: z.string().min(1).max(10_000),
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

  completeLocal(request: Request, body: unknown) {
    const input = parseInput(LocalCompletionInputSchema, body);
    return this.flow.completeLocal({
      actor: actor(request),
      correlationId: request.correlationId,
      code: input.code,
      state: input.state,
    });
  }

  async disconnect(request: Request) {
    await this.connection.disconnect({
      actor: actor(request),
      correlationId: request.correlationId,
    });
    return {
      mode: publicMode(this.configuration),
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

const completeLocal = Object.getOwnPropertyDescriptor(
  ConnectionsController.prototype,
  "completeLocal",
)!;
Req()(ConnectionsController.prototype, "completeLocal", 0);
Body()(ConnectionsController.prototype, "completeLocal", 1);
Post("complete")(ConnectionsController.prototype, "completeLocal", completeLocal);

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

export function publicMode(configuration: GoogleConnectionFlowConfiguration): "synthetic" | "live" {
  return configuration.mode === "synthetic" ? "synthetic" : "live";
}

function externalConfigurationRequiredError(): AppError {
  return new AppError(
    "EXTERNAL_CONFIGURATION_REQUIRED",
    "errors.connectedContext.externalConfigurationRequired",
    503,
  );
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
