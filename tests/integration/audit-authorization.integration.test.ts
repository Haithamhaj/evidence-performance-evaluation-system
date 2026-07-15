import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { appendAuditEvent } from "../../packages/audit/src/index.js";
import { createDatabaseClient } from "../../packages/database/src/index.js";
import { seedPilotWithAudit } from "../../scripts/seed-pilot.js";

import {
  AUTH_DATABASE,
  AUTH_TOKEN_VALIDATOR,
  AUTH_USER_SYNCHRONIZER,
  AUTH_VALIDATION_CONFIG,
  AuthGuard,
} from "../../apps/api/src/auth/auth.guard.js";
import { AppErrorFilter } from "../../apps/api/src/platform/error.filter.js";
import {
  AUDIT_DATABASE,
  AuditController,
  AuditQueryGuard,
  ManagedAuditDatabaseClient,
} from "../../apps/api/src/audit/audit.controller.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
let administratorId = "";
let employeeId = "";
let eventCorrelationId = "";
let app: import("@nestjs/common").INestApplication;
let baseUrl = "";

function principal(userId: string): import("@evaluation/auth").AuthenticatedPrincipal {
  return {
    userId,
    active: true,
    email: `${userId}@pilot.local`,
    oidcSubject: `oidc-${userId}`,
    roles: [],
  };
}

class TestAuditModule {}

Module({
  controllers: [AuditController],
  providers: [
    {
      provide: AUTH_VALIDATION_CONFIG,
      useValue: {
        audience: "evaluation-api",
        issuer: "https://identity.test/realms/evaluation",
        jwks: vi.fn(),
      },
    },
    { provide: AUTH_DATABASE, useValue: {} },
    {
      provide: AUTH_TOKEN_VALIDATOR,
      useValue: async (token: string) => {
        if (!["administrator", "employee"].includes(token)) throw new Error("invalid token");
        return {
          email: `${token}@pilot.local`,
          issuer: "https://identity.test/realms/evaluation",
          oidcSubject: token,
        };
      },
    },
    {
      provide: AUTH_USER_SYNCHRONIZER,
      useValue: async (
        _client: unknown,
        external: import("@evaluation/auth").ValidatedOidcPrincipal,
      ) => principal(external.oidcSubject === "administrator" ? administratorId : employeeId),
    },
    AuthGuard,
    {
      provide: AUDIT_DATABASE,
      useFactory: () =>
        new ManagedAuditDatabaseClient(createDatabaseClient(process.env.TEST_DATABASE_URL ?? "")),
    },
    AuditQueryGuard,
  ],
})(TestAuditModule);

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await seedPilotWithAudit(database, {
    managerSubject: "pilot-manager",
    adminSubject: "system-admin",
  });
  const [administrator, departmentScope] = await Promise.all([
    database.user.findUniqueOrThrow({ where: { pilotKey: "system-admin" } }),
    database.authorizationScope.findUniqueOrThrow({ where: { key: "department:ai-department" } }),
  ]);
  administratorId = administrator.id;
  const suffix = crypto.randomUUID();
  const employee = await database.user.create({
    data: { email: `audit-employee-${suffix}@example.invalid`, displayName: "Audit Employee" },
  });
  employeeId = employee.id;
  await database.roleAssignment.create({
    data: {
      userId: employeeId,
      role: "employee",
      scopeType: "department",
      scopeId: departmentScope.id,
    },
  });
  eventCorrelationId = crypto.randomUUID();
  await appendAuditEvent(database, {
    eventType: "identity.synchronized",
    actor: { kind: "human", id: administratorId },
    effectiveSubjectId: administratorId,
    scopeType: "system",
    scopeId: (await database.authorizationScope.findUniqueOrThrow({ where: { key: "system" } })).id,
    targetType: "user",
    targetId: employeeId,
    correlationId: eventCorrelationId,
    source: "api",
    safeDiff: { fields: ["displayName"] },
  });

  app = await NestFactory.create(TestAuditModule, { abortOnError: false, logger: ["error"] });
  app.useGlobalFilters(new AppErrorFilter());
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (app !== undefined) await app.close();
  await database.roleAssignment.deleteMany({ where: { userId: employeeId } });
  await database.user.deleteMany({ where: { id: employeeId } });
  await database.$disconnect();
});

describe("audit query API authorization", () => {
  it("rejects unauthenticated requests server-side", async () => {
    const response = await fetch(`${baseUrl}/audit`);
    expect(response.status).toBe(401);
  });

  it("rejects an ordinary employee server-side", async () => {
    const response = await fetch(`${baseUrl}/audit`, {
      headers: { authorization: "Bearer employee" },
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED" });
  });

  it("returns a sanitized filtered page to the authorized System Administrator", async () => {
    const response = await fetch(
      `${baseUrl}/audit?correlationId=${eventCorrelationId}&eventType=identity.synchronized&limit=1`,
      { headers: { authorization: "Bearer administrator" } },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ correlationId: eventCorrelationId });
    expect(JSON.stringify(body)).not.toMatch(/token|secret|password|prompt|privateFeedback/u);
  });
});
