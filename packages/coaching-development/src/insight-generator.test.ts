import { describe, expect, it } from "vitest";

import { CoachingInsightGenerator } from "./insight-generator.js";

describe("CoachingInsightGenerator", () => {
  it("requires cited, non-volume facts and always states its rating limitation", () => {
    const generator = new CoachingInsightGenerator();
    const insight = generator.draft({
      employeeId: "10000000-0000-4000-8000-000000000001",
      period: { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-08-01T00:00:00Z" },
      facts: [
        {
          sourceId: "20000000-0000-4000-8000-000000000001",
          kind: "EVIDENCE",
          text: "A blocker and its resolution were documented.",
        },
      ],
    });
    expect(insight.sources).toHaveLength(1);
    expect(insight.limitations).toContain("Cannot infer performance rating.");
    expect(() =>
      generator.draft({
        employeeId: insight.employeeId,
        period: insight.period,
        facts: [
          { sourceId: "30000000-0000-4000-8000-000000000001", kind: "UPDATE", text: "42 updates" },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "COACHING_SOURCE_UNQUALIFIED" }));
  });
});
