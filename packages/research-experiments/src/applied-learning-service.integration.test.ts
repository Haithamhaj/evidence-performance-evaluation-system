import { describe, expect, it } from "vitest";

import { AppliedLearningService } from "./applied-learning-service.js";
import { ExperimentQueryService } from "./experiment-query-service.js";
import { ResearchQueryService } from "./research-query-service.js";
import {
  createTask9Fixture,
  task9AuditWriter,
  task9Authorizer,
  task9Client,
  task9Now,
} from "./decision-service.integration.test.js";

describe("AppliedLearningService", () => {
  it("persists only a human-confirmed target validated by its owner-domain reader", async () => {
    const fixture = await createTask9Fixture();
    const service = new AppliedLearningService({
      database: task9Client,
      authorizer: task9Authorizer,
      auditWriter: task9AuditWriter as never,
      targetReaders: {
        workItem: {
          authorizeProjectItem: async () => ({
            id: fixture.ids.proposedWorkItem,
            projectId: fixture.ids.project,
            workstreamId: null,
          }),
        },
      },
      clock: () => task9Now,
    });
    await task9Client.workItem.create({
      data: {
        id: fixture.ids.proposedWorkItem,
        projectId: fixture.ids.project,
        title: "Confirmed target",
        description: "Confirmed target",
        requirements: [],
        acceptanceConditions: [],
        createdById: fixture.ids.owner,
      },
    });

    const result = await service.create({
      actor: { userId: fixture.ids.owner, active: true },
      correlationId: crypto.randomUUID(),
      researchId: fixture.ids.concludedResearch,
      input: {
        expectedVersion: 2,
        researchConclusionId: fixture.ids.conclusion,
        target: { kind: "WORK_ITEM", id: fixture.ids.proposedWorkItem },
        whatChanged: "The confirmed finding changed the implementation Task.",
        causalRationale: "The named result invalidated the previous assumption.",
      },
    });

    expect(result).toMatchObject({
      researchId: fixture.ids.concludedResearch,
      targetKind: "WORK_ITEM",
      targetId: fixture.ids.proposedWorkItem,
      confirmerId: fixture.ids.owner,
    });
  });

  it("rolls back a cross-Project target without erasing existing history", async () => {
    const fixture = await createTask9Fixture();
    const service = new AppliedLearningService({
      database: task9Client,
      authorizer: task9Authorizer,
      auditWriter: task9AuditWriter as never,
      targetReaders: {
        workItem: {
          authorizeProjectItem: async () => ({
            id: fixture.ids.proposedWorkItem,
            projectId: fixture.ids.otherProject,
            workstreamId: fixture.ids.otherWorkstream,
          }),
        },
      },
      clock: () => task9Now,
    });
    await expect(
      service.create({
        actor: { userId: fixture.ids.owner, active: true },
        correlationId: crypto.randomUUID(),
        researchId: fixture.ids.concludedResearch,
        input: {
          expectedVersion: 2,
          researchConclusionId: fixture.ids.conclusion,
          target: { kind: "WORK_ITEM", id: fixture.ids.proposedWorkItem },
          whatChanged: "This must not cross Projects.",
          causalRationale: "The target belongs elsewhere.",
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_APPLIED_TARGET_INVALID" });
    await expect(
      task9Client.appliedLearning.count({ where: { researchId: fixture.ids.concludedResearch } }),
    ).resolves.toBe(0);
    await expect(
      task9Client.researchConclusion.count({ where: { id: fixture.ids.conclusion } }),
    ).resolves.toBe(1);
  });

  it.each(["RESEARCH", "EXPERIMENT"] as const)(
    "rejects another employee's DRAFT %s through its exact owner-domain reader",
    async (kind) => {
      const fixture = await createTask9Fixture();
      const draftResearch = await task9Client.researchRecord.create({
        data: {
          idempotencyKey: crypto.randomUUID(),
          projectId: fixture.ids.project,
          ownerId: fixture.ids.assignee,
          state: "DRAFT",
          revisions: {
            create: {
              revision: 1,
              origin: "EMPLOYEE",
              problemStatement: "Private draft owned by another employee.",
              context: "Must stay private.",
              question: "Can another employee link this?",
              objective: "Prove owner-only draft access.",
              hypothesisKind: "NO_HYPOTHESIS",
              noHypothesisReason: "Authorization test.",
              assumptions: [],
              constraints: [],
              knownUncertainty: [],
              alternatives: [],
              decisionQuestion: "Reject the link?",
              sourceReferences: [],
              executionMode: "manual",
              authorId: fixture.ids.assignee,
            },
          },
        },
      });
      const draftExperiment = await task9Client.experiment.create({
        data: {
          researchId: draftResearch.id,
          idempotencyKey: crypto.randomUUID(),
          title: "Private experiment draft",
          state: "DRAFT",
        },
      });
      const researchReader = new ResearchQueryService({
        database: task9Client,
        authorizer: task9Authorizer,
        clock: () => task9Now,
      });
      const experimentReader = new ExperimentQueryService({
        database: task9Client,
        authorizer: task9Authorizer,
        clock: () => task9Now,
      });
      const service = new AppliedLearningService({
        database: task9Client,
        authorizer: task9Authorizer,
        auditWriter: task9AuditWriter as never,
        targetReaders: { research: researchReader, experiment: experimentReader },
        clock: () => task9Now,
      });

      await expect(
        service.create({
          actor: { userId: fixture.ids.owner, active: true },
          correlationId: crypto.randomUUID(),
          researchId: fixture.ids.concludedResearch,
          input: {
            expectedVersion: 2,
            researchConclusionId: fixture.ids.conclusion,
            target: {
              kind,
              id: kind === "RESEARCH" ? draftResearch.id : draftExperiment.id,
            },
            whatChanged: "This private draft must not be linked.",
            causalRationale: "Owner-domain authorization must fail closed.",
          },
        }),
      ).rejects.toMatchObject({ code: "RESEARCH_APPLIED_TARGET_INVALID" });
    },
  );
});
