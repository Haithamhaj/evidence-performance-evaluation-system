import { describe, expect, it, vi } from "vitest";

import { EmployeeHomeQueryService } from "./employee-home-query.service.js";

const actor = {
  userId: "20000000-0000-4000-8000-000000000001",
  email: "Codex@pilot.local",
  active: true,
  roles: ["employee"],
};
const projectId = "20000000-0000-4000-8000-000000000002";
const componentId = "20000000-0000-4000-8000-000000000003";

describe("EmployeeHomeQueryService", () => {
  it("keeps display-only email out of the strict daily-work authorization actor", async () => {
    const dailyWorkspace = vi.fn(async () => ({
      needsMyAction: [],
      today: [],
      overdue: [],
      reviewQueue: [],
      inbox: [],
      projectPulse: [],
      upcoming: [],
    }));
    const service = new EmployeeHomeQueryService(
      { dailyWorkspace, project: async () => projectProgress() } as never,
      { listWhatChanged: async () => ({ items: [], nextCursor: null }) } as never,
    );

    await service.load(actor);

    expect(dailyWorkspace).toHaveBeenCalledWith({
      userId: actor.userId,
      active: true,
      roles: ["employee"],
    });
  });

  it("copies accepted Project progress and complete KPI measurements from authoritative readers", async () => {
    const service = new EmployeeHomeQueryService(
      {
        dailyWorkspace: async () => ({
          needsMyAction: [workItem("Decision task")],
          today: [workItem("Today task")],
          overdue: [],
          reviewQueue: [],
          inbox: [],
          projectPulse: [
            {
              id: projectId,
              name: "Atlas Delivery",
              status: "active",
              progress: {
                state: "accepted",
                percent: 62,
                updatedAt: "2026-08-13T07:00:00.000Z",
              },
            },
          ],
          upcoming: [],
        }),
        project: async () => projectProgress(),
      } as never,
      {
        listWhatChanged: async () => ({
          items: [receipt("20000000-0000-4000-8000-000000000009")],
          nextCursor: "1",
        }),
      } as never,
      () => new Date("2026-08-13T07:05:00.000Z"),
    );

    const result = await service.load(actor);

    expect(result.projects[0]).toMatchObject({
      name: "Atlas Delivery",
      progress: { state: "accepted", percent: 62 },
      kpi: { name: "API error rate", baseline: 4.1, current: 1.8, target: 1, unit: "%" },
    });
    expect(result.signals).toEqual({ decisions: 1, dueToday: 1, verifiedChanges: 1 });
    expect(result.greetingName).toBe("Codex");
    expect(result.now[0]).toMatchObject({ kind: "verified_change", projectId });
  });

  it("keeps missing progress and incomplete KPI measurements honest", async () => {
    const service = new EmployeeHomeQueryService(
      {
        dailyWorkspace: async () => ({
          needsMyAction: [],
          today: [],
          overdue: [],
          reviewQueue: [],
          inbox: [],
          projectPulse: [
            {
              id: projectId,
              name: "Atlas Delivery",
              status: "active",
              progress: { state: "awaiting_information" },
            },
          ],
          upcoming: [],
        }),
        project: async () => ({
          ...projectProgress(),
          progress: { state: "awaiting_information" },
          pulse: {
            ...projectProgress().pulse,
            officialProgress: null,
            nextRequiredEvidence: [
              { componentId, componentName: "API error rate", label: "Verified metrics source" },
            ],
          },
          contract: {
            ...projectProgress().contract,
            components: [
              {
                ...projectProgress().contract.components[0],
                baseline: null,
                target: null,
                unit: null,
                direction: null,
              },
            ],
          },
        }),
      } as never,
      { listWhatChanged: async () => ({ items: [], nextCursor: null }) } as never,
      () => new Date("2026-08-13T07:05:00.000Z"),
    );

    const result = await service.load(actor);

    expect(result.projects[0]?.progress).toEqual({
      state: "awaiting_information",
      missing: ["Verified metrics source"],
    });
    expect(result.projects[0]?.kpi).toBeNull();
  });

  it("does not include a receipt from an unrelated Project in the employee timeline", async () => {
    const otherProjectId = "20000000-0000-4000-8000-000000000099";
    const service = new EmployeeHomeQueryService(
      {
        dailyWorkspace: async () => ({
          needsMyAction: [],
          today: [],
          overdue: [],
          reviewQueue: [],
          inbox: [],
          projectPulse: [
            {
              id: projectId,
              name: "Atlas Delivery",
              status: "active",
              progress: { state: "awaiting_contract" },
            },
          ],
          upcoming: [],
        }),
        project: async () => ({
          project: { id: projectId, name: "Atlas Delivery", description: "", status: "active" },
          contract: null,
          progress: { state: "awaiting_contract" },
          pulse: { milestoneStates: [], nextRequiredEvidence: [], explanation: [] },
        }),
      } as never,
      {
        listWhatChanged: async () => ({
          items: [
            {
              ...receipt("20000000-0000-4000-8000-000000000010"),
              entityRefs: [{ entityType: "project", entityId: otherProjectId, version: 1 }],
            },
          ],
          nextCursor: "2",
        }),
      } as never,
      () => new Date("2026-08-13T07:05:00.000Z"),
    );

    const result = await service.load(actor);

    expect(result.now).toEqual([]);
  });

  it("rejects a deactivated employee before reading private work", async () => {
    const service = new EmployeeHomeQueryService(
      {
        dailyWorkspace: async () => {
          throw new Error("must not read");
        },
        project: async () => {
          throw new Error("must not read");
        },
      } as never,
      { listWhatChanged: async () => ({ items: [], nextCursor: null }) } as never,
    );

    await expect(service.load({ ...actor, active: false })).rejects.toMatchObject({
      code: "HOME_ACCESS_FORBIDDEN",
      status: 403,
    });
  });
});

function workItem(title: string) {
  return {
    id: "20000000-0000-4000-8000-000000000004",
    title,
    description: "Authorized work",
    projectId,
    workstreamId: null,
    assigneeEmployeeId: actor.userId,
    status: "ready",
    priority: 1,
    dueAt: "2026-08-13T12:00:00.000Z",
    nextAction: "Review",
    version: 1,
    allowedTransitions: ["in_progress"],
  };
}

function projectProgress() {
  return {
    project: {
      id: projectId,
      name: "Atlas Delivery",
      description: "Deliver secure API access.",
      status: "active",
    },
    contract: {
      id: "20000000-0000-4000-8000-000000000005",
      contractVersion: 2,
      version: 3,
      state: "active",
      calculationKind: "weighted_components",
      effectiveAt: "2026-08-01T00:00:00.000Z",
      components: [
        {
          id: componentId,
          kind: "kpi",
          name: "API error rate",
          description: "Staging API errors",
          weight: 100,
          baseline: 4.1,
          target: 1,
          unit: "%",
          direction: "decrease",
          requiredEvidence: ["Verified metrics source"],
        },
      ],
    },
    progress: {
      state: "accepted",
      snapshotId: "20000000-0000-4000-8000-000000000006",
      percent: 62,
      reason: "Approved measurable rule",
      updatedAt: "2026-08-13T07:00:00.000Z",
    },
    pulse: {
      officialProgress: 62,
      previousOfficialProgress: 55,
      sourceCoverage: "SUFFICIENT",
      milestoneStates: [
        {
          componentId,
          name: "API error rate",
          kind: "kpi",
          percent: 62,
          measuredValue: 1.8,
          observedAt: "2026-08-13T06:55:00.000Z",
          state: "in_progress",
        },
      ],
      nextRequiredEvidence: [],
      explanation: [
        {
          kind: "increase",
          delta: 7,
          text: "Approved measurable rule",
          snapshotId: "20000000-0000-4000-8000-000000000006",
          observedAt: "2026-08-13T07:00:00.000Z",
        },
      ],
    },
  };
}

function receipt(id: string) {
  return {
    receiptId: id,
    cursor: "1",
    type: "domain.work_item_changed",
    source: "work_items",
    entityRefs: [{ entityType: "project", entityId: projectId, version: 1 }],
    occurredAt: "2026-08-13T07:02:00.000Z",
    freshness: {
      state: "fresh",
      evaluatedAt: "2026-08-13T07:02:00.000Z",
      sourceUpdatedAt: "2026-08-13T07:02:00.000Z",
      safeReasonCode: "current",
      recoveryMode: "none",
      expectedVersion: 1,
    },
    state: "delivered",
  };
}
