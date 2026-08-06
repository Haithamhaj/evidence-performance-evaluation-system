import { describe, expect, it, vi } from "vitest";

import { ResearchReadinessReader } from "./readiness-reader.js";

describe("ResearchReadinessReader", () => {
  it("returns non-scoring action codes for confirmed incomplete lifecycle records", async () => {
    const projectId = crypto.randomUUID();
    const researchId = crypto.randomUUID();
    const experimentId = crypto.randomUUID();
    const reader = new ResearchReadinessReader({
      researchRecord: {
        findMany: vi.fn(async () => [
          {
            id: researchId,
            projectId,
            workstreamId: null,
            workItemId: null,
            state: "ACTIVE",
            revisions: [{ question: "Can retrieval improve?" }],
            researchConclusions: [],
            appliedLearning: [],
            experiments: [
              {
                id: experimentId,
                state: "RESULT_RECORDED",
                methodRevisions: [{}],
                runs: [{}],
                conclusions: [],
              },
            ],
          },
        ]),
      },
    } as never);

    const gaps = await reader.readEmployeeProjectGaps({
      employeeId: crypto.randomUUID(),
      projectId,
      startsAt: "2026-08-01T00:00:00.000Z",
      endsAt: "2026-09-01T00:00:00.000Z",
    });

    expect(gaps.map(({ actionCode }) => actionCode)).toEqual(
      expect.arrayContaining(["EXPERIMENT_CONCLUSION_MISSING", "RESEARCH_DECISION_MISSING"]),
    );
    expect(JSON.stringify(gaps)).not.toMatch(/percent|quota|rating|rank|score|count/iu);
  });
});
