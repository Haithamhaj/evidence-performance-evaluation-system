import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { ResearchDecisionService } from "./decision-service.js";

export const task9Client: import("@evaluation/database").DatabaseClient = createDatabaseClient(
  process.env.TEST_DATABASE_URL ?? "",
);
export const task9Now = new Date("2026-08-06T13:00:00.000Z");

afterAll(async () => task9Client.$disconnect());

export async function createTask9Fixture() {
  const suffix = crypto.randomUUID();
  const ids = {
    owner: crypto.randomUUID(),
    assignee: crypto.randomUUID(),
    project: crypto.randomUUID(),
    otherProject: crypto.randomUUID(),
    workstream: crypto.randomUUID(),
    otherWorkstream: crypto.randomUUID(),
    activeResearch: crypto.randomUUID(),
    concludedResearch: crypto.randomUUID(),
    source: crypto.randomUUID(),
    experiment: crypto.randomUUID(),
    unresolvedExperiment: crypto.randomUUID(),
    conclusion: crypto.randomUUID(),
    evidence: crypto.randomUUID(),
    proposal: crypto.randomUUID(),
    proposedWorkItem: crypto.randomUUID(),
  };
  const organization = await task9Client.organization.create({
    data: { key: `task9-${suffix}`, name: "Task 9" },
  });
  const department = await task9Client.department.create({
    data: {
      key: `task9-department-${suffix}`,
      name: "Task 9",
      organizationId: organization.id,
    },
  });
  await task9Client.user.createMany({
    data: [
      { id: ids.owner, email: `task9-owner-${suffix}@example.invalid`, displayName: "Owner" },
      {
        id: ids.assignee,
        email: `task9-assignee-${suffix}@example.invalid`,
        displayName: "Assignee",
      },
    ],
  });
  for (const projectId of [ids.project, ids.otherProject]) {
    await task9Client.authorizationScope.create({
      data: {
        id: projectId,
        key: `task9-project-${projectId}`,
        scopeType: "project",
        departmentId: department.id,
      },
    });
    await task9Client.project.create({
      data: {
        id: projectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: projectId,
        name: "Task 9 project",
        description: "Task 9 fixture",
        status: "active",
        createdById: ids.owner,
      },
    });
  }
  await task9Client.projectMember.createMany({
    data: [ids.owner, ids.assignee].map((employeeId) => ({
      projectId: ids.project,
      employeeId,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      reason: "Task 9 fixture",
      createdById: ids.owner,
    })),
  });
  for (const [workstreamId, projectId] of [
    [ids.workstream, ids.project],
    [ids.otherWorkstream, ids.otherProject],
  ] as const) {
    await task9Client.authorizationScope.create({
      data: {
        id: workstreamId,
        key: `task9-workstream-${workstreamId}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
    });
    await task9Client.workstream.create({
      data: {
        id: workstreamId,
        projectId,
        authorizationScopeId: workstreamId,
        name: "Task 9 workstream",
        description: "Task 9 fixture",
        status: "active",
        createdById: ids.owner,
      },
    });
  }
  const revision = {
    revision: 1,
    origin: "EMPLOYEE" as const,
    problemStatement: "A decision needs evidence.",
    context: "The Project has a bounded Research question.",
    question: "Should the approach be adopted?",
    objective: "Reach a source-supported decision.",
    hypothesisKind: "TESTABLE" as const,
    hypothesisStatement: "The approach improves the result.",
    assumptions: [],
    constraints: [],
    knownUncertainty: [],
    alternatives: [],
    decisionQuestion: "Adopt or refine?",
    sourceReferences: [],
    executionMode: "manual" as const,
    authorId: ids.owner,
    createdAt: task9Now,
  };
  for (const [id, state, version] of [
    [ids.activeResearch, "ACTIVE", 1],
    [ids.concludedResearch, "CONCLUDED", 2],
  ] as const) {
    await task9Client.researchRecord.create({
      data: {
        id,
        idempotencyKey: crypto.randomUUID(),
        projectId: ids.project,
        ownerId: ids.owner,
        state,
        version,
        revision: 1,
        revisions: { create: revision },
        participantEvents: {
          create: {
            employeeId: ids.owner,
            role: "OWNER",
            action: "STARTED",
            effectiveAt: task9Now,
            reason: "Task 9 fixture",
            actorId: ids.owner,
            createdAt: task9Now,
          },
        },
      },
    });
  }
  await task9Client.researchSourceReference.create({
    data: {
      id: ids.source,
      researchId: ids.activeResearch,
      kind: "PAPER",
      title: "Named source",
      relevanceNote: "Directly addresses the Research question.",
      credibilityNote: "Reviewed by the employee.",
      retrievalState: "RETRIEVED",
      citedLocations: ["section:results"],
      state: "ACTIVE",
      addedById: ids.owner,
      createdAt: task9Now,
    },
  });
  await task9Client.experiment.createMany({
    data: [
      {
        id: ids.experiment,
        researchId: ids.activeResearch,
        idempotencyKey: crypto.randomUUID(),
        title: "Concluded Experiment",
        state: "CONCLUDED",
      },
      {
        id: ids.unresolvedExperiment,
        researchId: ids.activeResearch,
        idempotencyKey: crypto.randomUUID(),
        title: "Failed Experiment",
        state: "RESULT_RECORDED",
      },
    ],
  });
  await task9Client.researchConclusion.create({
    data: {
      id: ids.conclusion,
      researchId: ids.concludedResearch,
      synthesis: "Confirmed synthesis.",
      answer: "Apply the bounded result.",
      remainingUncertainty: [],
      decision: "ADOPT",
      rationale: "The employee confirmed the sources.",
      nextAction: "Apply the result.",
      sourceReferences: [`research-source:${ids.source}`],
      experimentIds: [],
      confirmerId: ids.owner,
      confirmedAt: task9Now,
      createdAt: task9Now,
    },
  });
  const evidence = await task9Client.evidenceRecord.create({
    data: {
      id: ids.evidence,
      idempotencyKey: crypto.randomUUID(),
      projectId: ids.project,
      employeeId: ids.owner,
      state: "confirmed",
      revisions: {
        create: {
          revision: 1,
          revisionKind: "manual_draft",
          sourceKind: "pasted_text",
          sourceText: "Confirmed evidence.",
          supportedClaim: "The result is reproducible.",
          contributionContext: "Research execution.",
          executionMode: "manual",
          createdById: ids.owner,
        },
      },
    },
    include: { revisions: true },
  });
  const evidenceRevision = evidence.revisions[0]!;
  const review = await task9Client.researchSourceReview.create({
    data: {
      projectId: ids.project,
      ownerId: ids.owner,
      idempotencyKey: crypto.randomUUID(),
      sourceKind: "URL",
      sealedSource: { ciphertext: "sealed" },
      state: "CONFIRMED",
      retrievalState: "RETRIEVED",
      currentRevision: 1,
      proposals: {
        create: {
          id: ids.proposal,
          kind: "WORK_ITEM",
          state: "DRAFT",
          title: "Apply Research",
          rationale: "The conclusion requires implementation.",
          content: {},
          sourceReferences: [`research-source:${ids.source}`],
          targetId: ids.proposedWorkItem,
        },
      },
    },
  });
  return { ids, evidenceRevisionId: evidenceRevision.id, reviewId: review.id };
}

export const task9Authorizer = {
  async authorize(input: any) {
    if (!input.actor.active) throw forbidden();
  },
  async authorizeTransaction(_transaction: any, input: any) {
    if (!input.actor.active) throw forbidden();
  },
};

export const task9AuditWriter = {
  append(transaction: any, input: any) {
    return transaction.auditEvent.create({
      data: {
        eventType: input.eventType,
        actorKind: input.actor.kind,
        actorId: input.actor.id,
        effectiveSubjectId: input.effectiveSubjectId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        safeDiff: input.safeDiff,
        correlationId: input.correlationId,
        source: input.source,
      },
    });
  },
};

export function forbidden() {
  return Object.assign(new Error("Forbidden"), { code: "RESEARCH_FORBIDDEN" });
}

describe("ResearchDecisionService", () => {
  it("atomically records a human decision citing a named source and same-Research Experiment", async () => {
    const fixture = await createTask9Fixture();
    const service = new ResearchDecisionService({
      database: task9Client,
      authorizer: task9Authorizer,
      auditWriter: task9AuditWriter as never,
      clock: () => task9Now,
    });
    const result = await service.conclude({
      actor: { userId: fixture.ids.owner, active: true },
      correlationId: crypto.randomUUID(),
      researchId: fixture.ids.activeResearch,
      input: {
        expectedVersion: 1,
        synthesis: "The cited results support a bounded next decision.",
        answer: "Adopt the verified approach.",
        remainingUncertainty: ["Production scale remains untested."],
        decision: "ADOPT",
        rationale: "The named source and concluded Experiment agree.",
        nextAction: "Create the bounded implementation Task.",
        sourceReferences: [`research-source:${fixture.ids.source}`],
        experimentIds: [fixture.ids.experiment],
      },
    });

    expect(result).toMatchObject({
      researchId: fixture.ids.activeResearch,
      decision: "ADOPT",
      confirmerId: fixture.ids.owner,
    });
    await expect(
      task9Client.researchRecord.findUniqueOrThrow({ where: { id: fixture.ids.activeResearch } }),
    ).resolves.toMatchObject({ state: "CONCLUDED", version: 2 });
    await expect(
      task9Client.auditEvent.findFirstOrThrow({
        where: { targetId: fixture.ids.activeResearch, eventType: "research.concluded" },
      }),
    ).resolves.toMatchObject({ actorId: fixture.ids.owner });
  });

  it("permits an unresolved Experiment only for refinement decisions", async () => {
    const fixture = await createTask9Fixture();
    const service = new ResearchDecisionService({
      database: task9Client,
      authorizer: task9Authorizer,
      auditWriter: task9AuditWriter as never,
      clock: () => task9Now,
    });
    await expect(
      service.conclude({
        actor: { userId: fixture.ids.owner, active: true },
        correlationId: crypto.randomUUID(),
        researchId: fixture.ids.activeResearch,
        input: {
          expectedVersion: 1,
          synthesis: "The failed Experiment is unresolved.",
          answer: "Adopt anyway.",
          remainingUncertainty: ["The failure is unresolved."],
          decision: "ADOPT",
          rationale: "This decision must be rejected.",
          nextAction: "Do not execute.",
          sourceReferences: [`research-source:${fixture.ids.source}`],
          experimentIds: [fixture.ids.unresolvedExperiment],
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_DECISION_INVALID" });
    await expect(
      task9Client.researchConclusion.count({ where: { researchId: fixture.ids.activeResearch } }),
    ).resolves.toBe(0);
  });

  it("rejects an ACTIVE source whose predecessor was append-only retracted", async () => {
    const fixture = await createTask9Fixture();
    await task9Client.researchSourceReference.create({
      data: {
        researchId: fixture.ids.activeResearch,
        kind: "PAPER",
        title: "Retraction marker",
        relevanceNote: "The original citation was withdrawn.",
        credibilityNote: "Recorded as append-only history.",
        retrievalState: "RETRIEVED",
        citedLocations: [
          {
            schemaVersion: "research-source-retraction.v1",
            predecessorSourceReferenceId: fixture.ids.source,
          },
        ],
        state: "RETRACTED",
        reason: "The cited result was withdrawn.",
        addedById: fixture.ids.owner,
        createdAt: new Date(task9Now.getTime() + 1),
      },
    });
    const service = new ResearchDecisionService({
      database: task9Client,
      authorizer: task9Authorizer,
      auditWriter: task9AuditWriter as never,
      clock: () => task9Now,
    });

    await expect(
      service.conclude({
        actor: { userId: fixture.ids.owner, active: true },
        correlationId: crypto.randomUUID(),
        researchId: fixture.ids.activeResearch,
        input: {
          expectedVersion: 1,
          synthesis: "The withdrawn source must not support this decision.",
          answer: "Do not persist this conclusion.",
          remainingUncertainty: [],
          decision: "ADOPT",
          rationale: "This should fail closed.",
          nextAction: "Replace the withdrawn citation.",
          sourceReferences: [`research-source:${fixture.ids.source}`],
          experimentIds: [fixture.ids.experiment],
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_DECISION_INVALID" });
  });
});
