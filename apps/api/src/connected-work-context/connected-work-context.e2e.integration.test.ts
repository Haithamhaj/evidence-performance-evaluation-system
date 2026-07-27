import { AppError } from "@evaluation/contracts";
import { Module } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  AUTH_DATABASE,
  AUTH_TOKEN_VALIDATOR,
  AUTH_USER_SYNCHRONIZER,
  AUTH_VALIDATION_CONFIG,
  AuthGuard,
} from "../auth/auth.guard.js";
import { AppModule } from "../app.module.js";
import { AppErrorFilter } from "../platform/error.filter.js";
import {
  ConnectedWorkContextModule,
  createSyntheticGoogleWorkspaceAdapter,
  parseConnectedWorkContextRuntimeConfiguration,
} from "./connected-work-context.module.js";
import { ConnectedWorkContextPolicyGuard } from "./connected-work-context-policy.guard.js";
import {
  CONNECTED_WORK_RUNTIME_CONFIGURATION,
  ConnectionsController,
  GoogleConnectionFlowService,
} from "./connections.controller.js";
import { ContextItemsController } from "./context-items.controller.js";

const redirectUri = "http://127.0.0.1:3300/api/connected-work/google/callback";
const ownerId = crypto.randomUUID();
const otherEmployeeId = crypto.randomUUID();
const inactiveEmployeeId = crypto.randomUUID();
const sourceItemId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const privateTitle = "Synthetic project decision";
const privateSummary = "Synthetic owner-only follow-up";
const privateSourceUrl = "https://mail.example.invalid/synthetic-owner-thread";

function createFlow() {
  return new GoogleConnectionFlowService({
    configuration: {
      mode: "synthetic",
      allowedRedirectUris: [redirectUri],
      stateTtlMs: 60_000,
    },
    connection: {
      connect: vi.fn(async () => ({ connected: true })),
    } as never,
    sync: {
      sync: vi.fn(async () => ({
        processedCount: 1,
        normalizedItemCount: 1,
        recoveredFromExpiredCursor: false,
      })),
    } as never,
  });
}

describe("connected work protected API", () => {
  it("registers the protected connected-work module in the application", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)).toContain(
      ConnectedWorkContextModule,
    );
  });

  it("defaults to the externally gated live mode and requires explicit synthetic mode", () => {
    expect(parseConnectedWorkContextRuntimeConfiguration({})).toEqual({
      mode: "live",
      allowedRedirectUris: [],
      stateTtlMs: 600_000,
      externalConfigurationReady: false,
    });
    expect(
      parseConnectedWorkContextRuntimeConfiguration({
        CONNECTED_WORK_CONTEXT_MODE: "synthetic",
        CONNECTED_WORK_CONTEXT_REDIRECT_URIS: redirectUri,
      }),
    ).toEqual({
      mode: "synthetic",
      allowedRedirectUris: [redirectUri],
      stateTtlMs: 600_000,
    });
  });

  it("provides deterministic minimal Gmail and Calendar fixtures for synthetic review", async () => {
    const adapter = createSyntheticGoogleWorkspaceAdapter();
    const credential = {
      accessToken: crypto.randomUUID(),
      refreshToken: null,
      expiresAt: null,
    };
    const [gmail, calendar] = await Promise.all(
      (["GOOGLE_GMAIL", "GOOGLE_CALENDAR"] as const).map((provider) =>
        adapter.pull({
          provider,
          credential,
          syncCursor: null,
          pageCursor: null,
          exclusions: [],
        }),
      ),
    );

    expect(gmail).toMatchObject({
      kind: "page",
      items: [
        {
          providerSourceId: "synthetic-gmail-project-decision",
          title: "[Synthetic] Project decision",
          occurredAt: "2026-07-20T08:30:00.000Z",
        },
      ],
    });
    expect(calendar).toMatchObject({
      kind: "page",
      items: [
        {
          providerSourceId: "synthetic-calendar-project-review",
          title: "[Synthetic] Project review",
          occurredAt: "2026-07-20T10:00:00.000Z",
        },
      ],
    });
  });

  it("rejects an OAuth callback with an unknown CSRF state", async () => {
    const flow = createFlow();

    await expect(
      flow.complete({
        actor: { userId: ownerId, active: true },
        correlationId: crypto.randomUUID(),
        redirectUri,
        state: "unknown-state",
        nonce: "unknown-nonce",
      }),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_OAUTH_STATE_INVALID", status: 403 });
  });

  it("uses an exact OAuth redirect allowlist instead of accepting a prefixed URL", () => {
    const flow = createFlow();

    expect(() =>
      flow.start({
        actor: { userId: ownerId, active: true },
        redirectUri: `${redirectUri}/attacker`,
      }),
    ).toThrow(
      expect.objectContaining({ code: "CONNECTED_CONTEXT_REDIRECT_FORBIDDEN", status: 400 }),
    );
  });

  it("rejects a mismatched OAuth nonce without consuming the valid state", async () => {
    const flow = createFlow();
    const started = flow.start({
      actor: { userId: ownerId, active: true },
      redirectUri,
    });
    const authorizationUrl = new URL(started.authorizationUrl);
    const state = authorizationUrl.searchParams.get("state")!;
    const nonce = authorizationUrl.searchParams.get("nonce")!;
    const command = {
      actor: { userId: ownerId, active: true },
      correlationId: crypto.randomUUID(),
      redirectUri,
      state,
    };

    await expect(flow.complete({ ...command, nonce: "wrong-nonce" })).rejects.toMatchObject({
      code: "CONNECTED_CONTEXT_OAUTH_NONCE_INVALID",
      status: 403,
    });
    await expect(flow.complete({ ...command, nonce })).resolves.toMatchObject({
      mode: "synthetic",
      synthetic: true,
    });
  });

  it("binds OAuth state to the authenticated principal that started the flow", async () => {
    const flow = createFlow();
    const started = flow.start({
      actor: { userId: ownerId, active: true },
      redirectUri,
    });
    const authorizationUrl = new URL(started.authorizationUrl);
    const state = authorizationUrl.searchParams.get("state")!;
    const nonce = authorizationUrl.searchParams.get("nonce")!;

    await expect(
      flow.complete({
        actor: { userId: crypto.randomUUID(), active: true },
        correlationId: crypto.randomUUID(),
        redirectUri,
        state,
        nonce,
      }),
    ).rejects.toMatchObject({
      code: "CONNECTED_CONTEXT_OAUTH_PRINCIPAL_MISMATCH",
      status: 403,
    });
    await expect(
      flow.complete({
        actor: { userId: ownerId, active: true },
        correlationId: crypto.randomUUID(),
        redirectUri,
        state,
        nonce,
      }),
    ).resolves.toMatchObject({ connected: true });
  });

  it("binds the callback to the exact redirect URI used at OAuth start", async () => {
    const secondRedirectUri = "http://127.0.0.1:3300/en/settings/connections";
    const flow = new GoogleConnectionFlowService({
      configuration: {
        mode: "synthetic",
        allowedRedirectUris: [redirectUri, secondRedirectUri],
        stateTtlMs: 60_000,
      },
      connection: { connect: vi.fn(async () => ({ connected: true })) } as never,
      sync: {
        sync: vi.fn(async () => ({
          processedCount: 1,
          normalizedItemCount: 1,
          recoveredFromExpiredCursor: false,
        })),
      } as never,
    });
    const started = flow.start({
      actor: { userId: ownerId, active: true },
      redirectUri,
    });
    const authorizationUrl = new URL(started.authorizationUrl);

    await expect(
      flow.complete({
        actor: { userId: ownerId, active: true },
        correlationId: crypto.randomUUID(),
        redirectUri: secondRedirectUri,
        state: authorizationUrl.searchParams.get("state")!,
        nonce: authorizationUrl.searchParams.get("nonce")!,
      }),
    ).rejects.toMatchObject({
      code: "CONNECTED_CONTEXT_REDIRECT_FORBIDDEN",
      status: 400,
    });
  });

  it("returns EXTERNAL_CONFIGURATION_REQUIRED when live OAuth settings are absent", () => {
    const flow = new GoogleConnectionFlowService({
      configuration: {
        mode: "live",
        allowedRedirectUris: [redirectUri],
        stateTtlMs: 60_000,
        externalConfigurationReady: false,
      },
      connection: {} as never,
      sync: {} as never,
    });

    expect(() =>
      flow.start({
        actor: { userId: ownerId, active: true },
        redirectUri,
      }),
    ).toThrow(expect.objectContaining({ code: "EXTERNAL_CONFIGURATION_REQUIRED", status: 503 }));
  });

  it("denies an inactive authenticated principal before starting OAuth", () => {
    const flow = createFlow();

    expect(() =>
      flow.start({
        actor: { userId: ownerId, active: false },
        redirectUri,
      }),
    ).toThrow(expect.objectContaining({ code: "CONNECTED_CONTEXT_FORBIDDEN", status: 403 }));
  });

  it("expires OAuth state and rejects its later callback", async () => {
    let now = 1_000;
    const flow = new GoogleConnectionFlowService({
      configuration: {
        mode: "synthetic",
        allowedRedirectUris: [redirectUri],
        stateTtlMs: 60_000,
      },
      connection: { connect: vi.fn() } as never,
      sync: { sync: vi.fn() } as never,
      clock: () => now,
    });
    const started = flow.start({
      actor: { userId: ownerId, active: true },
      redirectUri,
    });
    const authorizationUrl = new URL(started.authorizationUrl);
    now += 60_001;

    await expect(
      flow.complete({
        actor: { userId: ownerId, active: true },
        correlationId: crypto.randomUUID(),
        redirectUri,
        state: authorizationUrl.searchParams.get("state")!,
        nonce: authorizationUrl.searchParams.get("nonce")!,
      }),
    ).rejects.toMatchObject({
      code: "CONNECTED_CONTEXT_OAUTH_STATE_INVALID",
      status: 403,
    });
  });
});

const connectionService = {
  connect: vi.fn(async () => ({ connected: true })),
  disconnect: vi.fn(async ({ actor }: { actor: { userId: string } }) => {
    enforceOwner(actor.userId);
    return { connected: false };
  }),
  setItemExclusion: vi.fn(
    async ({
      actor,
      sourceItemId: requestedId,
      excluded,
    }: {
      actor: { userId: string };
      sourceItemId: string;
      excluded: boolean;
    }) => {
      enforceOwnedItem(actor.userId, requestedId);
      return { excluded };
    },
  ),
  linkProject: vi.fn(
    async ({
      actor,
      sourceItemId: requestedId,
      projectId: requestedProjectId,
    }: {
      actor: { userId: string };
      sourceItemId: string;
      projectId: string;
    }) => {
      enforceOwnedItem(actor.userId, requestedId);
      return { sourceItemId: requestedId, projectId: requestedProjectId };
    },
  ),
  unlinkProject: vi.fn(
    async ({
      actor,
      sourceItemId: requestedId,
    }: {
      actor: { userId: string };
      sourceItemId: string;
    }) => {
      enforceOwnedItem(actor.userId, requestedId);
      return { sourceItemId: requestedId, projectId };
    },
  ),
};

const queryService = {
  list: vi.fn(async ({ actor }: { actor: { userId: string } }) =>
    actor.userId === ownerId
      ? [
          {
            id: sourceItemId,
            employeeId: ownerId,
            provider: "GOOGLE_GMAIL",
            providerSourceId: "synthetic-owner-thread",
            occurredAt: "2026-07-20T09:00:00.000Z",
            title: privateTitle,
            summary: privateSummary,
            sourceUrl: privateSourceUrl,
            privacy: "PRIVATE",
            excluded: false,
          },
        ]
      : [],
  ),
};

const syncService = {
  sync: vi.fn(async () => ({
    processedCount: 1,
    normalizedItemCount: 1,
    recoveredFromExpiredCursor: false,
  })),
};

const httpFlow = new GoogleConnectionFlowService({
  configuration: {
    mode: "synthetic",
    allowedRedirectUris: [redirectUri],
    stateTtlMs: 60_000,
  },
  connection: connectionService as never,
  sync: syncService as never,
});

class TestConnectedWorkContextModule {}

Module({
  controllers: [ConnectionsController, ContextItemsController],
  providers: [
    { provide: AUTH_VALIDATION_CONFIG, useValue: {} },
    { provide: AUTH_DATABASE, useValue: {} },
    {
      provide: AUTH_TOKEN_VALIDATOR,
      useValue: async (token: string) => ({
        email: `${token}@example.invalid`,
        issuer: "https://identity.example.invalid",
        oidcSubject: token,
      }),
    },
    {
      provide: AUTH_USER_SYNCHRONIZER,
      useValue: async (
        _database: unknown,
        external: import("@evaluation/auth").ValidatedOidcPrincipal,
      ) => ({
        userId: external.oidcSubject,
        active: external.oidcSubject !== inactiveEmployeeId,
        email: external.email,
        oidcSubject: external.oidcSubject,
        roles: [],
      }),
    },
    AuthGuard,
    ConnectedWorkContextPolicyGuard,
    {
      provide: CONNECTED_WORK_RUNTIME_CONFIGURATION,
      useValue: {
        mode: "synthetic",
        allowedRedirectUris: [redirectUri],
        stateTtlMs: 60_000,
      },
    },
    { provide: GoogleConnectionFlowService, useValue: httpFlow },
    {
      provide: "CONNECTED_WORK_CONNECTION_SERVICE",
      useValue: connectionService,
    },
    {
      provide: "CONNECTED_WORK_QUERY_SERVICE",
      useValue: queryService,
    },
  ],
})(TestConnectedWorkContextModule);

let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";

beforeAll(async () => {
  app = await NestFactory.create(TestConnectedWorkContextModule, {
    abortOnError: false,
    logger: false,
  });
  app.useGlobalFilters(new AppErrorFilter());
  app.use(
    (
      request: { headers: Record<string, string | undefined>; correlationId?: string },
      _response: unknown,
      next: () => void,
    ) => {
      request.correlationId = request.headers["x-correlation-id"] ?? crypto.randomUUID();
      next();
    },
  );
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => app?.close());

async function apiRequest(
  method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT",
  path: string,
  token: string,
  body?: unknown,
) {
  const correlationId = crypto.randomUUID();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-correlation-id": correlationId,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    response,
    body: (await response.json()) as Record<string, unknown>,
    correlationId,
  };
}

describe("connected work composed HTTP API", () => {
  it("returns the minimal decrypted synthetic review view only to its owner", async () => {
    const owner = await apiRequest("GET", "/api/v1/connected-work/items", ownerId);
    expect(owner.response.status).toBe(200);
    expect(owner.body).toEqual({
      mode: "synthetic",
      synthetic: true,
      items: [
        {
          id: sourceItemId,
          provider: "GOOGLE_GMAIL",
          occurredAt: "2026-07-20T09:00:00.000Z",
          title: privateTitle,
          summary: privateSummary,
          sourceUrl: privateSourceUrl,
          privacy: "PRIVATE",
          excluded: false,
        },
      ],
    });

    const other = await apiRequest("GET", "/api/v1/connected-work/items", otherEmployeeId);
    expect(other.response.status).toBe(200);
    expect(other.body).toEqual({ mode: "synthetic", synthetic: true, items: [] });
    expect(JSON.stringify(other.body)).not.toContain(privateSummary);
    expect(JSON.stringify(other.body)).not.toContain(privateSourceUrl);
  });

  it("denies cross-user item mutation while allowing the owner exclusion", async () => {
    const other = await apiRequest(
      "PATCH",
      `/api/v1/connected-work/items/${sourceItemId}/exclusion`,
      otherEmployeeId,
      { excluded: true },
    );
    expect(other.response.status).toBe(403);
    expect(other.body).toMatchObject({
      code: "CONNECTED_CONTEXT_FORBIDDEN",
      correlationId: other.correlationId,
    });
    expect(JSON.stringify(other.body)).not.toContain(privateSummary);
    expect(JSON.stringify(other.body)).not.toContain(privateSourceUrl);

    const owner = await apiRequest(
      "PATCH",
      `/api/v1/connected-work/items/${sourceItemId}/exclusion`,
      ownerId,
      { excluded: true },
    );
    expect(owner.response.status).toBe(200);
    expect(owner.body).toEqual({ id: sourceItemId, excluded: true });
  });

  it("binds reversible Project links to the authenticated owner and URL item", async () => {
    const linked = await apiRequest(
      "PUT",
      `/api/v1/connected-work/items/${sourceItemId}/project-link`,
      ownerId,
      { projectId, reason: "Synthetic fixture reviewed by its owner." },
    );
    expect(linked.response.status).toBe(200);
    expect(linked.body).toEqual({ id: sourceItemId, projectId, linked: true });
    expect(connectionService.linkProject).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: ownerId, active: true },
        sourceItemId,
        projectId,
      }),
    );

    const denied = await apiRequest(
      "DELETE",
      `/api/v1/connected-work/items/${sourceItemId}/project-link`,
      otherEmployeeId,
      { reason: "Not the owner." },
    );
    expect(denied.response.status).toBe(403);

    const unlinked = await apiRequest(
      "DELETE",
      `/api/v1/connected-work/items/${sourceItemId}/project-link`,
      ownerId,
      { reason: "Owner removed the synthetic link." },
    );
    expect(unlinked.response.status).toBe(200);
    expect(unlinked.body).toEqual({ id: sourceItemId, linked: false });
  });

  it("completes the synthetic OAuth route without returning the authorization code", async () => {
    const started = await apiRequest("POST", "/api/v1/connected-work/google/start", ownerId, {
      redirectUri,
    });
    expect(started.response.status).toBe(201);
    expect(started.body).toMatchObject({ mode: "synthetic", synthetic: true });
    const authorizationUrl = new URL(started.body.authorizationUrl as string);
    const authorizationCode = "never-return-this-authorization-code";
    const callbackQuery = new URLSearchParams({
      state: authorizationUrl.searchParams.get("state")!,
      nonce: authorizationUrl.searchParams.get("nonce")!,
      redirectUri,
      code: authorizationCode,
    });

    const completed = await apiRequest(
      "GET",
      `/api/v1/connected-work/google/callback?${callbackQuery.toString()}`,
      ownerId,
    );
    expect(completed.response.status).toBe(200);
    expect(completed.body).toMatchObject({
      mode: "synthetic",
      synthetic: true,
      connected: true,
    });
    expect(JSON.stringify(completed.body)).not.toContain(authorizationCode);

    const replay = await apiRequest(
      "GET",
      `/api/v1/connected-work/google/callback?${callbackQuery.toString()}`,
      ownerId,
    );
    expect(replay.response.status).toBe(403);
    expect(replay.body).toMatchObject({ code: "CONNECTED_CONTEXT_OAUTH_STATE_INVALID" });
  });

  it("denies inactive principals and exposes the protected disconnect route", async () => {
    const inactive = await apiRequest(
      "POST",
      "/api/v1/connected-work/google/start",
      inactiveEmployeeId,
      { redirectUri },
    );
    expect(inactive.response.status).toBe(403);
    expect(inactive.body).toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });

    const disconnected = await apiRequest("DELETE", "/api/v1/connected-work/google", ownerId);
    expect(disconnected.response.status).toBe(200);
    expect(disconnected.body).toEqual({ mode: "synthetic", synthetic: true, connected: false });
  });
});

function enforceOwner(actorId: string): void {
  if (actorId !== ownerId) forbidden();
}

function enforceOwnedItem(actorId: string, requestedId: string): void {
  if (actorId !== ownerId || requestedId !== sourceItemId) forbidden();
}

function forbidden(): never {
  throw new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
}
