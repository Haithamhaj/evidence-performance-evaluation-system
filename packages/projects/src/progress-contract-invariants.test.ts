import { describe, expect, it } from "vitest";

import {
  calculateComponentPercent,
  validateProgressContractDraft,
} from "./progress-contract-invariants.js";

const base = {
  scopeKind: "project" as const,
  projectId: "00000000-0000-4000-8000-000000000301",
  workstreamId: null,
  sourceDocumentId: "00000000-0000-4000-8000-000000000302",
  sourceDocumentVersionId: "00000000-0000-4000-8000-000000000303",
  sourceDocumentVersion: 2,
  calculationKind: "weighted" as const,
  calculationSchemaVersion: "1.0.0",
  effectiveAt: "2026-07-18T00:00:00Z",
};

describe("progress contract invariants", () => {
  it("requires weighted components to total exactly 100", () => {
    expect(() =>
      validateProgressContractDraft({
        ...base,
        components: [
          component({ weight: 60 }),
          component({
            id: "00000000-0000-4000-8000-000000000305",
            weight: 30,
          }),
        ],
      }),
    ).toThrowError("PROGRESS_CONTRACT_WEIGHTS_INVALID");
  });

  it("calculates increasing and decreasing KPI progress from baseline and target", () => {
    expect(
      calculateComponentPercent(component({ baseline: 0, target: 10, direction: "increase" }), 5),
    ).toBe(50);
    expect(
      calculateComponentPercent(component({ baseline: 10, target: 2, direction: "decrease" }), 6),
    ).toBe(50);
  });

  it("clamps measurable progress without treating completion as performance", () => {
    expect(
      calculateComponentPercent(component({ baseline: 0, target: 10, direction: "increase" }), 15),
    ).toBe(100);
    expect(
      calculateComponentPercent(component({ baseline: 10, target: 2, direction: "decrease" }), 12),
    ).toBe(0);
  });

  it.each([
    ["Commit count", "commits"],
    ["Completed task volume", "tasks"],
    ["Update frequency", "updates per week"],
    ["Lines changed", "lines"],
  ])("rejects raw-activity progress measures: %s", (name, unit) => {
    expect(() =>
      validateProgressContractDraft({
        ...base,
        components: [component({ name, description: name, unit })],
      }),
    ).toThrowError("PROGRESS_CONTRACT_PROHIBITED_MEASURE");
  });
});

function component(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000304",
    kind: "kpi" as const,
    name: "KPI",
    description: "Operational KPI",
    weight: 100,
    baseline: 0,
    target: 10,
    unit: "items",
    direction: "increase" as const,
    acceptanceConditions: ["Measured source"],
    requiredEvidence: [],
    confirmationMode: "measured" as const,
    ...overrides,
  };
}
