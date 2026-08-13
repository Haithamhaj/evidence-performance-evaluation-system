import { describe, expect, it } from "vitest";

import { buildHomeOverviewModel } from "./home-overview-model.js";

const projectId = "30000000-0000-4000-8000-000000000001";

describe("buildHomeOverviewModel", () => {
  it("renders accepted progress without treating it as employee performance", () => {
    const model = buildHomeOverviewModel(homeFixture());

    expect(model.projects[0]).toMatchObject({
      progress: { kind: "accepted", label: "62%", value: 62 },
      progressProvenance: "Approved Project contract",
      currentMilestone: "API authentication",
      nextMilestone: "Pilot readiness",
    });
    expect(JSON.stringify(model)).not.toMatch(
      /employee score|performance score|productivity score/iu,
    );
  });

  it("shows an honest missing state when no official percentage exists", () => {
    const fixture = homeFixture();
    const model = buildHomeOverviewModel({
      ...fixture,
      projects: [
        {
          ...fixture.projects[0]!,
          progress: { state: "awaiting_information", missing: ["Verified metrics source"] },
          kpi: null,
        },
      ],
    });

    expect(model.projects[0]?.progress).toEqual({
      kind: "missing",
      label: "Needs information",
      missing: ["Verified metrics source"],
    });
    expect(model.projects[0]?.kpi).toBeNull();
  });
});

function homeFixture(): import("@evaluation/contracts/employee-experience").EmployeeHomeV1 {
  const source = {
    kind: "progress_contract" as const,
    label: "Approved Project contract",
    observedAt: "2026-08-13T07:00:00.000Z",
    freshness: "fresh" as const,
  };
  return {
    schemaVersion: "employee-home.v1",
    generatedAt: "2026-08-13T07:05:00.000Z",
    greetingName: "Codex",
    signals: { decisions: 1, dueToday: 2, verifiedChanges: 1 },
    projects: [
      {
        id: projectId,
        name: "Atlas Delivery",
        description: "Deliver secure API access.",
        status: "active",
        progress: { state: "accepted", percent: 62, source, explanation: "Approved rule" },
        milestones: [
          {
            componentId: "30000000-0000-4000-8000-000000000002",
            name: "Discovery",
            kind: "milestone",
            state: "complete",
            percent: 100,
          },
          {
            componentId: "30000000-0000-4000-8000-000000000003",
            name: "API authentication",
            kind: "milestone",
            state: "current",
            percent: 62,
          },
          {
            componentId: "30000000-0000-4000-8000-000000000004",
            name: "Pilot readiness",
            kind: "milestone",
            state: "next",
            percent: null,
          },
        ],
        kpi: {
          componentId: "30000000-0000-4000-8000-000000000005",
          name: "API error rate",
          baseline: 4.1,
          current: 1.8,
          target: 1,
          unit: "%",
          direction: "decrease",
          source,
        },
        nextAction: { label: "Review PR #184", href: `/en/projects/${projectId}` },
      },
    ],
    smartBrief: {
      title: "Why Atlas Delivery needs attention",
      body: "API error rate is above the contract target.",
      source,
      why: "Owner confirmation is pending.",
      consequence: "Reviewing opens the protected decision.",
      action: { label: "Review decision", href: `/en/projects/${projectId}` },
    },
    now: [],
  };
}
