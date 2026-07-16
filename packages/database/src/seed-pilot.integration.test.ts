import { afterAll, describe, expect, it } from "vitest";

import { PILOT_SEED_ISSUER, createDatabaseClient, seedPilot, withTransaction } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const stableSubjects = {
  managerSubject: "pilot-manager",
  adminSubject: "system-admin",
} as const;

async function expectSeedRejected(
  subjects: Parameters<typeof seedPilot>[1],
  expectedMessage: string,
): Promise<void> {
  await expect(
    withTransaction(client, async (transaction) => {
      await seedPilot(transaction, subjects);
      throw new Error("Seed accepted a protected pilot identity collision");
    }),
  ).rejects.toThrow(expectedMessage);
}

afterAll(async () => client.$disconnect());

describe("pilot organization seed", () => {
  it("seeds LeapAI twice without duplicates and separates manager from administrator", async () => {
    await withTransaction(client, (transaction) => seedPilot(transaction, stableSubjects));
    await withTransaction(client, (transaction) => seedPilot(transaction, stableSubjects));

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
    expect(manager.user.pilotKey).toBe("pilot-manager");
    expect(administrator.user.pilotKey).toBe("system-admin");
    expect(manager.user.roleAssignments.map(({ role }) => role)).toEqual(["manager"]);
    expect(administrator.user.roleAssignments.map(({ role }) => role)).toEqual([
      "system_administrator",
    ]);
  });

  it("keeps a persisted pilot user key immutable", async () => {
    await withTransaction(client, (transaction) => seedPilot(transaction, stableSubjects));
    const manager = await client.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } });

    await expect(
      client.user.update({ where: { id: manager.id }, data: { pilotKey: null } }),
    ).rejects.toBeDefined();
    await expect(
      client.user.findUniqueOrThrow({ where: { id: manager.id } }),
    ).resolves.toMatchObject({ pilotKey: "pilot-manager" });
  });

  it("rejects swapped pilot subjects and leaves the original separation intact", async () => {
    await withTransaction(client, (transaction) => seedPilot(transaction, stableSubjects));

    await expectSeedRejected(
      { managerSubject: stableSubjects.adminSubject, adminSubject: stableSubjects.managerSubject },
      "OIDC identity is already assigned to another user",
    );

    const assignments = await client.roleAssignment.findMany({
      where: {
        user: { email: { in: ["pilot-manager@seed.invalid", "system-admin@seed.invalid"] } },
      },
      orderBy: { role: "asc" },
      select: { role: true, user: { select: { email: true } } },
    });
    expect(assignments).toEqual([
      { role: "manager", user: { email: "pilot-manager@seed.invalid" } },
      { role: "system_administrator", user: { email: "system-admin@seed.invalid" } },
    ]);
  });

  it("rejects an OIDC identity already linked to a non-pilot user without granting a role", async () => {
    const suffix = crypto.randomUUID();
    const subject = `identity-collision-${suffix}`;
    const existingUser = await client.user.create({
      data: {
        displayName: "Existing User",
        email: `existing-${suffix}@example.invalid`,
        identities: { create: { issuer: PILOT_SEED_ISSUER, subject } },
      },
    });

    try {
      await expectSeedRejected(
        { managerSubject: subject, adminSubject: `admin-${suffix}` },
        "OIDC identity is already assigned to another user",
      );
      await expect(
        client.roleAssignment.count({ where: { userId: existingUser.id } }),
      ).resolves.toBe(0);
    } finally {
      await client.oidcIdentity.deleteMany({ where: { userId: existingUser.id } });
      await client.user.delete({ where: { id: existingUser.id } });
    }
  });

  it("rejects a protected pilot user that already has the opposite pilot role", async () => {
    await withTransaction(client, (transaction) => seedPilot(transaction, stableSubjects));
    const manager = await client.user.findUniqueOrThrow({
      where: { pilotKey: "pilot-manager" },
    });
    const systemScope = await client.authorizationScope.findUniqueOrThrow({
      where: { key: "system" },
    });

    await expect(
      withTransaction(client, async (transaction) => {
        await transaction.roleAssignment.create({
          data: {
            userId: manager.id,
            role: "system_administrator",
            scopeType: "system",
            scopeId: systemScope.id,
          },
        });
        await seedPilot(transaction, stableSubjects);
        throw new Error("Seed accepted the opposite protected pilot role");
      }),
    ).rejects.toThrow("Pilot user has the opposite protected pilot role");
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
        scopeType: "system",
      }),
    ]);
    expect(returnedChanges.every(({ scopeId }) => /^[0-9a-f-]{36}$/u.test(scopeId))).toBe(true);
    const persistedScopes = await client.authorizationScope.findMany({
      where: { id: { in: returnedChanges.map(({ scopeId }) => scopeId) } },
      orderBy: { scopeType: "asc" },
      select: { department: { select: { key: true } }, id: true, key: true, scopeType: true },
    });
    expect(persistedScopes).toEqual([
      { department: null, id: expect.any(String), key: "system", scopeType: "system" },
      {
        department: { key: "ai-department" },
        id: expect.any(String),
        key: "department:ai-department",
        scopeType: "department",
      },
    ]);
    await expect(
      client.oidcIdentity.count({
        where: { issuer: PILOT_SEED_ISSUER, subject: { in: [managerSubject, adminSubject] } },
      }),
    ).resolves.toBe(0);
  });

  it("rejects mismatched and orphaned role-assignment scopes", async () => {
    await withTransaction(client, (transaction) => seedPilot(transaction, stableSubjects));
    const manager = await client.user.findUniqueOrThrow({
      where: { pilotKey: "pilot-manager" },
      include: { roleAssignments: true },
    });
    const managerScopeId = manager.roleAssignments.find(({ role }) => role === "manager")?.scopeId;
    expect(managerScopeId).toBeDefined();

    await expect(
      withTransaction(client, async (transaction) => {
        await transaction.roleAssignment.create({
          data: {
            userId: manager.id,
            role: "contributor",
            scopeType: "system",
            scopeId: managerScopeId!,
          },
        });
        throw new Error("Scope type mismatch was accepted");
      }),
    ).rejects.toMatchObject({ code: "P2003" });

    await expect(
      withTransaction(client, async (transaction) => {
        await transaction.roleAssignment.create({
          data: {
            userId: manager.id,
            role: "contributor",
            scopeType: "department",
            scopeId: crypto.randomUUID(),
          },
        });
        throw new Error("Orphan scope was accepted");
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
