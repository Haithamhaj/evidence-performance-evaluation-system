import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient, withTransaction } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => client.$disconnect());

describe("database foundation", () => {
  it("pins every database session to UTC", async () => {
    const rows = await client.$queryRaw<Array<{ TimeZone: string }>>`SHOW TIMEZONE`;

    expect(rows).toEqual([{ TimeZone: "UTC" }]);
  });

  it("uses PostgreSQL and persists UTC system metadata", async () => {
    const row = await client.systemMetadata.create({
      data: { key: `integration:${crypto.randomUUID()}`, value: "phase-0" },
    });

    expect(row.createdAt.toISOString()).toMatch(/Z$/);
  });

  it("rejects an empty connection string", () => {
    expect(() => createDatabaseClient("  ")).toThrow("Database connection string is required");
  });

  it("commits a typed transaction operation", async () => {
    const key = `transaction:commit:${crypto.randomUUID()}`;

    const createdKey = await withTransaction(client, async (transaction) => {
      const row = await transaction.systemMetadata.create({ data: { key, value: "committed" } });
      return row.key;
    });

    expect(createdKey).toBe(key);
    await expect(client.systemMetadata.findUnique({ where: { key } })).resolves.toMatchObject({
      value: "committed",
    });
  });

  it("rolls back a failed transaction operation", async () => {
    const key = `transaction:rollback:${crypto.randomUUID()}`;

    await expect(
      withTransaction(client, async (transaction) => {
        await transaction.systemMetadata.create({ data: { key, value: "rolled-back" } });
        throw new Error("rollback requested");
      }),
    ).rejects.toThrow("rollback requested");

    await expect(client.systemMetadata.findUnique({ where: { key } })).resolves.toBeNull();
  });
});
