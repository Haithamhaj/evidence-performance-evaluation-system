import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { PrismaUpdateScopeReader } from "./scope-readers.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-18T12:00:00.000Z");

afterAll(async () => client.$disconnect());

describe("PrismaUpdateScopeReader", () => {
  it("returns governed routing scopes only for a current member in the exact Project/Workstream", async () => {
    const graph = await seedGraph();
    const reader = new PrismaUpdateScopeReader();

    const allowed = await client.$transaction((transaction) =>
      reader.authorizeIn(transaction, {
        actor: { userId: graph.employeeId, active: true },
        projectId: graph.projectId,
        workstreamId: graph.workstreamId,
        workItemId: null,
        at: now,
      }),
    );
    expect(allowed).toMatchObject({
      organizationId: graph.organizationId,
      projectScopeId: graph.projectId,
      departmentScopeId: graph.departmentId,
      activeContract: null,
    });

    await expect(
      client.$transaction((transaction) =>
        reader.authorizeIn(transaction, {
          actor: { userId: graph.outsiderId, active: true },
          projectId: graph.projectId,
          workstreamId: graph.workstreamId,
          workItemId: null,
          at: now,
        }),
      ),
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH", status: 403 });

    await expect(
      client.$transaction((transaction) =>
        reader.authorizeIn(transaction, {
          actor: { userId: graph.employeeId, active: true },
          projectId: graph.projectId,
          workstreamId: graph.otherWorkstreamId,
          workItemId: null,
          at: now,
        }),
      ),
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH", status: 403 });
  });
});

async function seedGraph() {
  const suffix = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const employeeId = crypto.randomUUID();
  const outsiderId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workstreamId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();
  const otherWorkstreamId = crypto.randomUUID();
  await client.organization.create({
    data: { id: organizationId, key: `scope-org-${suffix}`, name: "Scope" },
  });
  await client.department.create({
    data: { id: departmentId, key: `scope-dept-${suffix}`, name: "Scope", organizationId },
  });
  await client.user.createMany({
    data: [
      { id: employeeId, email: `member-${suffix}@example.invalid`, displayName: "Member" },
      { id: outsiderId, email: `outsider-${suffix}@example.invalid`, displayName: "Outsider" },
    ],
  });
  await client.authorizationScope.createMany({
    data: [
      {
        id: departmentId,
        key: `scope-department-${suffix}`,
        scopeType: "department",
        departmentId,
      },
      { id: projectId, key: `scope-project-${suffix}`, scopeType: "project", departmentId },
      {
        id: otherProjectId,
        key: `scope-other-project-${suffix}`,
        scopeType: "project",
        departmentId,
      },
      {
        id: workstreamId,
        key: `scope-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId,
      },
      {
        id: otherWorkstreamId,
        key: `scope-other-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId,
      },
    ],
  });
  await client.project.createMany({
    data: [
      {
        id: projectId,
        organizationId,
        departmentId,
        authorizationScopeId: projectId,
        name: "Exact project",
        description: "",
        status: "active",
        createdById: employeeId,
      },
      {
        id: otherProjectId,
        organizationId,
        departmentId,
        authorizationScopeId: otherProjectId,
        name: "Other project",
        description: "",
        status: "active",
        createdById: employeeId,
      },
    ],
  });
  await client.workstream.createMany({
    data: [
      {
        id: workstreamId,
        projectId,
        authorizationScopeId: workstreamId,
        name: "Exact workstream",
        description: "",
        status: "active",
        createdById: employeeId,
      },
      {
        id: otherWorkstreamId,
        projectId: otherProjectId,
        authorizationScopeId: otherWorkstreamId,
        name: "Other workstream",
        description: "",
        status: "active",
        createdById: employeeId,
      },
    ],
  });
  await client.projectMember.create({
    data: {
      projectId,
      employeeId,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      reason: "Current contributor",
      createdById: employeeId,
    },
  });
  await client.workstreamMember.create({
    data: {
      workstreamId,
      employeeId,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      reason: "Current contributor",
      createdById: employeeId,
    },
  });
  return {
    organizationId,
    departmentId,
    employeeId,
    outsiderId,
    projectId,
    workstreamId,
    otherWorkstreamId,
  };
}
