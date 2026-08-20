import { describe, expect, it } from "vitest";

import {
  PreparedExperienceCompositionSchema,
  PreparedExperienceItemSchema,
} from "./experience-orchestration.js";

const prepared = {
  id: "91000000-0000-4000-8000-000000000001",
  schemaVersion: "experience-prepared-output.v1",
  state: "prepared",
  kind: "next_action",
  sourceReferences: ["work-item:91000000-0000-4000-8000-000000000002"],
  why: "This authorized task needs your attention today.",
  freshness: {
    status: "fresh",
    sourceObservedAt: "2026-08-12T07:00:00.000Z",
    preparedAt: "2026-08-12T07:05:00.000Z",
  },
  consequence: "Reviewing it keeps the current work visible; nothing changes until you act.",
  editableDraft: {
    title: "Review the prepared work item",
    body: "Open the task and decide the next step.",
  },
  assistance: {
    mode: "deterministic",
    label: "Selected from your authorized Today data without an AI result.",
    routeTrace: null,
  },
  correlationId: "91000000-0000-4000-8000-000000000003",
} as const;

describe("prepared experience orchestration contracts", () => {
  it("accepts one source-backed editable item with a truthful deterministic label", () => {
    expect(PreparedExperienceItemSchema.parse(prepared)).toEqual(prepared);
    expect(
      PreparedExperienceCompositionSchema.parse({ state: "prepared", items: [prepared] }),
    ).toEqual({ state: "prepared", items: [prepared] });
  });

  it("rejects more than one prepared item and protected scoring fields", () => {
    expect(() =>
      PreparedExperienceCompositionSchema.parse({ state: "prepared", items: [prepared, prepared] }),
    ).toThrow();
    expect(() =>
      PreparedExperienceItemSchema.parse({ ...prepared, recommendedRating: 4 }),
    ).toThrow();
    expect(() =>
      PreparedExperienceItemSchema.parse({ ...prepared, readinessPercentage: 80 }),
    ).toThrow();
  });

  it("requires an AI route trace only when the item truthfully claims AI assistance", () => {
    expect(() =>
      PreparedExperienceItemSchema.parse({
        ...prepared,
        assistance: { ...prepared.assistance, mode: "ai_assisted" },
      }),
    ).toThrow();
    expect(() =>
      PreparedExperienceItemSchema.parse({
        ...prepared,
        assistance: {
          ...prepared.assistance,
          routeTrace: {
            aiRunId: "91000000-0000-4000-8000-000000000004",
            routeKey: "experience.prepare-next.v1",
            outputReference: "experience-prepared:91000000-0000-4000-8000-000000000001",
          },
        },
      }),
    ).toThrow();
  });
});
