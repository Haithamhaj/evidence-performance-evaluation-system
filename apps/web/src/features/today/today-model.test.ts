import { describe, expect, it } from "vitest";

import { buildTodayModel } from "./today-model.js";

const projectId = "11111111-1111-4111-8111-111111111111";

function workItem(id: string, title: string) {
  return {
    id,
    projectId,
    workstreamId: null,
    title,
    description: "",
    status: "ready" as const,
    priority: "normal" as const,
    assigneeId: "22222222-2222-4222-8222-222222222222",
    dueAt: null,
    requirements: [],
    acceptanceConditions: [],
    blocker: null,
    nextAction: null,
    version: 1,
    createdAt: "2026-08-12T07:00:00.000Z",
    updatedAt: "2026-08-12T08:00:00.000Z",
    checklist: [],
    collaboratorIds: [],
    allowedActions: ["edit" as const],
  };
}

describe("Intelligent Today composition", () => {
  it("keeps Needs Your Action, Today, and Overdue in the approved order", () => {
    const model = buildTodayModel({
      needsMyAction: [workItem("33333333-3333-4333-8333-333333333333", "Choose owner")],
      today: [workItem("44444444-4444-4444-8444-444444444444", "Prepare launch")],
      overdue: [workItem("55555555-5555-4555-8555-555555555555", "Resolve blocker")],
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
    });

    expect(model.sections.map(({ key }) => key)).toEqual(["needs_my_action", "today", "overdue"]);
    expect(model.sections.map(({ items }) => items[0]?.projectName)).toEqual([
      "Atlas Delivery",
      "Atlas Delivery",
      "Atlas Delivery",
    ]);
  });

  it("does not manufacture urgency when the authoritative groups are empty", () => {
    const model = buildTodayModel({
      needsMyAction: [],
      today: [],
      overdue: [],
      reviewQueue: [],
      inbox: [],
      projectPulse: [],
      upcoming: [],
    });

    expect(model.clear).toBe(true);
    expect(model.sections.every(({ items }) => items.length === 0)).toBe(true);
  });
});
