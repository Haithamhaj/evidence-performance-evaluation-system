import { describe, expect, it, vi } from "vitest";

describe("UpdateEvidenceEvaluationFactReader", () => {
  it("returns confirmed updates and evidence as source facts without activity totals", async () => {
    const employeeId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const updateId = crypto.randomUUID();
    const evidenceEventId = crypto.randomUUID();
    const evidenceId = crypto.randomUUID();
    const evidenceRevisionId = crypto.randomUUID();
    const occurredAt = new Date("2026-08-14T10:00:00.000Z");
    const database = {
      acceptedUpdateEvent: {
        findMany: vi.fn(async () => [
          {
            id: updateId,
            projectId,
            workstreamId: null,
            workItemId: null,
            occurredAt,
            sourceReferences: [],
            confirmation: {
              draftRevision: {
                revision: 2,
                summary: "Implemented the approved flow.",
                result: "The acceptance path now passes.",
              },
            },
          },
        ]),
      },
      acceptedEvidenceEvent: {
        findMany: vi.fn(async () => [
          {
            id: evidenceEventId,
            evidenceId,
            projectId,
            workstreamId: null,
            occurredAt,
            sourceReferences: [],
            confirmation: {
              evidenceRevision: {
                id: evidenceRevisionId,
                revision: 3,
                supportedClaim: "The approved flow passed.",
                contributionContext: "Implemented and verified by the employee.",
                links: [],
                verifications: [{ outcome: "supported" }],
                attributions: [{ employeeId, state: "acknowledged" }],
              },
            },
            evidence: { workItemId: null },
          },
        ]),
      },
    };
    const module = (await import("./index.js")) as Record<string, unknown>;
    const Reader = module.UpdateEvidenceEvaluationFactReader as
      | (new (client: unknown) => {
          readAuthorizedFacts(input: unknown): Promise<{
            projectFacts: readonly { sourceId: string }[];
            confirmedEvidence: readonly { sourceId: string; verificationState: string }[];
          }>;
        })
      | undefined;

    expect(Reader).toBeTypeOf("function");
    const result = await new Reader!(database).readAuthorizedFacts({
      subjectEmployeeId: employeeId,
      cycleStart: "2026-07-01T00:00:00.000Z",
      cycleEnd: "2026-09-30T23:59:59.999Z",
      requester: {
        actorId: employeeId,
        subjectEmployeeId: employeeId,
        access: "self",
        active: true,
      },
    });

    expect(result.projectFacts).toEqual([expect.objectContaining({ sourceId: updateId })]);
    expect(result.confirmedEvidence).toEqual([
      expect.objectContaining({ sourceId: evidenceEventId, verificationState: "source_supported" }),
    ]);
    expect(result).not.toHaveProperty(["activity", "Count"].join(""));
  });
});
