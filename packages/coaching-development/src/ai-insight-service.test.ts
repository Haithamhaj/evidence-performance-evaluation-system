import { describe, expect, it } from "vitest";

import { CoachingInsightAiService } from "./ai-insight-service.js";

describe("CoachingInsightAiService", () => {
  it("uses the governed coaching route and rejects uncited output", async () => {
    let routeKey = "";
    const service = new CoachingInsightAiService({
      run: async (request: { routeKey: string }) => {
        routeKey = request.routeKey;
        return {
          runId: "10000000-0000-4000-8000-000000000004",
          outputReference: "coaching-employee:employee",
          requiresHumanApproval: true,
          output: {
            schemaVersion: "coaching-insight.v1",
            pattern: "A cited pattern",
            sourceIds: ["10000000-0000-4000-8000-000000000002"],
            confidence: "SUPPORTED",
            confidenceBasis: "One cited fact",
            limitations: ["Cannot infer performance rating."],
            conflicts: [],
            cannotConclude: "Cannot infer performance rating.",
            actionDraft: null,
          },
        };
      },
    } as never);
    await service.draft({
      employeeId: "10000000-0000-4000-8000-000000000001",
      systemId: "10000000-0000-4000-8000-000000000003",
      period: { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-08-01T00:00:00Z" },
      facts: [
        {
          sourceId: "10000000-0000-4000-8000-000000000002",
          kind: "EVIDENCE",
          text: "A confirmed source",
        },
      ],
    });
    expect(routeKey).toBe("coaching.insight");
  });
});
