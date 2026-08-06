import { describe, expect, it, vi } from "vitest";

import { ResearchEvaluationFactReader } from "./evaluation-fact-reader.js";

describe("ResearchEvaluationFactReader", () => {
  it("separates source-supported experiment conclusions from employee interpretation", async () => {
    const projectId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    const conclusionId = crypto.randomUUID();
    const reader = new ResearchEvaluationFactReader({
      researchRecord: {
        findMany: vi.fn(async () => [
          {
            id: crypto.randomUUID(),
            projectId,
            workstreamId: null,
            workItemId: null,
            ownerId: employeeId,
            revisions: [],
            sourceReferences: [],
            experiments: [
              {
                id: crypto.randomUUID(),
                workstreamId: null,
                workItemId: null,
                methodRevisions: [],
                runs: [],
                conclusions: [
                  {
                    id: conclusionId,
                    summary: "Latency improved under the tested conditions.",
                    limitations: ["Small sample"],
                    confidenceDescription: "Moderate",
                    confirmerId: employeeId,
                    confirmedAt: new Date("2026-08-03T10:00:00Z"),
                  },
                ],
              },
            ],
            researchConclusions: [],
            appliedLearning: [],
            participantEvents: [],
          },
        ]),
      },
      responsibilityWindow: {
        findMany: vi.fn(async () => [
          {
            id: crypto.randomUUID(),
            projectId,
            workstreamId: null,
            startsAt: new Date("2026-07-01T00:00:00Z"),
            endsAt: null,
          },
        ]),
      },
    } as never);

    const bundle = await reader.readAuthorizedFacts({
      cycleId: crypto.randomUUID(),
      subjectEmployeeId: employeeId,
      cycleStart: "2026-08-01T00:00:00.000Z",
      cycleEnd: "2026-08-31T23:59:59.999Z",
      requester: {
        actorId: employeeId,
        subjectEmployeeId: employeeId,
        access: "self",
        active: true,
      },
    });

    expect(bundle.researchFacts).toEqual([
      expect.objectContaining({
        sourceId: conclusionId,
        factType: "experiment_conclusion",
        summary: "Latency improved under the tested conditions.",
      }),
    ]);
    expect(bundle.employeeInterpretations).toEqual([]);
    expect(Object.keys(bundle)).toEqual([
      "responsibilityWindows",
      "researchFacts",
      "employeeInterpretations",
    ]);
  });
});
