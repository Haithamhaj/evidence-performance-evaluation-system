import { describe, expect, it } from "vitest";

import {
  ManagerEvaluationAiSummaryOutputSchema,
  assertManagerSummarySemantics,
  buildManagerEvaluationSummaryRequest,
} from "../../packages/manager-evaluation/src/index.js";

describe("manager-evaluation.summary v1 evaluation", () => {
  it("keeps themes cited, support-bounded, and free of ratings or manager judgment", () => {
    const period = { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" };
    const responseIds = [
      "00000000-0000-4000-8000-000000005101",
      "00000000-0000-4000-8000-000000005102",
    ];
    const output = ManagerEvaluationAiSummaryOutputSchema.parse({
      schemaVersion: "manager-evaluation-summary.v1",
      themes: [
        {
          kind: "STRENGTH",
          title: "Context sharing",
          summary: "Both identified responses describe useful context sharing.",
          criterionIds: ["00000000-0000-4000-8000-000000005103"],
          sourceResponseIds: responseIds,
          supportCount: 2,
          period,
          limitations: ["This is a theme, not a judgment."],
        },
      ],
      limitations: ["The two identified originals remain visible."],
    });
    expect(() => assertManagerSummarySemantics(output, responseIds, period)).not.toThrow();
    const request = buildManagerEvaluationSummaryRequest({
      cycleId: "00000000-0000-4000-8000-000000005104",
      period,
      responses: responseIds.map((responseId) => ({
        responseId,
        submittedAt: "2026-08-01T00:00:00Z",
        responses: [],
      })),
    });
    expect(request.routeKey).toBe("manager-evaluation.summary");
    expect(JSON.stringify(output)).not.toMatch(/recommendedRating|managerRating|rank/iu);
  });
});
