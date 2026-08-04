import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DocumentResourceReader } from "./document-resource-reader.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
let projectId: string;
let workstreamId: string;
let organizationId: string;
let departmentId: string;

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const actor = await client.user.create({
    data: { email: `document-reader-${suffix}@example.invalid`, displayName: "Reader Actor" },
  });
  const organization = await client.organization.create({
    data: { key: `document-reader-org-${suffix}`, name: "Reader Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `document-reader-department-${suffix}`,
      name: "Reader Department",
      organizationId: organization.id,
    },
  });
  projectId = crypto.randomUUID();
  workstreamId = crypto.randomUUID();
  organizationId = organization.id;
  departmentId = department.id;
  await client.authorizationScope.createMany({
    data: [
      {
        id: projectId,
        key: `document-reader-project-${suffix}`,
        scopeType: "project",
        departmentId,
      },
      {
        id: workstreamId,
        key: `document-reader-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId,
      },
    ],
  });
  await client.project.create({
    data: {
      id: projectId,
      organizationId,
      departmentId,
      authorizationScopeId: projectId,
      authorizationScopeType: "project",
      name: "Reader Project",
      description: "Read-only boundary fixture",
      status: "active",
      createdById: actor.id,
    },
  });
  await client.workstream.create({
    data: {
      id: workstreamId,
      projectId,
      authorizationScopeId: workstreamId,
      authorizationScopeType: "workstream",
      name: "Reader Workstream",
      description: "Read-only child fixture",
      status: "paused",
      createdById: actor.id,
    },
  });
});

afterAll(async () => client.$disconnect());

describe("DocumentResourceReader", () => {
  it("returns only project identity and lifecycle fields", async () => {
    const reader = new DocumentResourceReader(client);
    await expect(reader.read({ kind: "project", resourceId: projectId })).resolves.toEqual({
      kind: "project",
      resourceId: projectId,
      projectId,
      organizationId,
      departmentId,
      status: "active",
    });
  });

  it("returns the parent identity for a workstream", async () => {
    const reader = new DocumentResourceReader(client);
    await expect(reader.read({ kind: "workstream", resourceId: workstreamId })).resolves.toEqual({
      kind: "workstream",
      resourceId: workstreamId,
      projectId,
      organizationId,
      departmentId,
      status: "paused",
    });
  });

  it("returns null rather than leaking a missing resource", async () => {
    const reader = new DocumentResourceReader(client);
    await expect(
      reader.read({ kind: "project", resourceId: crypto.randomUUID() }),
    ).resolves.toBeNull();
  });
});
