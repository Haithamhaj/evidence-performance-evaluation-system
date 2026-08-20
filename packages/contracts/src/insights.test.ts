import { describe, expect, it } from "vitest";

import { EmployeeInsightsV1Schema } from "./insights.js";

describe("EmployeeInsightsV1Schema", () => {
  it("accepts source-backed personal and Project insights without performance scoring", () => {
    const parsed = EmployeeInsightsV1Schema.parse(fixture());

    expect(parsed.personal.confirmedContributions).toHaveLength(1);
    expect(parsed.projects[0]?.progress).toMatchObject({ state: "accepted", percent: 62 });
  });

  it.each(["rating", "rank", "productivityScore", "contentBody"])(
    "rejects prohibited analytics field %s",
    (field) => {
      expect(() =>
        EmployeeInsightsV1Schema.parse({
          ...fixture(),
          personal: { ...fixture().personal, [field]: 5 },
        }),
      ).toThrow();
    },
  );
});

function fixture() {
  return {
    schemaVersion: "employee-insights.v1",
    generatedAt: "2026-08-15T08:00:00.000Z",
    personal: {
      confirmedContributions: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          project: { id: "22222222-2222-4222-8222-222222222222", name: "Atlas" },
          workItem: null,
          sourceKind: "github",
          verificationState: "supported",
          confirmedAt: "2026-08-14T08:00:00.000Z",
        },
      ],
      finalizedEvaluations: [
        {
          assignmentId: "33333333-3333-4333-8333-333333333333",
          cycle: {
            id: "44444444-4444-4444-8444-444444444444",
            type: "CALIBRATION_NON_BASELINE",
            startsAt: "2026-04-01T00:00:00.000Z",
            endsAt: "2026-06-30T23:59:59.000Z",
          },
          finalizedAt: "2026-07-07T08:00:00.000Z",
          acknowledgment: null,
        },
      ],
    },
    projects: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Atlas",
        status: "active",
        progress: {
          state: "accepted",
          percent: 62,
          updatedAt: "2026-08-14T08:00:00.000Z",
        },
        sourceHealth: "sufficient",
        milestones: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            name: "API authentication",
            kind: "milestone",
            state: "in_progress",
            percent: 60,
          },
        ],
        kpi: null,
      },
    ],
  } as const;
}
