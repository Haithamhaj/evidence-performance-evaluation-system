import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import { ResearchCriterionProposalReader } from "./research-criterion-proposal-reader.js";

const actor = { userId: crypto.randomUUID(), active: true } as const;
const projectId = crypto.randomUUID();
const workstreamId = crypto.randomUUID();
const proposalId = crypto.randomUUID();
const sourceDocumentVersionId = crypto.randomUUID();

function harness(overrides?: { state?: string; projectId?: string }) {
  const authorize = vi.fn(async () => ({
    actorId: actor.userId,
    projectId,
    workstreamId,
    workItemId: null,
    projectStatus: "active" as const,
    accessBasis: "workstream_contributor" as const,
    authorizedAt: "2026-08-05T09:00:00.000Z",
  }));
  const database = {
    dynamicCriteriaProposal: {
      findUnique: vi.fn(async () => ({
        id: proposalId,
        kind: "workstream",
        projectId: null,
        workstreamId,
        workstream: { projectId: overrides?.projectId ?? projectId },
        sourceDocumentVersionId,
        proposalNumber: 4,
        version: 2,
        state: overrides?.state ?? "approved",
        approvedAt: new Date("2026-08-05T08:00:00.000Z"),
        responses: [{ reason: "Private contributor objection" }],
      })),
    },
  };
  return {
    authorize,
    reader: new ResearchCriterionProposalReader(database as never, { authorize }),
  };
}

describe("ResearchCriterionProposalReader", () => {
  it("returns only an authorized approved prospective proposal reference", async () => {
    const { reader } = harness();

    const proposal = await reader.getProspectiveCriterionProposal({
      actor,
      proposalId,
      projectId,
    });

    expect(proposal).toEqual({
      proposalId,
      projectId,
      workstreamId,
      kind: "workstream",
      proposalNumber: 4,
      version: 2,
      state: "approved",
      sourceDocumentVersionId,
      approvedAt: "2026-08-05T08:00:00.000Z",
      sourceReference: `criterion-proposal:${proposalId}`,
    });
    expect(JSON.stringify(proposal)).not.toMatch(
      /response|objection|rating|readiness|evaluation/iu,
    );
  });

  it.each([
    ["unapproved", { state: "owner_review" }],
    ["cross-Project", { projectId: crypto.randomUUID() }],
  ])("rejects an %s proposal", async (_label, overrides) => {
    const { reader } = harness(overrides);
    await expect(
      reader.getProspectiveCriterionProposal({ actor, proposalId, projectId }),
    ).rejects.toMatchObject({ code: "RESEARCH_CRITERION_PROPOSAL_INVALID" });
  });

  it("preserves the Project owner-domain authorization decision", async () => {
    const { reader, authorize } = harness();
    authorize.mockRejectedValueOnce(
      new AppError("RESEARCH_SCOPE_FORBIDDEN", "errors.research.scopeForbidden", 403),
    );
    await expect(
      reader.getProspectiveCriterionProposal({ actor, proposalId, projectId }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
  });
});
