import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ResearchQueryService } from "./research-query-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const at = new Date("2026-08-06T11:00:00.000Z");
const ids = {
  owner: crypto.randomUUID(),
  member: crypto.randomUUID(),
  inactive: crypto.randomUUID(),
  administrator: crypto.randomUUID(),
  project: crypto.randomUUID(),
  draft: crypto.randomUUID(),
  active: crypto.randomUUID(),
};

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `research-query-${suffix}`, name: "Research query" },
  });
  const department = await client.department.create({
    data: {
      key: `research-query-department-${suffix}`,
      name: "Research query",
      organizationId: organization.id,
    },
  });
  await client.user.createMany({
    data: [
      { id: ids.owner, email: `query-owner-${suffix}@example.invalid`, displayName: "Owner" },
      { id: ids.member, email: `query-member-${suffix}@example.invalid`, displayName: "Member" },
      {
        id: ids.inactive,
        email: `query-inactive-${suffix}@example.invalid`,
        displayName: "Inactive contributor",
        active: false,
      },
      {
        id: ids.administrator,
        email: `query-admin-${suffix}@example.invalid`,
        displayName: "Administrator",
      },
    ],
  });
  await client.authorizationScope.create({
    data: {
      id: ids.project,
      key: `research-query-project-${suffix}`,
      scopeType: "project",
      departmentId: department.id,
    },
  });
  await client.project.create({
    data: {
      id: ids.project,
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: ids.project,
      name: "Research query project",
      description: "Authorized query fixture",
      status: "active",
      createdById: ids.owner,
    },
  });
  await client.projectMember.createMany({
    data: [ids.owner, ids.member].map((employeeId) => ({
      projectId: ids.project,
      employeeId,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      endsAt: null,
      reason: "Research query fixture",
      createdById: ids.owner,
    })),
  });
  for (const [id, state] of [
    [ids.draft, "DRAFT"],
    [ids.active, "ACTIVE"],
  ] as const) {
    await client.researchRecord.create({
      data: {
        id,
        idempotencyKey: crypto.randomUUID(),
        projectId: ids.project,
        ownerId: ids.owner,
        state,
        revision: 1,
        version: state === "DRAFT" ? 1 : 2,
        revisions: {
          create: {
            revision: 1,
            origin: "EMPLOYEE",
            problemStatement: "Research problem",
            context: "Research context",
            question: "Research question?",
            objective: "Research objective",
            hypothesisKind: "NO_HYPOTHESIS",
            noHypothesisReason: "Exploratory research",
            assumptions: [],
            constraints: [],
            knownUncertainty: [],
            alternatives: [],
            decisionQuestion: "What should the project do?",
            sourceReferences: [],
            executionMode: "manual",
            authorId: ids.owner,
            createdAt: at,
          },
        },
        participantEvents: {
          createMany: {
            data: [
              {
                employeeId: ids.owner,
                role: "OWNER",
                action: "STARTED",
                effectiveAt: at,
                reason: "Created",
                actorId: ids.owner,
                createdAt: at,
              },
              {
                employeeId: ids.inactive,
                role: "CONTRIBUTOR",
                action: "STARTED",
                effectiveAt: at,
                reason: "Historical contribution",
                actorId: ids.owner,
                createdAt: at,
              },
            ],
          },
        },
        transitions: {
          createMany: {
            data:
              state === "DRAFT"
                ? [
                    {
                      fromState: null,
                      toState: "DRAFT",
                      actorId: ids.owner,
                      resultingVersion: 1,
                      effectiveAt: at,
                      createdAt: at,
                    },
                  ]
                : [
                    {
                      fromState: null,
                      toState: "DRAFT",
                      actorId: ids.owner,
                      resultingVersion: 1,
                      effectiveAt: at,
                      createdAt: at,
                    },
                    {
                      fromState: "DRAFT",
                      toState: "ACTIVE",
                      actorId: ids.owner,
                      resultingVersion: 2,
                      effectiveAt: at,
                      createdAt: at,
                    },
                  ],
          },
        },
      },
    });
  }
});

afterAll(async () => client.$disconnect());

const authorizer = {
  async authorize({ actor, scope, at: instant }: any) {
    if (!actor.active) throw forbidden();
    const user = await client.user.findUnique({ where: { id: actor.userId } });
    const member = await client.projectMember.findFirst({
      where: {
        projectId: scope.projectId,
        employeeId: actor.userId,
        startsAt: { lte: instant },
        OR: [{ endsAt: null }, { endsAt: { gt: instant } }],
      },
    });
    if (user?.active !== true || member === null) throw forbidden();
    return { projectId: scope.projectId };
  },
};

const queries = new ResearchQueryService({ database: client, authorizer, clock: () => at });

describe("ResearchQueryService", () => {
  it("shows DRAFT only to its current owner", async () => {
    await expect(
      queries.read({ actor: { userId: ids.owner, active: true }, researchId: ids.draft }),
    ).resolves.toMatchObject({ detail: { id: ids.draft, state: "DRAFT" } });
    await expect(
      queries.read({ actor: { userId: ids.member, active: true }, researchId: ids.draft }),
    ).rejects.toMatchObject({ code: "RESEARCH_FORBIDDEN" });
  });

  it("shares active Research only after current Project authorization", async () => {
    await expect(
      queries.read({ actor: { userId: ids.member, active: true }, researchId: ids.active }),
    ).resolves.toMatchObject({ detail: { id: ids.active, state: "ACTIVE" } });
    await expect(
      queries.read({ actor: { userId: ids.administrator, active: true }, researchId: ids.active }),
    ).rejects.toMatchObject({ code: "RESEARCH_FORBIDDEN" });
  });

  it("denies inactive actors while preserving deactivated participant history", async () => {
    await expect(
      queries.read({ actor: { userId: ids.inactive, active: false }, researchId: ids.active }),
    ).rejects.toMatchObject({ code: "RESEARCH_FORBIDDEN" });
    const visible = await queries.read({
      actor: { userId: ids.owner, active: true },
      researchId: ids.active,
    });
    expect(visible.participantEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ employeeId: ids.inactive, action: "STARTED" }),
      ]),
    );
  });

  it("lists only owner drafts plus currently authorized shared records", async () => {
    const ownerItems = await queries.list({
      actor: { userId: ids.owner, active: true },
      projectId: ids.project,
    });
    const memberItems = await queries.list({
      actor: { userId: ids.member, active: true },
      projectId: ids.project,
    });
    expect(ownerItems.map(({ id }) => id)).toEqual(expect.arrayContaining([ids.draft, ids.active]));
    expect(memberItems.map(({ id }) => id)).toContain(ids.active);
    expect(memberItems.map(({ id }) => id)).not.toContain(ids.draft);
  });
});

function forbidden() {
  return Object.assign(new Error("Forbidden"), { code: "RESEARCH_FORBIDDEN" });
}
