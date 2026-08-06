import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ExperimentQueryService } from "./experiment-query-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const at = new Date("2026-08-06T13:00:00.000Z");
const ids = {
  owner: crypto.randomUUID(),
  member: crypto.randomUUID(),
  outsider: crypto.randomUUID(),
  project: crypto.randomUUID(),
  restrictedWorkstream: crypto.randomUUID(),
  restrictedWorkItem: crypto.randomUUID(),
  research: crypto.randomUUID(),
  experiment: crypto.randomUUID(),
  restrictedExperiment: crypto.randomUUID(),
  method: crypto.randomUUID(),
};

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `experiment-query-${suffix}`, name: "Experiment query" },
  });
  const department = await client.department.create({
    data: {
      key: `experiment-query-department-${suffix}`,
      name: "Experiment query",
      organizationId: organization.id,
    },
  });
  await client.user.createMany({
    data: [
      { id: ids.owner, email: `eq-owner-${suffix}@example.invalid`, displayName: "Owner" },
      { id: ids.member, email: `eq-member-${suffix}@example.invalid`, displayName: "Member" },
      { id: ids.outsider, email: `eq-outsider-${suffix}@example.invalid`, displayName: "Outsider" },
    ],
  });
  await client.authorizationScope.create({
    data: {
      id: ids.project,
      key: `eq-project-${suffix}`,
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
      name: "Experiment query project",
      description: "Fixture",
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
      reason: "Fixture",
      createdById: ids.owner,
    })),
  });
  await client.authorizationScope.create({
    data: {
      id: ids.restrictedWorkstream,
      key: `eq-restricted-workstream-${suffix}`,
      scopeType: "workstream",
      departmentId: department.id,
    },
  });
  await client.workstream.create({
    data: {
      id: ids.restrictedWorkstream,
      projectId: ids.project,
      authorizationScopeId: ids.restrictedWorkstream,
      name: "Restricted experiment workstream",
      description: "Narrow authorization fixture",
      status: "active",
      createdById: ids.owner,
    },
  });
  await client.workItem.create({
    data: {
      id: ids.restrictedWorkItem,
      projectId: ids.project,
      workstreamId: ids.restrictedWorkstream,
      title: "Restricted experiment work item",
      description: "Narrow authorization fixture",
      requirements: [],
      acceptanceConditions: [],
      createdById: ids.owner,
    },
  });
  await client.researchRecord.create({
    data: {
      id: ids.research,
      idempotencyKey: crypto.randomUUID(),
      projectId: ids.project,
      ownerId: ids.owner,
      state: "ACTIVE",
      revision: 1,
      version: 2,
      revisions: {
        create: {
          revision: 1,
          origin: "EMPLOYEE",
          problemStatement: "Problem",
          context: "Context",
          question: "Question?",
          objective: "Objective",
          hypothesisKind: "NO_HYPOTHESIS",
          noHypothesisReason: "Exploration",
          assumptions: [],
          constraints: [],
          knownUncertainty: [],
          alternatives: [],
          decisionQuestion: "Decision?",
          sourceReferences: [],
          executionMode: "manual",
          authorId: ids.owner,
          createdAt: at,
        },
      },
      participantEvents: {
        create: {
          employeeId: ids.owner,
          role: "OWNER",
          action: "STARTED",
          effectiveAt: at,
          reason: "Created",
          actorId: ids.owner,
          createdAt: at,
        },
      },
    },
  });
  await client.experiment.create({
    data: {
      id: ids.experiment,
      researchId: ids.research,
      idempotencyKey: crypto.randomUUID(),
      title: "Query experiment",
      state: "RESULT_RECORDED",
      methodRevision: 1,
      version: 3,
      createdAt: at,
      transitionedAt: at,
      methodRevisions: {
        create: {
          id: ids.method,
          revision: 1,
          question: "Does it improve?",
          baselineDescription: "Baseline",
          baselineValue: "10",
          conditions: ["Same conditions"],
          reproducibilityInstructions: "Repeat the bounded test.",
          knownRisks: [],
          failureCases: [],
          sourceReferences: [],
          executionMode: "manual",
          origin: "EMPLOYEE",
          authorId: ids.owner,
          createdAt: at,
          measures: {
            create: {
              stableId: "quality",
              name: "Quality",
              kind: "QUALITATIVE",
              unit: null,
              direction: "DESCRIPTIVE",
              baselineValue: null,
              interpretationRule: "Describe grounded differences.",
            },
          },
          testCases: {
            create: {
              inputIdentity: "sample-v1",
              expectedObservation: "Describe quality",
              category: "sample",
              inclusionReason: "Bounded sample",
            },
          },
        },
      },
    },
  });
  await client.experiment.create({
    data: {
      id: ids.restrictedExperiment,
      researchId: ids.research,
      workstreamId: ids.restrictedWorkstream,
      workItemId: ids.restrictedWorkItem,
      idempotencyKey: crypto.randomUUID(),
      title: "Restricted query experiment",
      state: "READY",
      methodRevision: 1,
      version: 2,
      createdAt: at,
      transitionedAt: at,
      methodRevisions: {
        create: {
          revision: 1,
          question: "Does the restricted method improve?",
          baselineDescription: "Baseline",
          conditions: ["Same conditions"],
          reproducibilityInstructions: "Repeat the bounded test.",
          knownRisks: [],
          failureCases: [],
          sourceReferences: [],
          executionMode: "manual",
          origin: "EMPLOYEE",
          authorId: ids.owner,
          createdAt: at,
          measures: {
            create: {
              stableId: "quality",
              name: "Quality",
              kind: "QUALITATIVE",
              unit: null,
              direction: "DESCRIPTIVE",
              baselineValue: null,
              interpretationRule: "Describe grounded differences.",
            },
          },
          testCases: {
            create: {
              inputIdentity: "sample-v1",
              expectedObservation: "Describe quality",
              category: "sample",
              inclusionReason: "Bounded sample",
            },
          },
        },
      },
    },
  });
  const measure = await client.experimentMeasure.findFirstOrThrow({
    where: { methodRevisionId: ids.method },
  });
  await client.experimentRun.create({
    data: {
      experimentId: ids.experiment,
      methodRevisionId: ids.method,
      sequence: 1,
      executorId: ids.owner,
      startedAt: at,
      completedAt: at,
      resultStatus: "COMPLETED",
      environment: [],
      inputs: [],
      modelConfigurations: [],
      unexpectedConditions: [],
      executionNotes: "Query fixture",
      sourceReferences: [],
      observations: {
        create: {
          measureId: measure.id,
          observedValue: "Mixed result",
          unit: null,
          note: "Retained",
        },
      },
    },
  });
});

afterAll(async () => client.$disconnect());

const queries = new ExperimentQueryService({
  database: client,
  clock: () => at,
  authorizer: {
    async authorize({ actor, scope }: any) {
      const member = await client.projectMember.findFirst({
        where: { projectId: scope.projectId, employeeId: actor.userId },
      });
      if (!actor.active || member === null)
        throw Object.assign(new Error("Forbidden"), { code: "RESEARCH_FORBIDDEN" });
    },
  },
});

describe("ExperimentQueryService", () => {
  it("returns authorized Experiment method, immutable run, and observations", async () => {
    const result = await queries.read({
      actor: { userId: ids.member, active: true },
      experimentId: ids.experiment,
    });
    expect(result.detail).toMatchObject({
      id: ids.experiment,
      state: "RESULT_RECORDED",
      currentMethod: { id: ids.method },
    });
    expect(result.runs).toEqual([
      expect.objectContaining({
        sequence: 1,
        observations: [
          expect.objectContaining({ measureStableId: "quality", observedValue: "Mixed result" }),
        ],
      }),
    ]);
  });

  it("reopens persisted validated AI drafts only for the Research owner", async () => {
    const outputReference = `experiment-method-review:${crypto.randomUUID()}`;
    const body = {
      schemaVersion: "experiment-method-review-output.v1",
      missingElements: ["Add a failure sample."],
      observations: ["The baseline is explicit."],
      uncertainties: ["Sample coverage is bounded."],
      sourceReferences: [`experiment-method:${ids.method}`],
      nextQuestion: "Which failure sample should be included?",
      draftOnly: true,
      requiresHumanApproval: true,
    };
    await client.$executeRaw`INSERT INTO "ExperimentAiDraft" (
      "id", "experimentId", "methodRevisionId", "kind", "body", "sourceReferences",
      "outputReference", "promptVersion", "routeTrace", "aiRunId", "createdAt"
    ) VALUES (
      ${crypto.randomUUID()}::uuid, ${ids.experiment}::uuid, ${ids.method}::uuid,
      'METHOD_REVIEW', ${JSON.stringify(body)}::jsonb, '[]'::jsonb,
      ${outputReference}, 'experiment-method-review-prompt.v1',
      ${JSON.stringify({ routeKey: "experiment.method-review.v1" })}::jsonb,
      ${crypto.randomUUID()}::uuid, ${at}
    )`;

    const ownerResult = await queries.read({
      actor: { userId: ids.owner, active: true },
      experimentId: ids.experiment,
    });

    expect(ownerResult.aiDrafts).toEqual([
      expect.objectContaining({ kind: "METHOD_REVIEW", body, outputReference }),
    ]);

    const memberResult = await queries.read({
      actor: { userId: ids.member, active: true },
      experimentId: ids.experiment,
    });
    expect(memberResult.aiDrafts).toEqual([]);
  });

  it("denies unrelated and inactive actors without leaking Experiment existence", async () => {
    await expect(
      queries.read({ actor: { userId: ids.outsider, active: true }, experimentId: ids.experiment }),
    ).rejects.toMatchObject({ code: "RESEARCH_FORBIDDEN" });
    await expect(
      queries.read({ actor: { userId: ids.owner, active: false }, experimentId: ids.experiment }),
    ).rejects.toMatchObject({ code: "RESEARCH_FORBIDDEN" });
  });

  it("filters every listed Experiment through its exact workstream and work-item scope", async () => {
    const scopedQueries = new ExperimentQueryService({
      database: client,
      clock: () => at,
      authorizer: {
        async authorize({ actor, scope }: any) {
          if (!actor.active || actor.userId !== ids.member) throw new Error("Forbidden");
          if (
            scope.workstreamId === ids.restrictedWorkstream ||
            scope.workItemId === ids.restrictedWorkItem
          ) {
            throw new Error("Forbidden");
          }
        },
      },
    });

    const listed = await scopedQueries.list({
      actor: { userId: ids.member, active: true },
      researchId: ids.research,
    });

    expect(listed.map(({ id }) => id)).toContain(ids.experiment);
    expect(listed.map(({ id }) => id)).not.toContain(ids.restrictedExperiment);
  });
});
