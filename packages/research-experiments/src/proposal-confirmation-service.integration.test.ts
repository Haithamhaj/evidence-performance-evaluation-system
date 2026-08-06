import { describe, expect, it } from "vitest";

import { ResearchProposalConfirmationService } from "./proposal-confirmation-service.js";
import {
  createTask9Fixture,
  task9AuditWriter,
  task9Authorizer,
  task9Client,
  task9Now,
} from "./decision-service.integration.test.js";

describe("ResearchProposalConfirmationService", () => {
  it("creates no Work Item before confirmation and replays the same confirmed Task", async () => {
    const fixture = await createTask9Fixture();
    const creator = {
      async createConfirmedTask(transaction: any, command: any) {
        const existing = await transaction.workItem.findUnique({
          where: { id: command.workItemId },
        });
        if (existing !== null) return existing;
        return transaction.workItem.create({
          data: {
            id: command.workItemId,
            ...command.input,
            dueAt: command.input.dueAt === null ? null : new Date(command.input.dueAt),
            createdById: command.actor.userId,
          },
        });
      },
    };
    const service = new ResearchProposalConfirmationService({
      database: task9Client,
      authorizer: task9Authorizer,
      auditWriter: task9AuditWriter as never,
      confirmedTaskCreator: creator,
      clock: () => task9Now,
    });
    await expect(
      task9Client.workItem.count({ where: { id: fixture.ids.proposedWorkItem } }),
    ).resolves.toBe(0);
    const command = {
      actor: { userId: fixture.ids.owner, active: true },
      correlationId: crypto.randomUUID(),
      proposalId: fixture.ids.proposal,
      expectedVersion: 1,
      researchId: fixture.ids.concludedResearch,
      researchConclusionId: fixture.ids.conclusion,
      researchExpectedVersion: 2,
      reason: "Employee confirmed the edited Research Task proposal.",
      whatChanged: "The Research decision became an official Task.",
      causalRationale: "The confirmed conclusion requires implementation.",
      editedTask: {
        title: "Apply the confirmed Research conclusion",
        description: "Implement the bounded change confirmed by the employee.",
        projectId: fixture.ids.project,
        workstreamId: null,
        assigneeId: fixture.ids.assignee,
        dueAt: null,
        priority: "normal" as const,
        requirements: [],
        acceptanceConditions: ["The confirmed Research conclusion is implemented."],
        blocker: null,
        nextAction: "Start the confirmed implementation Task.",
      },
    };
    const first = await service.confirmWorkItemProposal(command);
    const replay = await service.confirmWorkItemProposal(command);

    expect(replay.id).toBe(first.id);
    expect(first.id).toBe(fixture.ids.proposedWorkItem);
    await expect(
      task9Client.workItem.count({ where: { id: fixture.ids.proposedWorkItem } }),
    ).resolves.toBe(1);
    await expect(
      task9Client.researchProposalTransition.count({ where: { proposalId: fixture.ids.proposal } }),
    ).resolves.toBe(1);
    await expect(
      task9Client.appliedLearning.count({
        where: {
          researchId: fixture.ids.concludedResearch,
          targetId: fixture.ids.proposedWorkItem,
        },
      }),
    ).resolves.toBe(1);
  });

  it("rejects a cross-Project edited Task without changing proposal or history", async () => {
    const fixture = await createTask9Fixture();
    const service = new ResearchProposalConfirmationService({
      database: task9Client,
      authorizer: task9Authorizer,
      auditWriter: task9AuditWriter as never,
      confirmedTaskCreator: {
        async createConfirmedTask() {
          throw new Error("must not be called");
        },
      },
      clock: () => task9Now,
    });
    await expect(
      service.confirmWorkItemProposal({
        actor: { userId: fixture.ids.owner, active: true },
        correlationId: crypto.randomUUID(),
        proposalId: fixture.ids.proposal,
        expectedVersion: 1,
        researchId: fixture.ids.concludedResearch,
        researchConclusionId: fixture.ids.conclusion,
        researchExpectedVersion: 2,
        reason: "Cross-Project attempt.",
        whatChanged: "Must not persist.",
        causalRationale: "Must not persist.",
        editedTask: {
          title: "Wrong Project",
          description: "Must fail atomically.",
          projectId: fixture.ids.otherProject,
          workstreamId: fixture.ids.otherWorkstream,
          assigneeId: fixture.ids.assignee,
          dueAt: null,
          priority: "normal",
          requirements: [],
          acceptanceConditions: [],
          blocker: null,
          nextAction: null,
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_PROPOSAL_INVALID" });
    await expect(
      task9Client.researchProposal.findUniqueOrThrow({ where: { id: fixture.ids.proposal } }),
    ).resolves.toMatchObject({ state: "DRAFT", version: 1 });
    await expect(
      task9Client.researchConclusion.count({ where: { id: fixture.ids.conclusion } }),
    ).resolves.toBe(1);
  });
});
