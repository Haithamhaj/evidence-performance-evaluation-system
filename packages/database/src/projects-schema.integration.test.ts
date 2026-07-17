import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

type DatabaseTransaction = import("./index.js").DatabaseTransaction;

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

type Graph = Readonly<{
  organizationId: string;
  departmentId: string;
  projectId: string;
  workstreamId: string;
  actorId: string;
  ownerAId: string;
  ownerBId: string;
}>;

async function seedGraph(transaction: DatabaseTransaction): Promise<Graph> {
  const suffix = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workstreamId = crypto.randomUUID();
  const actorId = crypto.randomUUID();
  const ownerAId = crypto.randomUUID();
  const ownerBId = crypto.randomUUID();

  await transaction.organization.create({
    data: { id: organizationId, key: `organization-${suffix}`, name: "Test Organization" },
  });
  await transaction.department.create({
    data: {
      id: departmentId,
      key: `department-${suffix}`,
      name: "Test Department",
      organizationId,
    },
  });
  await transaction.user.createMany({
    data: [
      { id: actorId, email: `actor-${suffix}@example.invalid`, displayName: "Actor" },
      { id: ownerAId, email: `owner-a-${suffix}@example.invalid`, displayName: "Owner A" },
      { id: ownerBId, email: `owner-b-${suffix}@example.invalid`, displayName: "Owner B" },
    ],
  });
  await transaction.authorizationScope.createMany({
    data: [
      {
        id: projectId,
        key: `project-${suffix}`,
        scopeType: "project",
        departmentId,
      },
      {
        id: workstreamId,
        key: `workstream-${suffix}`,
        scopeType: "workstream",
        departmentId,
      },
    ],
  });
  await transaction.$executeRaw`
    INSERT INTO "Project" (
      "id", "organizationId", "departmentId", "authorizationScopeId", "authorizationScopeType",
      "name", "description", "status", "version", "createdById", "createdAt", "updatedAt"
    ) VALUES (
      ${projectId}::uuid, ${organizationId}::uuid, ${departmentId}::uuid, ${projectId}::uuid, 'project',
      'Test Project', 'Constraint test project', 'active', 1, ${actorId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  await transaction.$executeRaw`
    INSERT INTO "Workstream" (
      "id", "projectId", "authorizationScopeId", "authorizationScopeType", "name", "description",
      "status", "version", "createdById", "createdAt", "updatedAt"
    ) VALUES (
      ${workstreamId}::uuid, ${projectId}::uuid, ${workstreamId}::uuid, 'workstream',
      'Test Workstream', 'Constraint test workstream', 'active', 1, ${actorId}::uuid,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;

  return {
    organizationId,
    departmentId,
    projectId,
    workstreamId,
    actorId,
    ownerAId,
    ownerBId,
  };
}

async function insertResponsibility(
  transaction: DatabaseTransaction,
  graph: Graph,
  input: Readonly<{
    employeeId: string;
    projectId?: string;
    workstreamId?: string;
    responsibilityType: "original" | "acting" | "permanent" | "contributor";
    startsAt: string;
    endsAt: string | null;
    managerDecision: "complete" | "incomplete" | "none";
    delegationType?: string | null;
  }>,
): Promise<string> {
  const id = crypto.randomUUID();
  const managerDecisionById = input.managerDecision === "none" ? null : graph.actorId;
  const managerDecisionAt = input.managerDecision === "complete" ? "2026-07-16T12:00:00Z" : null;
  const managerDecisionReason = input.managerDecision === "complete" ? "Approved" : null;

  await transaction.$executeRaw`
    INSERT INTO "ResponsibilityWindow" (
      "id", "employeeId", "projectId", "workstreamId", "responsibilityType", "startsAt", "endsAt",
      "reason", "managerDecisionById", "managerDecisionAt", "managerDecisionReason",
      "relatedHandoverReference", "delegationType", "createdById", "createdAt"
    ) VALUES (
      ${id}::uuid,
      ${input.employeeId}::uuid,
      ${input.projectId ?? null}::uuid,
      ${input.workstreamId ?? null}::uuid,
      ${input.responsibilityType}::"ResponsibilityType",
      ${input.startsAt}::timestamptz,
      ${input.endsAt}::timestamptz,
      'Constraint test',
      ${managerDecisionById}::uuid,
      ${managerDecisionAt}::timestamptz,
      ${managerDecisionReason},
      NULL,
      ${input.delegationType ?? null},
      ${graph.actorId}::uuid,
      CURRENT_TIMESTAMP
    )
  `;
  return id;
}

async function withGraph<T>(
  operation: (transaction: DatabaseTransaction, graph: Graph) => Promise<T>,
) {
  return client.$transaction(async (transaction) =>
    operation(transaction, await seedGraph(transaction)),
  );
}

function hasSqlState(error: unknown, expected: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("originalCode" in error && error.originalCode === expected) return true;
  if ("cause" in error && hasSqlState(error.cause, expected)) return true;
  if ("meta" in error && hasSqlState(error.meta, expected)) return true;
  return "driverAdapterError" in error && hasSqlState(error.driverAdapterError, expected);
}

afterAll(async () => client.$disconnect());

describe("project responsibility schema", () => {
  it("rejects overlapping project owners", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "original",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: null,
          managerDecision: "complete",
        });
        await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerBId,
          projectId: graph.projectId,
          responsibilityType: "permanent",
          startsAt: "2026-07-18T00:00:00Z",
          endsAt: null,
          managerDecision: "complete",
        });
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23P01"));
  });

  it("rejects overlapping workstream owners", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          workstreamId: graph.workstreamId,
          responsibilityType: "original",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: "2026-07-20T00:00:00Z",
          managerDecision: "complete",
        });
        await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerBId,
          workstreamId: graph.workstreamId,
          responsibilityType: "acting",
          startsAt: "2026-07-19T00:00:00Z",
          endsAt: "2026-07-21T00:00:00Z",
          managerDecision: "complete",
          delegationType: "approved_leave",
        });
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23P01"));
  });

  it("rejects zero-length and dual-scope windows", async () => {
    await expect(
      withGraph((transaction, graph) =>
        insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "contributor",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: "2026-07-17T00:00:00Z",
          managerDecision: "none",
        }),
      ),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
    await expect(
      withGraph((transaction, graph) =>
        insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          workstreamId: graph.workstreamId,
          responsibilityType: "contributor",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: null,
          managerDecision: "none",
        }),
      ),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
  });

  it("requires acting delegation and a finite end", async () => {
    await expect(
      withGraph((transaction, graph) =>
        insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "acting",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: "2026-07-18T00:00:00Z",
          managerDecision: "complete",
        }),
      ),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
    await expect(
      withGraph((transaction, graph) =>
        insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "acting",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: null,
          managerDecision: "complete",
          delegationType: "approved_leave",
        }),
      ),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
  });

  it("requires the complete manager-decision triad for owners", async () => {
    await expect(
      withGraph((transaction, graph) =>
        insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "original",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: null,
          managerDecision: "incomplete",
        }),
      ),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
  });

  it("allows overlapping contributor windows", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        const first = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "contributor",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: null,
          managerDecision: "none",
        });
        const second = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerBId,
          projectId: graph.projectId,
          responsibilityType: "contributor",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: null,
          managerDecision: "none",
        });
        return [first, second];
      }),
    ).resolves.toHaveLength(2);
  });

  it("rejects invalid project and workstream membership ranges", async () => {
    await expect(
      withGraph(
        (transaction, graph) => transaction.$executeRaw`
        INSERT INTO "ProjectMember" (
          "id", "projectId", "employeeId", "startsAt", "endsAt", "reason", "createdById", "createdAt"
        ) VALUES (
          ${crypto.randomUUID()}::uuid, ${graph.projectId}::uuid, ${graph.ownerAId}::uuid,
          '2026-07-17T00:00:00Z', '2026-07-17T00:00:00Z', 'Invalid range',
          ${graph.actorId}::uuid, CURRENT_TIMESTAMP
        )
      `,
      ),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
    await expect(
      withGraph(
        (transaction, graph) => transaction.$executeRaw`
        INSERT INTO "WorkstreamMember" (
          "id", "workstreamId", "employeeId", "startsAt", "endsAt", "reason", "createdById", "createdAt"
        ) VALUES (
          ${crypto.randomUUID()}::uuid, ${graph.workstreamId}::uuid, ${graph.ownerAId}::uuid,
          '2026-07-18T00:00:00Z', '2026-07-17T00:00:00Z', 'Invalid range',
          ${graph.actorId}::uuid, CURRENT_TIMESTAMP
        )
      `,
      ),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
  });

  it("requires literal project and workstream authorization-scope types", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        const scopeId = crypto.randomUUID();
        await transaction.authorizationScope.create({
          data: {
            id: scopeId,
            key: `wrong-project-scope-${crypto.randomUUID()}`,
            scopeType: "department",
            departmentId: graph.departmentId,
          },
        });
        await transaction.$executeRaw`
          INSERT INTO "Project" (
            "id", "organizationId", "departmentId", "authorizationScopeId", "authorizationScopeType",
            "name", "description", "status", "version", "createdById", "createdAt", "updatedAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid, ${graph.organizationId}::uuid, ${graph.departmentId}::uuid,
            ${scopeId}::uuid, 'department', 'Invalid project', 'Wrong scope type', 'draft', 1,
            ${graph.actorId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));

    await expect(
      withGraph(async (transaction, graph) => {
        const scopeId = crypto.randomUUID();
        await transaction.authorizationScope.create({
          data: {
            id: scopeId,
            key: `wrong-workstream-scope-${crypto.randomUUID()}`,
            scopeType: "project",
            departmentId: graph.departmentId,
          },
        });
        await transaction.$executeRaw`
          INSERT INTO "Workstream" (
            "id", "projectId", "authorizationScopeId", "authorizationScopeType", "name", "description",
            "status", "version", "createdById", "createdAt", "updatedAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid, ${graph.projectId}::uuid, ${scopeId}::uuid, 'project',
            'Invalid workstream', 'Wrong scope type', 'draft', 1, ${graph.actorId}::uuid,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
  });

  it("prevents a linked authorization scope from moving departments", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        const otherDepartment = await transaction.department.create({
          data: {
            id: crypto.randomUUID(),
            key: `other-department-${crypto.randomUUID()}`,
            name: "Other Department",
            organizationId: graph.organizationId,
          },
        });
        await transaction.authorizationScope.update({
          where: { id: graph.workstreamId },
          data: { departmentId: otherDepartment.id },
        });
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "55000"));
  });

  it("allows adjacent owners at the same boundary instant", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        const original = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "original",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: "2026-07-18T00:00:00Z",
          managerDecision: "complete",
        });
        const permanent = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerBId,
          projectId: graph.projectId,
          responsibilityType: "permanent",
          startsAt: "2026-07-18T00:00:00Z",
          endsAt: null,
          managerDecision: "complete",
        });
        return [original, permanent];
      }),
    ).resolves.toHaveLength(2);
  });

  it("rejects duplicate overlapping membership with exclusion SQLSTATE", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        for (const startsAt of ["2026-07-17T00:00:00Z", "2026-07-18T00:00:00Z"]) {
          await transaction.$executeRaw`
            INSERT INTO "ProjectMember" (
              "id", "projectId", "employeeId", "startsAt", "endsAt", "reason", "createdById", "createdAt"
            ) VALUES (
              ${crypto.randomUUID()}::uuid, ${graph.projectId}::uuid, ${graph.ownerAId}::uuid,
              ${startsAt}::timestamptz, NULL, 'Membership', ${graph.actorId}::uuid, CURRENT_TIMESTAMP
            )
          `;
        }
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23P01"));
  });

  it("protects append-only status history from mutation", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        const transitionId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ProjectStatusTransition" (
            "id", "projectId", "fromStatus", "toStatus", "effectiveAt", "actorId",
            "reason", "resultingVersion", "createdAt"
          ) VALUES (
            ${transitionId}::uuid, ${graph.projectId}::uuid, 'draft', 'active', CURRENT_TIMESTAMP,
            ${graph.actorId}::uuid, 'Activation', 1, CURRENT_TIMESTAMP
          )
        `;
        await transaction.$executeRaw`
          UPDATE "ProjectStatusTransition" SET "reason" = 'Rewritten' WHERE "id" = ${transitionId}::uuid
        `;
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "55000"));
  });

  it("allows one period close and rejects rewriting the closed row", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        const membershipId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ProjectMember" (
            "id", "projectId", "employeeId", "startsAt", "endsAt", "reason", "createdById", "createdAt"
          ) VALUES (
            ${membershipId}::uuid, ${graph.projectId}::uuid, ${graph.ownerAId}::uuid,
            '2026-07-17T00:00:00Z', NULL, 'Membership', ${graph.actorId}::uuid, CURRENT_TIMESTAMP
          )
        `;
        await transaction.$executeRaw`
          UPDATE "ProjectMember" SET "endsAt" = '2026-07-18T00:00:00Z' WHERE "id" = ${membershipId}::uuid
        `;
        await transaction.$executeRaw`
          UPDATE "ProjectMember" SET "endsAt" = '2026-07-19T00:00:00Z' WHERE "id" = ${membershipId}::uuid
        `;
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "55000"));
  });

  it("accepts a contiguous acting transfer with the prior owner's return window", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        const closedWindowId = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "original",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: "2026-07-18T00:00:00Z",
          managerDecision: "complete",
        });
        const newOwnerWindowId = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerBId,
          projectId: graph.projectId,
          responsibilityType: "acting",
          startsAt: "2026-07-18T00:00:00Z",
          endsAt: "2026-07-19T00:00:00Z",
          managerDecision: "complete",
          delegationType: "approved_leave",
        });
        const returnWindowId = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "permanent",
          startsAt: "2026-07-19T00:00:00Z",
          endsAt: null,
          managerDecision: "complete",
        });
        const transferId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "OwnershipTransfer" (
            "id", "projectId", "workstreamId", "transferKind", "closedWindowId", "newOwnerWindowId",
            "returnWindowId", "effectiveAt", "reason", "managerDecisionById", "managerDecisionAt",
            "managerDecisionReason", "createdAt"
          ) VALUES (
            ${transferId}::uuid, ${graph.projectId}::uuid, NULL, 'acting', ${closedWindowId}::uuid,
            ${newOwnerWindowId}::uuid, ${returnWindowId}::uuid, '2026-07-18T00:00:00Z',
            'Approved coverage', ${graph.actorId}::uuid, '2026-07-16T12:00:00Z', 'Approved', CURRENT_TIMESTAMP
          )
        `;
        return transferId;
      }),
    ).resolves.toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("rejects an acting transfer from an existing acting-owner window", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        const closedWindowId = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "acting",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: "2026-07-18T00:00:00Z",
          managerDecision: "complete",
          delegationType: "approved_leave",
        });
        const newOwnerWindowId = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerBId,
          projectId: graph.projectId,
          responsibilityType: "acting",
          startsAt: "2026-07-18T00:00:00Z",
          endsAt: "2026-07-19T00:00:00Z",
          managerDecision: "complete",
          delegationType: "approved_leave",
        });
        const returnWindowId = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "permanent",
          startsAt: "2026-07-19T00:00:00Z",
          endsAt: null,
          managerDecision: "complete",
        });
        await transaction.$executeRaw`
          INSERT INTO "OwnershipTransfer" (
            "id", "projectId", "workstreamId", "transferKind", "closedWindowId", "newOwnerWindowId",
            "returnWindowId", "effectiveAt", "reason", "managerDecisionById", "managerDecisionAt",
            "managerDecisionReason", "createdAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid, ${graph.projectId}::uuid, NULL, 'acting',
            ${closedWindowId}::uuid, ${newOwnerWindowId}::uuid, ${returnWindowId}::uuid,
            '2026-07-18T00:00:00Z', 'Nested acting coverage', ${graph.actorId}::uuid,
            '2026-07-16T12:00:00Z', 'Approved', CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
  });

  it("rejects transfer links whose windows belong to another scope", async () => {
    await expect(
      withGraph(async (transaction, graph) => {
        const closedWindowId = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerAId,
          projectId: graph.projectId,
          responsibilityType: "original",
          startsAt: "2026-07-17T00:00:00Z",
          endsAt: "2026-07-18T00:00:00Z",
          managerDecision: "complete",
        });
        const wrongScopeWindowId = await insertResponsibility(transaction, graph, {
          employeeId: graph.ownerBId,
          workstreamId: graph.workstreamId,
          responsibilityType: "permanent",
          startsAt: "2026-07-18T00:00:00Z",
          endsAt: null,
          managerDecision: "complete",
        });
        await transaction.$executeRaw`
          INSERT INTO "OwnershipTransfer" (
            "id", "projectId", "workstreamId", "transferKind", "closedWindowId", "newOwnerWindowId",
            "returnWindowId", "effectiveAt", "reason", "managerDecisionById", "managerDecisionAt",
            "managerDecisionReason", "createdAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid, ${graph.projectId}::uuid, NULL, 'permanent',
            ${closedWindowId}::uuid, ${wrongScopeWindowId}::uuid, NULL, '2026-07-18T00:00:00Z',
            'Invalid transfer', ${graph.actorId}::uuid, '2026-07-16T12:00:00Z', 'Approved', CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toSatisfy((error: unknown) => hasSqlState(error, "23514"));
  });

  it("restricts deletion of users referenced by project history", async () => {
    await expect(
      withGraph((transaction, graph) => transaction.user.delete({ where: { id: graph.actorId } })),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
