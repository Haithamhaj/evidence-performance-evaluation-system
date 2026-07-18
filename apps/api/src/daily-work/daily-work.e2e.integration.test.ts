import { describe, expect, it, vi } from "vitest";

import { DailyWorkController, ProgressContractsController } from "./daily-work.controller.js";

const actorId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const documentVersionId = crypto.randomUUID();
const request = {
  principal: { userId: actorId, active: true },
  correlationId: crypto.randomUUID(),
} as never;

function validProposal() {
  return {
    reason: "Approved document is ready for contract review.",
    draft: {
      scopeKind: "project",
      projectId,
      workstreamId: null,
      sourceDocumentId: documentId,
      sourceDocumentVersionId: documentVersionId,
      sourceDocumentVersion: 2,
      calculationKind: "weighted",
      calculationSchemaVersion: "1.0.0",
      effectiveAt: "2026-07-18T12:00:00.000Z",
      components: [
        {
          id: crypto.randomUUID(),
          kind: "milestone",
          name: "Pilot accepted",
          description: "Owner accepts the runnable pilot.",
          weight: 100,
          baseline: null,
          target: null,
          unit: null,
          direction: null,
          acceptanceConditions: ["Acceptance is recorded"],
          requiredEvidence: ["Acceptance record"],
          confirmationMode: "human_confirmed",
        },
      ],
    },
  };
}

describe("daily work protected API contracts", () => {
  it("composes My Work using only the authenticated identity", async () => {
    const myWork = vi.fn(async () => ({ groups: [], nextCursor: null }));
    const controller = new DailyWorkController({ myWork } as never);
    await controller.myWork(request);
    expect(myWork).toHaveBeenCalledWith(actorId);
  });

  it("rejects cross-Project contracts before domain mutation", () => {
    const service = { propose: vi.fn() };
    const controller = new ProgressContractsController(service as never);
    const proposal = validProposal();
    proposal.draft.projectId = crypto.randomUUID();
    expect(() => controller.propose(request, projectId, proposal)).toThrow();
    expect(service.propose).not.toHaveBeenCalled();
  });

  it.each(["manualPercent", "rating", "rank", "productivityScore"])(
    "rejects forbidden %s input",
    (field) => {
      const controller = new ProgressContractsController({} as never);
      expect(() =>
        controller.propose(request, projectId, {
          ...validProposal(),
          [field]: 90,
        }),
      ).toThrow();
    },
  );

  it("rejects stale or unknown decision input fields", () => {
    const controller = new ProgressContractsController({} as never);
    expect(() =>
      controller.approve(request, projectId, crypto.randomUUID(), {
        expectedVersion: 2,
        reason: "Approved",
        actorId,
      }),
    ).toThrow();
  });

  it("binds a progress-contract decision to the Project in the route", async () => {
    const approve = vi.fn(async () => ({ state: "active" }));
    const controller = new ProgressContractsController({ approve } as never);
    const contractId = crypto.randomUUID();

    await controller.approve(request, projectId, contractId, {
      expectedVersion: 2,
      reason: "Approved measurable rules.",
    });

    expect(approve).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        contractId,
      }),
    );
  });
});
