import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ResearchProjectContextReader } from "./research-project-context-reader.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const at = new Date("2026-08-05T09:00:00.000Z");

const ids = {
  owner: crypto.randomUUID(),
  contributor: crypto.randomUUID(),
  workstreamContributor: crypto.randomUUID(),
  assignedManager: crypto.randomUUID(),
  unrelatedManager: crypto.randomUUID(),
  administrator: crypto.randomUUID(),
  inactive: crypto.randomUUID(),
  project: crypto.randomUUID(),
  workstream: crypto.randomUUID(),
  otherWorkstream: crypto.randomUUID(),
  otherProject: crypto.randomUUID(),
  crossProjectItem: crypto.randomUUID(),
};

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `research-context-${suffix}`, name: "Research Context" },
  });
  const [department, otherDepartment] = await Promise.all([
    client.department.create({
      data: {
        key: `research-context-department-${suffix}`,
        name: "Research Context",
        organizationId: organization.id,
      },
    }),
    client.department.create({
      data: {
        key: `research-context-other-department-${suffix}`,
        name: "Other Research Context",
        organizationId: organization.id,
      },
    }),
  ]);
  const systemScopeId = crypto.randomUUID();
  await client.user.createMany({
    data: Object.entries({
      owner: ids.owner,
      contributor: ids.contributor,
      workstreamContributor: ids.workstreamContributor,
      assignedManager: ids.assignedManager,
      unrelatedManager: ids.unrelatedManager,
      administrator: ids.administrator,
      inactive: ids.inactive,
    }).map(([label, id]) => ({
      id,
      email: `research-context-${label}-${suffix}@example.invalid`,
      displayName: label,
      active: label !== "inactive",
    })),
  });
  const otherProjectScopeId = crypto.randomUUID();
  await client.authorizationScope.createMany({
    data: [
      {
        id: systemScopeId,
        key: `research-context-system-${suffix}`,
        scopeType: "system",
      },
      {
        id: department.id,
        key: `research-context-department-scope-${suffix}`,
        scopeType: "department",
        departmentId: department.id,
      },
      {
        id: otherDepartment.id,
        key: `research-context-other-department-scope-${suffix}`,
        scopeType: "department",
        departmentId: otherDepartment.id,
      },
      {
        id: ids.project,
        key: `research-context-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: ids.workstream,
        key: `research-context-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
      {
        id: ids.otherWorkstream,
        key: `research-context-other-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
      {
        id: otherProjectScopeId,
        key: `research-context-other-project-${suffix}`,
        scopeType: "project",
        departmentId: otherDepartment.id,
      },
    ],
  });
  await client.project.createMany({
    data: [
      {
        id: ids.project,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: ids.project,
        name: "Project Aurora",
        description: "Ship a source-supported research workflow.",
        status: "active",
        createdById: ids.owner,
      },
      {
        id: ids.otherProject,
        organizationId: organization.id,
        departmentId: otherDepartment.id,
        authorizationScopeId: otherProjectScopeId,
        name: "Other Project",
        description: "Out of scope",
        status: "active",
        createdById: ids.owner,
      },
    ],
  });
  await client.workstream.createMany({
    data: [
      {
        id: ids.workstream,
        projectId: ids.project,
        authorizationScopeId: ids.workstream,
        name: "Research engine",
        description: "Authorized workstream",
        status: "active",
        createdById: ids.owner,
      },
      {
        id: ids.otherWorkstream,
        projectId: ids.project,
        authorizationScopeId: ids.otherWorkstream,
        name: "Project-wide operations",
        description: "Visible to current Project contributors",
        status: "active",
        createdById: ids.owner,
      },
    ],
  });
  await client.projectMember.createMany({
    data: [ids.owner, ids.contributor].map((employeeId) => ({
      projectId: ids.project,
      employeeId,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      reason: "Current Project participant",
      createdById: ids.owner,
    })),
  });
  await client.workstreamMember.create({
    data: {
      workstreamId: ids.workstream,
      employeeId: ids.workstreamContributor,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      reason: "Current Workstream participant",
      createdById: ids.owner,
    },
  });
  await client.responsibilityWindow.createMany({
    data: [
      {
        employeeId: ids.owner,
        projectId: ids.project,
        responsibilityType: "original",
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        reason: "Project owner",
        managerDecisionById: ids.assignedManager,
        managerDecisionAt: new Date("2026-08-01T00:00:00.000Z"),
        managerDecisionReason: "Assigned owner",
        createdById: ids.assignedManager,
      },
      {
        employeeId: ids.workstreamContributor,
        workstreamId: ids.workstream,
        responsibilityType: "contributor",
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        reason: "Workstream contribution",
        createdById: ids.owner,
      },
    ],
  });
  await client.roleAssignment.createMany({
    data: [
      {
        userId: ids.assignedManager,
        role: "manager",
        scopeType: "department",
        scopeId: department.id,
      },
      {
        userId: ids.unrelatedManager,
        role: "manager",
        scopeType: "department",
        scopeId: otherDepartment.id,
      },
      {
        userId: ids.administrator,
        role: "system_administrator",
        scopeType: "system",
        scopeId: systemScopeId,
      },
    ],
  });
});

afterAll(async () => client.$disconnect());

const workItems = {
  async authorizeProjectItem(input: { projectId: string; workItemId: string }) {
    if (input.workItemId !== ids.crossProjectItem) {
      throw new AppError("RESEARCH_SCOPE_FORBIDDEN", "errors.research.scopeForbidden", 403);
    }
    return {
      id: input.workItemId,
      projectId: ids.otherProject,
      workstreamId: null,
      title: "Cross-Project item",
      description: "Must not authorize",
      status: "planned" as const,
      version: 1,
      sourceReference: `work-item:${input.workItemId}`,
    };
  },
};

describe("ResearchProjectContextReader", () => {
  const reader = new ResearchProjectContextReader(client, workItems);

  it.each([
    ["Project owner", ids.owner, null],
    ["current Project contributor", ids.contributor, null],
    ["current Workstream contributor", ids.workstreamContributor, ids.workstream],
    ["assigned manager", ids.assignedManager, null],
  ])("authorizes %s at the exact current scope", async (_label, userId, workstreamId) => {
    await expect(
      reader.authorize({
        actor: { userId, active: true },
        scope: { projectId: ids.project, workstreamId, workItemId: null },
        at,
      }),
    ).resolves.toMatchObject({
      actorId: userId,
      projectId: ids.project,
      workstreamId,
      workItemId: null,
    });
  });

  it.each([
    ["unrelated manager", ids.unrelatedManager, true],
    ["System Administrator", ids.administrator, true],
    ["inactive database user", ids.inactive, true],
    ["inactive actor claim", ids.owner, false],
  ])("denies an %s without leaking Project content", async (_label, userId, active) => {
    await expect(
      reader.readAuthorizedContext({ actor: { userId, active }, projectId: ids.project, at }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN", status: 403 });
  });

  it("rejects a Work Item whose owner-domain reference belongs to another Project", async () => {
    await expect(
      reader.authorize({
        actor: { userId: ids.owner, active: true },
        scope: {
          projectId: ids.project,
          workstreamId: null,
          workItemId: ids.crossProjectItem,
        },
        at,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN", status: 403 });
  });

  it("returns only authorized operational context and safe opaque references", async () => {
    const context = await reader.readAuthorizedContext({
      actor: { userId: ids.owner, active: true },
      projectId: ids.project,
      at,
    });

    expect(context).toMatchObject({
      projectId: ids.project,
      name: "Project Aurora",
      objective: "Ship a source-supported research workflow.",
      activeContract: null,
    });
    expect(context.workstreams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.workstream, name: "Research engine" }),
      ]),
    );
    expect(context.sourceReferences).toContain(`project:${ids.project}`);
    expect(JSON.stringify(context)).not.toMatch(/rating|readinessPercent|privateNarrative/iu);
  });

  it("lets a Workstream-only contributor read only their authorized Workstream context", async () => {
    const context = await reader.readAuthorizedContext({
      actor: { userId: ids.workstreamContributor, active: true },
      projectId: ids.project,
      at,
    });

    expect(context.workstreams).toEqual([
      expect.objectContaining({ id: ids.workstream, name: "Research engine" }),
    ]);
    expect(context.sourceReferences).toContain(`workstream:${ids.workstream}`);
  });

  it("lets a current Project contributor read all Project Workstreams", async () => {
    const context = await reader.readAuthorizedContext({
      actor: { userId: ids.contributor, active: true },
      projectId: ids.project,
      at,
    });

    expect(context.workstreams.map(({ id }) => id).sort()).toEqual(
      [ids.workstream, ids.otherWorkstream].sort(),
    );
  });

  it("retains exact measurable component and governed GitHub rule identity", async () => {
    const componentId = crypto.randomUUID();
    const ruleId = crypto.randomUUID();
    const bindingId = crypto.randomUUID();
    const contractId = crypto.randomUUID();
    const sourceDocumentVersionId = crypto.randomUUID();
    const fakeTransaction = {
      user: { findUnique: async () => ({ active: true }) },
      project: {
        findUnique: async () => ({
          id: ids.project,
          departmentId: crypto.randomUUID(),
          status: "active",
          members: [{ id: crypto.randomUUID() }],
          workstreams: [],
          name: "Project Aurora",
          description: "Ship a source-supported research workflow.",
        }),
      },
      roleAssignment: { findMany: async () => [] },
      responsibilityWindow: { findMany: async () => [] },
      workstream: { findMany: async () => [] },
      progressContract: {
        findFirst: async () => ({
          id: contractId,
          contractVersion: 3,
          calculationSchemaVersion: "1.0.0",
          effectiveAt: at,
          sourceDocumentVersionId,
          components: [
            {
              id: componentId,
              kind: "kpi",
              name: "Citation coverage",
              description: "Measure cited claims.",
              baseline: 0,
              target: 95,
              unit: "percent",
              direction: "increase",
              acceptanceConditions: ["At least 95%"],
              requiredEvidence: ["Cited report"],
              confirmationMode: "measured",
            },
          ],
          githubRules: [
            {
              id: ruleId,
              bindingId,
              componentId,
              sourceId: "check:research-context",
              eventKind: "check",
              acceptanceState: "success",
              effectiveAt: at,
              expiresAt: null,
            },
          ],
        }),
      },
      progressContractAiDraftRequest: { findMany: async () => [] },
    };
    const fakeDatabase = {
      $transaction: async (operation: (transaction: typeof fakeTransaction) => Promise<unknown>) =>
        operation(fakeTransaction),
    };
    const fakeReader = new ResearchProjectContextReader(fakeDatabase as never);

    const context = await fakeReader.readAuthorizedContext({
      actor: { userId: ids.owner, active: true },
      projectId: ids.project,
      at,
    });

    expect(context.activeContract?.components).toEqual([
      expect.objectContaining({
        id: componentId,
        baseline: 0,
        target: 95,
        unit: "percent",
        direction: "increase",
        confirmationMode: "measured",
      }),
    ]);
    expect(context.activeContract?.rules).toEqual([
      expect.objectContaining({ bindingId, sourceId: "check:research-context" }),
    ]);
  });

  it("changes safe Project and Workstream content identity when mutable context changes", async () => {
    const before = await reader.readAuthorizedContext({
      actor: { userId: ids.owner, active: true },
      projectId: ids.project,
      at,
    });
    expect(before).toMatchObject({
      projectVersion: 1,
      projectContentIdentitySha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      projectContentIdentityReference: expect.stringMatching(/^project-version:[a-f0-9]{64}$/u),
    });
    expect(before.workstreams.find(({ id }) => id === ids.workstream)).toMatchObject({
      projectId: ids.project,
      version: 1,
      description: "Authorized workstream",
      contentIdentitySha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      contentIdentityReference: expect.stringMatching(/^workstream-version:[a-f0-9]{64}$/u),
    });

    await client.$transaction([
      client.project.update({
        where: { id: ids.project },
        data: {
          description: "Ship a revised source-supported research workflow.",
          version: { increment: 1 },
        },
      }),
      client.workstream.update({
        where: { id: ids.workstream },
        data: { name: "Research engine v2", version: { increment: 1 } },
      }),
    ]);
    const after = await reader.readAuthorizedContext({
      actor: { userId: ids.owner, active: true },
      projectId: ids.project,
      at,
    });

    expect(after.projectVersion).toBe(2);
    expect(after.projectContentIdentitySha256).not.toBe(before.projectContentIdentitySha256);
    expect(after.projectContentIdentityReference).not.toBe(before.projectContentIdentityReference);
    const beforeWorkstream = before.workstreams.find(({ id }) => id === ids.workstream)!;
    const afterWorkstream = after.workstreams.find(({ id }) => id === ids.workstream)!;
    expect(afterWorkstream.version).toBe(2);
    expect(afterWorkstream.contentIdentitySha256).not.toBe(beforeWorkstream.contentIdentitySha256);
    expect(afterWorkstream.contentIdentityReference).not.toBe(
      beforeWorkstream.contentIdentityReference,
    );
  });
});
