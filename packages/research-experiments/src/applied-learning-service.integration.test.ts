import { describe, expect, it } from "vitest";

import { AppliedLearningService } from "./applied-learning-service.js";
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
});
