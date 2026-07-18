import { describe, expect, it, vi } from "vitest";

import { CriteriaWorkspaceQueryService } from "./workspace-query-service.js";

const actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  active: true,
} as const;
const resourceId = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000003";
const proposalId = "00000000-0000-4000-8000-000000000004";
const snapshotId = "00000000-0000-4000-8000-000000000005";
const documentVersionId = "00000000-0000-4000-8000-000000000006";
const readinessCheckId = "00000000-0000-4000-8000-000000000014";
const now = new Date("2026-07-18T12:00:00Z");

const item = {
  id: "00000000-0000-4000-8000-000000000007",
  position: 1,
  name: "Traceable outcome",
  selectionReason: "Approved source",
  successLink: "Project success",
  expectedBehaviorOrResult: "Source-supported result",
  evaluationMethod: "Human review",
  suggestedEvidence: ["Approved source"],
  sourceReferences: ["document-version:00000000-0000-4000-8000-000000000008"],
};

function harness(state: string | null = "contributor_review") {
  const proposal = {
    id: proposalId,
    kind: "workstream",
    state,
    version: 2,
    sourceDocumentVersionId: documentVersionId,
    readinessCheckId,
    items: [{ ...item }, { ...item, id: crypto.randomUUID(), position: 2 }],
    reviewSnapshot: {
      id: snapshotId,
      eligibility: [
        { employeeId: actor.userId, responseRequired: true },
        {
          employeeId: "00000000-0000-4000-8000-000000000009",
          responseRequired: true,
        },
      ],
    },
    responses: [
      {
        employeeId: "00000000-0000-4000-8000-000000000009",
        response: "object",
        reason: "Retained objection" as string | null,
      },
    ],
    managerResolution: null,
    transitions: [] as Array<{
      id: string;
      fromState: string;
      toState: string;
      reason: string;
    }>,
  };
  const database = {
    dynamicCriteriaProposal: { findFirst: vi.fn(async () => (state === null ? null : proposal)) },
    dynamicCriteriaSet: { findFirst: vi.fn(async () => null) },
  };
  const identity = {
    kind: "workstream",
    resourceId,
    projectId,
    organizationId: "00000000-0000-4000-8000-000000000010",
    departmentId: "00000000-0000-4000-8000-000000000011",
    status: "completed",
  } as const;
  const reader = { read: vi.fn(async () => identity) };
  const prerequisites: import("@evaluation/documents").CriteriaDocumentPrerequisites = {
    documentId: crypto.randomUUID(),
    documentVersionId,
    documentVersion: 1,
    readinessCheckId,
    lifecycleState: "ready_for_criteria_generation",
    projectId: null,
    workstreamId: resourceId,
    sourceReferences: [`document-version:${documentVersionId}`],
  };
  const documentReader = {
    getCurrentPrerequisites: vi.fn(
      async (): Promise<import("@evaluation/documents").CriteriaDocumentPrerequisites | null> =>
        prerequisites,
    ),
    getPrerequisites: vi.fn(
      async (): Promise<import("@evaluation/documents").CriteriaDocumentPrerequisites | null> =>
        prerequisites,
    ),
    getVersionIdentity: vi.fn(
      async (): Promise<
        import("@evaluation/documents").CriteriaDocumentVersionIdentity | null
      > => ({
        documentId: prerequisites.documentId,
        documentVersionId,
        isCurrent: true,
      }),
    ),
  };
  const policy = {
    allows: vi.fn(
      async (input: Readonly<{ action: string }>) =>
        input.action === "criteria.read" || input.action === "criteria.contributor.respond",
    ),
  };
  return {
    proposal,
    database,
    reader,
    documentReader,
    prerequisites,
    policy,
    service: new CriteriaWorkspaceQueryService(
      database as never,
      reader,
      documentReader,
      policy,
      () => now,
    ),
  };
}

describe("CriteriaWorkspaceQueryService", () => {
  it("returns frozen response progress and only the legal contributor action", async () => {
    const { service } = harness();
    await expect(service.get({ actor, kind: "workstream", resourceId })).resolves.toMatchObject({
      proposal: {
        id: proposalId,
        requiredResponses: 2,
        completedResponses: 1,
        objectionCount: 1,
        viewerResponse: null,
      },
      activeSet: null,
      replacementRequest: null,
      allowedActions: ["respond"],
    });
  });

  it("allows a frozen eligible contributor to read narrowly after current responsibility ends", async () => {
    const { service, policy } = harness();
    policy.allows.mockImplementation(
      async (input: Readonly<{ action: string }>) =>
        input.action === "criteria.contributor.respond",
    );
    await expect(service.get({ actor, kind: "workstream", resourceId })).resolves.toMatchObject({
      allowedActions: ["respond"],
    });
  });

  it("denies the frozen-read fallback after response or after contributor review ends", async () => {
    const responded = harness();
    responded.policy.allows.mockImplementation(
      async (input: Readonly<{ action: string }>) =>
        input.action === "criteria.contributor.respond",
    );
    responded.proposal.responses.push({
      employeeId: actor.userId,
      response: "acknowledge",
      reason: null,
    });
    await expect(
      responded.service.get({ actor, kind: "workstream", resourceId }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH", status: 403 });

    for (const state of ["manager_resolution", "approved", "activated"]) {
      const ended = harness(state);
      ended.policy.allows.mockImplementation(
        async (input: Readonly<{ action: string }>) =>
          input.action === "criteria.contributor.respond",
      );
      await expect(
        ended.service.get({ actor, kind: "workstream", resourceId }),
      ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH", status: 403 });
    }
  });

  it("retains objections, derives active items from the activated proposal, and exposes no scores", async () => {
    const { service, database, policy, proposal } = harness("approved");
    proposal.responses.push({
      employeeId: actor.userId,
      response: "acknowledge",
      reason: null,
    });
    policy.allows.mockImplementation(
      async (input: Readonly<{ action: string }>) =>
        input.action === "criteria.read" || input.action === "criteria.activate",
    );
    database.dynamicCriteriaSet.findFirst.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000013",
      proposalId,
      version: 3,
      effectiveFrom: new Date("2026-07-18T10:00:00Z"),
      effectiveTo: null,
      proposal: { items: [item] },
    } as never);
    const result = await service.get({ actor, kind: "workstream", resourceId });
    expect(result.allowedActions).toEqual(["activate"]);
    expect(result.activeSet?.items).toEqual([item]);
    expect(JSON.stringify(result)).not.toMatch(/readiness|rating|rank|productivity/iu);
  });

  it("offers publish and activate only while the exact source and readiness pins remain current", async () => {
    const ownerReview = harness("owner_review");
    ownerReview.policy.allows.mockImplementation(
      async (input: Readonly<{ action: string }>) =>
        input.action === "criteria.read" || input.action === "criteria.owner.review",
    );
    await expect(
      ownerReview.service.get({ actor, kind: "workstream", resourceId }),
    ).resolves.toMatchObject({ allowedActions: ["owner_review", "publish"] });
    ownerReview.documentReader.getVersionIdentity.mockResolvedValueOnce({
      documentId: crypto.randomUUID(),
      documentVersionId,
      isCurrent: false,
    });
    await expect(
      ownerReview.service.get({ actor, kind: "workstream", resourceId }),
    ).resolves.toMatchObject({ allowedActions: ["owner_review"] });

    const approved = harness("approved");
    approved.proposal.responses.push({
      employeeId: actor.userId,
      response: "acknowledge",
      reason: null,
    });
    approved.policy.allows.mockImplementation(
      async (input: Readonly<{ action: string }>) =>
        input.action === "criteria.read" || input.action === "criteria.activate",
    );
    approved.documentReader.getPrerequisites.mockResolvedValueOnce({
      ...approved.prerequisites,
      readinessCheckId: crypto.randomUUID(),
    });
    await expect(
      approved.service.get({ actor, kind: "workstream", resourceId }),
    ).resolves.toMatchObject({ allowedActions: [] });
  });

  it("offers generation only for a current document in ready_for_criteria_generation", async () => {
    const ready = harness(null);
    ready.policy.allows.mockImplementation(
      async (input: Readonly<{ action: string }>) =>
        input.action === "criteria.read" || input.action === "criteria.generate",
    );
    await expect(
      ready.service.get({ actor, kind: "workstream", resourceId }),
    ).resolves.toMatchObject({ allowedActions: ["generate"], replacementRequest: null });
    ready.documentReader.getCurrentPrerequisites.mockResolvedValueOnce(null);
    await expect(
      ready.service.get({ actor, kind: "workstream", resourceId }),
    ).resolves.toMatchObject({ allowedActions: [] });

    const activated = harness("activated");
    activated.policy.allows.mockImplementation(
      async (input: Readonly<{ action: string }>) =>
        input.action === "criteria.read" || input.action === "criteria.generate",
    );
    await expect(
      activated.service.get({ actor, kind: "workstream", resourceId }),
    ).resolves.toMatchObject({ allowedActions: [] });
  });

  it("binds superseded replacement generation to the exact immutable transition", async () => {
    const replacement = harness("superseded");
    replacement.proposal.transitions.push({
      id: crypto.randomUUID(),
      fromState: "manager_resolution",
      toState: "superseded",
      reason: "Revise the source-bound criteria.",
    });
    replacement.policy.allows.mockImplementation(
      async (input: Readonly<{ action: string }>) =>
        input.action === "criteria.read" || input.action === "criteria.generate",
    );
    await expect(
      replacement.service.get({ actor, kind: "workstream", resourceId }),
    ).resolves.toMatchObject({
      allowedActions: ["generate"],
      replacementRequest: {
        replacesProposalId: proposalId,
        ownerFeedback: "Revise the source-bound criteria.",
      },
    });
    replacement.documentReader.getCurrentPrerequisites.mockResolvedValueOnce(null);
    await expect(
      replacement.service.get({ actor, kind: "workstream", resourceId }),
    ).resolves.toMatchObject({ allowedActions: [], replacementRequest: null });
  });

  it("fails closed for an outsider and terminal proposals expose no illegal action", async () => {
    const outsider = harness("superseded");
    outsider.policy.allows.mockResolvedValue(false);
    await expect(
      outsider.service.get({ actor, kind: "workstream", resourceId }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH", status: 403 });

    const terminal = harness("rejected");
    terminal.policy.allows.mockImplementation(
      async (input: Readonly<{ action: string }>) => input.action === "criteria.read",
    );
    await expect(
      terminal.service.get({ actor, kind: "workstream", resourceId }),
    ).resolves.toMatchObject({ allowedActions: [] });
  });
});
