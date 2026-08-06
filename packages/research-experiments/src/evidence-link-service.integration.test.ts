import { describe, expect, it } from "vitest";

import { ResearchEvidenceLinkService } from "./evidence-link-service.js";
import {
  createTask9Fixture,
  task9AuditWriter,
  task9Authorizer,
  task9Client,
  task9Now,
} from "./decision-service.integration.test.js";

describe("ResearchEvidenceLinkService", () => {
  it("stores only the confirmed Evidence revision identity in the same Project", async () => {
    const fixture = await createTask9Fixture();
    const service = new ResearchEvidenceLinkService({
      database: task9Client,
      authorizer: task9Authorizer,
      auditWriter: task9AuditWriter as never,
      evidenceReader: {
        getConfirmedEvidence: async () => ({
          evidenceId: fixture.ids.evidence,
          evidenceRevisionId: fixture.evidenceRevisionId,
          evidenceRevision: 1,
          projectId: fixture.ids.project,
          workstreamId: null,
          workItemId: null,
          sourceKind: "pasted_text",
          supportedClaim: "The result is reproducible.",
          confirmedAt: task9Now.toISOString(),
          sourceReferences: [`evidence:${fixture.ids.evidence}`],
        }),
      },
      clock: () => task9Now,
    });
    const result = await service.link({
      actor: { userId: fixture.ids.owner, active: true },
      correlationId: crypto.randomUUID(),
      researchId: fixture.ids.concludedResearch,
      input: {
        expectedVersion: 2,
        evidenceId: fixture.ids.evidence,
        evidenceRevisionId: fixture.evidenceRevisionId,
        supportedClaim: "The Evidence supports the named Research claim.",
        experimentId: null,
        experimentRunId: null,
        experimentConclusionId: null,
      },
    });

    expect(result).toMatchObject({
      evidenceId: fixture.ids.evidence,
      evidenceRevisionId: fixture.evidenceRevisionId,
      confirmerId: fixture.ids.owner,
    });
    expect(result).not.toHaveProperty("sourceText");
  });

  it("rejects a confirmed Evidence reader result from another Project atomically", async () => {
    const fixture = await createTask9Fixture();
    const service = new ResearchEvidenceLinkService({
      database: task9Client,
      authorizer: task9Authorizer,
      auditWriter: task9AuditWriter as never,
      evidenceReader: {
        getConfirmedEvidence: async () => ({
          evidenceId: fixture.ids.evidence,
          evidenceRevisionId: fixture.evidenceRevisionId,
          projectId: fixture.ids.otherProject,
        }),
      },
      clock: () => task9Now,
    });
    await expect(
      service.link({
        actor: { userId: fixture.ids.owner, active: true },
        correlationId: crypto.randomUUID(),
        researchId: fixture.ids.concludedResearch,
        input: {
          expectedVersion: 2,
          evidenceId: fixture.ids.evidence,
          evidenceRevisionId: fixture.evidenceRevisionId,
          supportedClaim: "This must not cross Projects.",
          experimentId: null,
          experimentRunId: null,
          experimentConclusionId: null,
        },
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_EVIDENCE_INVALID" });
    await expect(
      task9Client.researchEvidenceLink.count({
        where: { researchId: fixture.ids.concludedResearch },
      }),
    ).resolves.toBe(0);
  });
});
