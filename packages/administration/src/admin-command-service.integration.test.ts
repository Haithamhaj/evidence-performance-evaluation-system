import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { AdminCommandService } from "./admin-command-service.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const administratorId = randomUUID();
const managerId = randomUUID();

beforeAll(async () => {
  await database.user.createMany({
    data: [
      { id: administratorId, email: `${administratorId}@example.test`, displayName: "Admin" },
      { id: managerId, email: `${managerId}@example.test`, displayName: "Manager" },
    ],
  });
});
afterAll(async () => database.$disconnect());

describe("AdminCommandService", () => {
  it("delegates an allowed mutation to the owner domain with expected version and audit", async () => {
    const execute = vi.fn(async () => ({
      ownerDomain: "ai-routing",
      ownerReceiptId: randomUUID(),
      auditEventId: randomUUID(),
    }));
    const service = new AdminCommandService(
      database,
      { isSystemAdministrator: async (actorId) => actorId === administratorId },
      { AI_ROUTES_MANAGE: { execute } },
    );
    const input = {
      schemaVersion: 1 as const,
      idempotencyKey: randomUUID(),
      actorId: administratorId,
      capability: "AI_ROUTES_MANAGE" as const,
      expectedVersion: 2,
      reason: "Route provider maintenance",
      payload: { routeKey: "update.structure" },
    };

    const receipt = await service.execute(input);

    expect(execute).toHaveBeenCalledWith(input);
    expect(receipt.ownerDomain).toBe("ai-routing");
  });

  it("denies a manager even when the requested capability is valid", async () => {
    const service = new AdminCommandService(
      database,
      { isSystemAdministrator: async () => false },
      {},
    );
    await expect(
      service.execute({
        schemaVersion: 1,
        idempotencyKey: randomUUID(),
        actorId: managerId,
        capability: "SYSTEM_HEALTH_READ",
        expectedVersion: 1,
        reason: null,
        payload: {},
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_ACTION" });
  });

  it("requires a reason for sensitive route overrides", async () => {
    const service = new AdminCommandService(
      database,
      { isSystemAdministrator: async () => true },
      {},
    );
    await expect(
      service.execute({
        schemaVersion: 1,
        idempotencyKey: randomUUID(),
        actorId: administratorId,
        capability: "AI_ROUTES_MANAGE",
        expectedVersion: 1,
        reason: null,
        payload: {},
      }),
    ).rejects.toMatchObject({ code: "ADMIN_REASON_REQUIRED" });
  });

  it("never exposes evaluation or project reassignment authority", async () => {
    const service = new AdminCommandService(
      database,
      { isSystemAdministrator: async () => true },
      {},
    );
    await expect(service.evaluateEmployee()).rejects.toMatchObject({ code: "AUTHZ_ACTION" });
    await expect(service.reassignProject()).rejects.toMatchObject({ code: "AUTHZ_ACTION" });
  });
});
