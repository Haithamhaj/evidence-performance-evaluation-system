import { afterAll, describe, expect, it } from "vitest";

import { PILOT_SEED_ISSUER, createDatabaseClient, seedPilot, withTransaction } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => client.$disconnect());

describe("pilot organization seed", () => {
  it("seeds LeapAI twice without duplicates and separates manager from administrator", async () => {
    const subjects = {
      managerSubject: "pilot-manager",
      adminSubject: "system-admin",
    } as const;

    await withTransaction(client, (transaction) => seedPilot(transaction, subjects));
    await withTransaction(client, (transaction) => seedPilot(transaction, subjects));

    expect(await client.organization.count({ where: { key: "leapai" } })).toBe(1);
    expect(await client.department.count({ where: { key: "ai-department" } })).toBe(1);

    const manager = await client.oidcIdentity.findFirstOrThrow({
      where: { issuer: PILOT_SEED_ISSUER, subject: "pilot-manager" },
      include: { user: { include: { roleAssignments: true } } },
    });
    const administrator = await client.oidcIdentity.findFirstOrThrow({
      where: { issuer: PILOT_SEED_ISSUER, subject: "system-admin" },
      include: { user: { include: { roleAssignments: true } } },
    });

    expect(manager.user.id).not.toBe(administrator.user.id);
    expect(manager.user.roleAssignments.map(({ role }) => role)).toEqual(["manager"]);
    expect(administrator.user.roleAssignments.map(({ role }) => role)).toEqual([
      "system_administrator",
    ]);
  });

  it("refuses to assign manager and administrator roles to the same OIDC subject", async () => {
    const organizationCount = await client.organization.count({ where: { key: "leapai" } });

    await expect(
      withTransaction(client, (transaction) =>
        seedPilot(transaction, {
          managerSubject: "same-pilot-user",
          adminSubject: "same-pilot-user",
        }),
      ),
    ).rejects.toThrow("Pilot manager and system administrator subjects must be distinct");

    await expect(client.organization.count({ where: { key: "leapai" } })).resolves.toBe(
      organizationCount,
    );
  });

  it("returns role changes while leaving commit and rollback control with the caller", async () => {
    const suffix = crypto.randomUUID();
    const managerSubject = `manager-${suffix}`;
    const adminSubject = `admin-${suffix}`;
    let returnedChanges: Awaited<ReturnType<typeof seedPilot>> = [];

    await withTransaction(client, (transaction) =>
      seedPilot(transaction, { managerSubject: "pilot-manager", adminSubject: "system-admin" }),
    );
    const seedUserIds = (
      await client.user.findMany({
        where: {
          email: { in: ["pilot-manager@seed.invalid", "system-admin@seed.invalid"] },
        },
        select: { id: true },
      })
    ).map(({ id }) => id);

    await expect(
      withTransaction(client, async (transaction) => {
        await transaction.roleAssignment.deleteMany({ where: { userId: { in: seedUserIds } } });
        returnedChanges = await seedPilot(transaction, { managerSubject, adminSubject });
        throw new Error("caller requested rollback");
      }),
    ).rejects.toThrow("caller requested rollback");

    expect(returnedChanges).toEqual([
      expect.objectContaining({ change: "created", role: "manager", scopeType: "department" }),
      expect.objectContaining({
        change: "created",
        role: "system_administrator",
        scopeId: "system",
        scopeType: "system",
      }),
    ]);
    await expect(
      client.oidcIdentity.count({
        where: { issuer: PILOT_SEED_ISSUER, subject: { in: [managerSubject, adminSubject] } },
      }),
    ).resolves.toBe(0);
  });
});
