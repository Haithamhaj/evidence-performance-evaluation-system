import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient, seedPilot, withTransaction } from "@evaluation/database";

import { AuditEventInputSchema, appendAuditEvent, queryAuditEvents } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
let organizationId: string;
let userId: string;

function eventInput(
  overrides: Partial<import("@evaluation/contracts").AuditEventInput> = {},
): import("@evaluation/contracts").AuditEventInput {
  return {
    eventType: "identity.synchronized",
    actor: { kind: "human", id: userId },
    effectiveSubjectId: userId,
    scopeType: "organization",
    scopeId: organizationId,
    targetType: "user",
    targetId: userId,
    correlationId: crypto.randomUUID(),
    source: "api",
    safeDiff: { fields: ["displayName"] },
    ...overrides,
  };
}

beforeAll(async () => {
  await withTransaction(client, (transaction) =>
    seedPilot(transaction, { managerSubject: "pilot-manager", adminSubject: "system-admin" }),
  );
  const [organization, user] = await Promise.all([
    client.organization.findUniqueOrThrow({ where: { key: "leapai" } }),
    client.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } }),
  ]);
  organizationId = organization.id;
  userId = user.id;
});

afterAll(async () => client.$disconnect());

describe("append-only audit persistence", () => {
  it("grants the application role only insert and select privileges", async () => {
    const privileges = await client.$queryRawUnsafe<
      Array<{ canDelete: boolean; canInsert: boolean; canSelect: boolean; canUpdate: boolean }>
    >(`
      SELECT
        has_table_privilege('evaluation_app', '"AuditEvent"', 'DELETE') AS "canDelete",
        has_table_privilege('evaluation_app', '"AuditEvent"', 'INSERT') AS "canInsert",
        has_table_privilege('evaluation_app', '"AuditEvent"', 'SELECT') AS "canSelect",
        has_table_privilege('evaluation_app', '"AuditEvent"', 'UPDATE') AS "canUpdate"
    `);
    expect(privileges).toEqual([
      { canDelete: false, canInsert: true, canSelect: true, canUpdate: false },
    ]);
  });

  it("allows insert and rejects update and delete", async () => {
    const event = await appendAuditEvent(client, eventInput());

    await expect(
      client.auditEvent.update({ where: { id: event.id }, data: { eventType: "changed.event" } }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "55000" }) });
    await expect(client.auditEvent.delete({ where: { id: event.id } })).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "55000" }),
    });
  });

  it("strictly validates version-ready inputs before persistence", async () => {
    expect(() => AuditEventInputSchema.parse({ ...eventInput(), unexpected: true })).toThrow();
    expect(() =>
      AuditEventInputSchema.parse(eventInput({ eventType: "IdentitySynchronized" })),
    ).toThrow();
    expect(() =>
      AuditEventInputSchema.parse({ ...eventInput(), actor: { kind: "service", id: "other" } }),
    ).toThrow();
  });

  it.each([
    { token: "value" },
    { nested: { secretValue: "value" } },
    { nested: [{ Password: "value" }] },
    { prompt: "value" },
    { rawContent: "value" },
    { privateFeedback: "value" },
    { authorization: "value" },
  ])("rejects unsafe safeDiff keys at any depth", async (safeDiff) => {
    await expect(appendAuditEvent(client, eventInput({ safeDiff }))).rejects.toThrow(
      "Audit safeDiff contains a forbidden field",
    );
  });

  it("rejects non-plain safeDiff objects before persistence", async () => {
    class HiddenUnsafeValue {
      toJSON() {
        return { authorization: "Bearer reviewer-secret" };
      }
    }
    const create = vi.fn();

    await expect(
      appendAuditEvent(
        { auditEvent: { create } },
        eventInput({
          safeDiff: { nested: new HiddenUnsafeValue() } as Record<string, unknown>,
        }),
      ),
    ).rejects.toThrow("Audit safeDiff must contain plain JSON objects only");
    expect(create).not.toHaveBeenCalled();
  });

  it.each([new Date(), new Map([["authorization", "Bearer reviewer-secret"]])])(
    "rejects other non-JSON safeDiff object types before persistence",
    async (nested) => {
      const create = vi.fn();

      await expect(
        appendAuditEvent(
          { auditEvent: { create } },
          eventInput({ safeDiff: { nested } as Record<string, unknown> }),
        ),
      ).rejects.toThrow("Audit safeDiff must contain plain JSON objects only");
      expect(create).not.toHaveBeenCalled();
    },
  );

  it("queries sanitized pages with stable UTC cursors and filters", async () => {
    const correlationId = crypto.randomUUID();
    await appendAuditEvent(client, eventInput({ correlationId, reason: "Administrative review" }));
    await appendAuditEvent(client, eventInput({ correlationId, reason: "Administrative review" }));

    const page = await queryAuditEvents(client, {
      correlationId,
      eventType: "identity.synchronized",
      actorKind: "human",
      actorId: userId,
      scopeType: "organization",
      scopeId: organizationId,
      targetType: "user",
      targetId: userId,
      limit: 1,
      utcFrom: "2026-01-01T00:00:00.000Z",
      utcTo: "2027-01-01T00:00:00.000Z",
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      actor: { kind: "human", id: userId },
      correlationId,
      reason: "Administrative review",
    });
    expect(page.items[0]).not.toHaveProperty("privateFeedback");
    expect(page.nextCursor).toEqual(expect.any(String));

    const nextPage = await queryAuditEvents(client, {
      correlationId,
      cursor: page.nextCursor,
      limit: 1,
    });
    expect(nextPage.items).toHaveLength(1);
    expect(nextPage.items[0]?.id).not.toBe(page.items[0]?.id);
    expect(nextPage.nextCursor).toBeNull();
  });
});
