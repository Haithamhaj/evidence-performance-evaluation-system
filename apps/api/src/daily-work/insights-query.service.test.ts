import { describe, expect, it, vi } from "vitest";

import { InsightsQueryService } from "./insights-query.service.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";

describe("InsightsQueryService", () => {
  it("composes personal and contract-based Project insights without scoring fields", async () => {
    const service = new InsightsQueryService(
      {
        confirmedContributionHistory: vi.fn(async () => [
          {
            id: "33333333-3333-4333-8333-333333333333",
            project: { id: projectId, name: "Atlas" },
            workItem: null,
            sourceKind: "github",
            verificationState: "supported",
            confirmedAt: "2026-08-14T08:00:00.000Z",
          },
        ]),
      },
      {
        readFinalizedHistory: vi.fn(async () => []),
      },
      {
        projects: vi.fn(async () => [
          { id: projectId, name: "Atlas", status: "active", progress: { state: "accepted" } },
        ]),
        project: vi.fn(async () => projectView()),
      },
      () => new Date("2026-08-15T08:00:00.000Z"),
    );

    const result = await service.load({ userId: actorId, active: true });

    expect(result.projects[0]).toMatchObject({
      id: projectId,
      progress: { state: "accepted", percent: 62 },
      sourceHealth: "sufficient",
      milestones: expect.arrayContaining([
        expect.objectContaining({ name: "API authentication", state: "in_progress" }),
      ]),
      kpi: { name: "API error rate", current: 1.8, target: 1 },
    });
    expect(JSON.stringify(result)).not.toMatch(/rating|rank|productivityScore|contentBody/iu);
  });

  it("reports truthful awaiting states instead of inventing progress", async () => {
    const service = new InsightsQueryService(
      { confirmedContributionHistory: vi.fn(async () => []) },
      { readFinalizedHistory: vi.fn(async () => []) },
      {
        projects: vi.fn(async () => [
          {
            id: projectId,
            name: "Atlas",
            status: "active",
            progress: { state: "awaiting_contract" },
          },
        ]),
        project: vi.fn(async () => ({
          project: { id: projectId, name: "Atlas", status: "active" },
          progress: { state: "awaiting_contract" },
          pulse: {
            sourceCoverage: "INSUFFICIENT",
            milestoneStates: [],
            nextRequiredEvidence: [],
          },
          contract: null,
        })),
      },
    );

    const result = await service.load({ userId: actorId, active: true });

    expect(result.projects[0]).toMatchObject({
      progress: { state: "awaiting_contract" },
      sourceHealth: "awaiting_contract",
    });
  });

  it("fails closed for inactive employees before reading insights", async () => {
    const contributions = vi.fn();
    const service = new InsightsQueryService(
      { confirmedContributionHistory: contributions },
      { readFinalizedHistory: vi.fn() },
      { projects: vi.fn(), project: vi.fn() },
    );

    await expect(service.load({ userId: actorId, active: false })).rejects.toMatchObject({
      status: 403,
    });
    expect(contributions).not.toHaveBeenCalled();
  });
});

function projectView() {
  return {
    project: { id: projectId, name: "Atlas", status: "active" },
    progress: {
      state: "accepted",
      percent: 62,
      reason: "Approved milestone and KPI rules",
      updatedAt: "2026-08-14T08:00:00.000Z",
    },
    pulse: {
      sourceCoverage: "SUFFICIENT",
      milestoneStates: [
        {
          componentId: "44444444-4444-4444-8444-444444444444",
          name: "API authentication",
          kind: "milestone",
          percent: 60,
          state: "in_progress",
        },
        {
          componentId: "55555555-5555-4555-8555-555555555555",
          name: "API error rate",
          kind: "operational_kpi",
          percent: 50,
          measuredValue: 1.8,
          observedAt: "2026-08-14T08:00:00.000Z",
          state: "in_progress",
        },
      ],
      nextRequiredEvidence: [],
    },
    contract: {
      id: "66666666-6666-4666-8666-666666666666",
      components: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          kind: "milestone",
          name: "API authentication",
          baseline: null,
          target: null,
          unit: null,
          direction: null,
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          kind: "operational_kpi",
          name: "API error rate",
          baseline: 3,
          target: 1,
          unit: "%",
          direction: "decrease",
        },
      ],
    },
  };
}
