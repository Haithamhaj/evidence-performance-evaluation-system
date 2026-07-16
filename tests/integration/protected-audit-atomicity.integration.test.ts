import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { syncOidcUser } from "../../packages/auth/src/index.js";
import { createDatabaseClient } from "../../packages/database/src/index.js";
import { appendAuditEvent, accessSensitiveContent } from "../../packages/audit/src/index.js";

import { seedPilotWithAudit } from "../../scripts/seed-pilot.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const observer = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
type TestAuditWriter<T> = import("../../packages/contracts/src/index.js").AuditWriter<T>;
type DatabaseTransaction = Parameters<Parameters<typeof client.$transaction>[0]>[0];

const databaseWriter: TestAuditWriter<DatabaseTransaction> = {
  append: appendAuditEvent,
};

beforeAll(async () => {
  await seedPilotWithAudit(
    client,
    { managerSubject: "pilot-manager", adminSubject: "system-admin" },
    databaseWriter,
  );
});

afterAll(async () => {
  await seedPilotWithAudit(
    client,
    { managerSubject: "pilot-manager", adminSubject: "system-admin" },
    databaseWriter,
  );
  await observer.$disconnect();
  await client.$disconnect();
});

describe("protected action audit atomicity", () => {
  it("commits identity synchronization and identity.synchronized together", async () => {
    const suffix = crypto.randomUUID();
    const principal = {
      oidcSubject: `employee-${suffix}`,
      email: `employee-${suffix}@example.invalid`,
      issuer: "https://identity.example/realms/evaluation",
    };

    const authenticated = await syncOidcUser(client, principal, databaseWriter, "Employee");
    await expect(
      client.auditEvent.count({
        where: { eventType: "identity.synchronized", effectiveSubjectId: authenticated.userId },
      }),
    ).resolves.toBe(1);
  });

  it("rolls identity synchronization back when its audit append fails", async () => {
    const suffix = crypto.randomUUID();
    const principal = {
      oidcSubject: `rollback-${suffix}`,
      email: `rollback-${suffix}@example.invalid`,
      issuer: "https://identity.example/realms/evaluation",
    };
    const failingWriter: TestAuditWriter<unknown> = {
      append: vi.fn().mockRejectedValue(new Error("audit unavailable")),
    };

    await expect(syncOidcUser(client, principal, failingWriter, "Employee")).rejects.toThrow(
      "audit unavailable",
    );
    await expect(client.user.findUnique({ where: { email: principal.email } })).resolves.toBeNull();
  });

  it("audits every newly returned pilot role change with the bootstrap service actor", async () => {
    const users = await client.user.findMany({
      where: { pilotKey: { in: ["pilot-manager", "system-admin"] } },
      select: { id: true },
    });
    await client.roleAssignment.deleteMany({
      where: { userId: { in: users.map(({ id }) => id) } },
    });

    const result = await seedPilotWithAudit(
      client,
      { managerSubject: "pilot-manager", adminSubject: "system-admin" },
      databaseWriter,
    );
    const events = await client.auditEvent.findMany({
      where: { id: { in: result.auditEventIds } },
      orderBy: { targetId: "asc" },
    });

    expect(result.roleChanges).toHaveLength(2);
    expect(events).toHaveLength(2);
    expect(
      events.every((event) => event.actorKind === "service" && event.actorId === "bootstrap"),
    ).toBe(true);
    expect(events.every((event) => event.eventType === "role.assignment.changed")).toBe(true);
  });

  it("rolls all seed role changes back when one role audit fails", async () => {
    const users = await client.user.findMany({
      where: { pilotKey: { in: ["pilot-manager", "system-admin"] } },
      select: { id: true },
    });
    await client.roleAssignment.deleteMany({
      where: { userId: { in: users.map(({ id }) => id) } },
    });
    let calls = 0;
    let firstAuditId = "";
    const failingWriter: TestAuditWriter<DatabaseTransaction> = {
      append: async (transaction, input) => {
        calls += 1;
        if (calls === 2) throw new Error("second audit failed");
        const event = await appendAuditEvent(transaction, input);
        firstAuditId = event.id;
        return event;
      },
    };

    await expect(
      seedPilotWithAudit(
        client,
        { managerSubject: "pilot-manager", adminSubject: "system-admin" },
        failingWriter,
      ),
    ).rejects.toThrow("second audit failed");
    await expect(
      client.roleAssignment.count({ where: { userId: { in: users.map(({ id }) => id) } } }),
    ).resolves.toBe(0);
    await expect(client.auditEvent.findUnique({ where: { id: firstAuditId } })).resolves.toBeNull();
  });

  it("requires a trimmed 3-500 character reason before loading future private content", async () => {
    const loader = vi.fn().mockResolvedValue("protected");
    const writer: TestAuditWriter<unknown> = { append: vi.fn() };
    const authorize = vi.fn().mockResolvedValue(true);
    const transactionRunner = { $transaction: vi.fn() };

    await expect(
      accessSensitiveContent(
        transactionRunner,
        {
          visibilityMode: "manager_blinded",
          reason: "  ",
          actor: { kind: "human", id: crypto.randomUUID() },
          effectiveSubjectId: crypto.randomUUID(),
          scopeType: "cycle",
          scopeId: crypto.randomUUID(),
          targetType: "manager_feedback_response",
          targetId: crypto.randomUUID(),
          correlationId: crypto.randomUUID(),
          source: "api",
        },
        writer,
        authorize,
        loader,
      ),
    ).rejects.toThrow();
    expect(writer.append).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
    expect(transactionRunner.$transaction).not.toHaveBeenCalled();
    expect(loader).not.toHaveBeenCalled();
  });

  it.each(["ab", "a".repeat(501)])(
    "rejects an out-of-range private-access reason",
    async (reason) => {
      const loader = vi.fn().mockResolvedValue("protected");
      const writer: TestAuditWriter<unknown> = { append: vi.fn() };
      const authorize = vi.fn().mockResolvedValue(true);
      const transactionRunner = { $transaction: vi.fn() };

      await expect(
        accessSensitiveContent(
          transactionRunner,
          {
            visibilityMode: "manager_blinded",
            reason,
            actor: { kind: "human", id: crypto.randomUUID() },
            effectiveSubjectId: crypto.randomUUID(),
            scopeType: "cycle",
            scopeId: crypto.randomUUID(),
            targetType: "manager_feedback_response",
            targetId: crypto.randomUUID(),
            correlationId: crypto.randomUUID(),
            source: "api",
          },
          writer,
          authorize,
          loader,
        ),
      ).rejects.toThrow();
      expect(writer.append).not.toHaveBeenCalled();
      expect(authorize).not.toHaveBeenCalled();
      expect(transactionRunner.$transaction).not.toHaveBeenCalled();
      expect(loader).not.toHaveBeenCalled();
    },
  );

  it("loads allowed content only after sensitive.access.decision commits", async () => {
    const order: string[] = [];
    const request = {
      visibilityMode: "anonymous_aggregated" as const,
      reason: "  Governance investigation  ",
      actor: { kind: "human" as const, id: crypto.randomUUID() },
      effectiveSubjectId: crypto.randomUUID(),
      scopeType: "cycle" as const,
      scopeId: crypto.randomUUID(),
      targetType: "manager_feedback_response",
      targetId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: "api" as const,
    };
    const writer: TestAuditWriter<DatabaseTransaction> = {
      append: vi.fn(async (transaction, input) => {
        order.push(`audit:${input.eventType}:${input.reason}`);
        return appendAuditEvent(transaction, input);
      }),
    };
    const authorize = vi.fn(async (transaction: DatabaseTransaction) => {
      expect(transaction).toHaveProperty("auditEvent");
      order.push("authorize");
      return true;
    });
    const loader = vi.fn(async () => {
      await expect(
        observer.auditEvent.count({ where: { correlationId: request.correlationId } }),
      ).resolves.toBe(1);
      order.push("load");
      return "protected";
    });

    await expect(accessSensitiveContent(client, request, writer, authorize, loader)).resolves.toBe(
      "protected",
    );
    expect(order).toEqual([
      "authorize",
      "audit:sensitive.access.decision:Governance investigation",
      "load",
    ]);
  });

  it("never loads future private content when its audit transaction fails", async () => {
    const request = {
      visibilityMode: "anonymous_aggregated" as const,
      reason: "Governance investigation",
      actor: { kind: "human" as const, id: crypto.randomUUID() },
      effectiveSubjectId: crypto.randomUUID(),
      scopeType: "cycle" as const,
      scopeId: crypto.randomUUID(),
      targetType: "manager_feedback_response",
      targetId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: "api" as const,
    };

    const failedLoader = vi.fn();
    await expect(
      accessSensitiveContent(
        client,
        request,
        { append: vi.fn().mockRejectedValue(new Error("audit failed")) },
        vi.fn(async (transaction: DatabaseTransaction) => {
          expect(transaction).toHaveProperty("auditEvent");
          return true;
        }),
        failedLoader,
      ),
    ).rejects.toThrow("audit failed");
    expect(failedLoader).not.toHaveBeenCalled();
  });

  it("audits a denied future private-mode decision and never loads content", async () => {
    const request = {
      visibilityMode: "manager_blinded" as const,
      reason: "Investigating a protected record",
      actor: { kind: "human" as const, id: crypto.randomUUID() },
      effectiveSubjectId: crypto.randomUUID(),
      scopeType: "cycle" as const,
      scopeId: crypto.randomUUID(),
      targetType: "manager_feedback_response",
      targetId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      source: "api" as const,
    };
    const authorize = vi.fn(async (transaction: DatabaseTransaction) => {
      expect(transaction).toHaveProperty("auditEvent");
      return false;
    });
    const loader = vi.fn();

    await expect(
      accessSensitiveContent(client, request, databaseWriter, authorize, loader),
    ).rejects.toMatchObject({ code: "AUTHZ_SENSITIVE_ACCESS_DENIED", status: 403 });
    await expect(
      observer.auditEvent.findFirstOrThrow({ where: { correlationId: request.correlationId } }),
    ).resolves.toMatchObject({
      eventType: "sensitive.access.decision",
      reason: "Investigating a protected record",
      safeDiff: { visibilityMode: "manager_blinded", decision: "denied" },
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it("keeps Identified pilot access allowed without treating it as private access", async () => {
    const writer: TestAuditWriter<unknown> = { append: vi.fn() };
    const authorize = vi.fn();
    const transactionRunner = { $transaction: vi.fn() };
    const loader = vi.fn().mockResolvedValue("identified response");

    await expect(
      accessSensitiveContent(
        transactionRunner,
        { visibilityMode: "identified", targetId: crypto.randomUUID() },
        writer,
        authorize,
        loader,
      ),
    ).resolves.toBe("identified response");
    expect(writer.append).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
    expect(transactionRunner.$transaction).not.toHaveBeenCalled();
  });
});
