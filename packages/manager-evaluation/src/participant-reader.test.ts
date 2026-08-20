import { describe, expect, it, vi } from "vitest";

import { ManagerEvaluationParticipantReader } from "./participant-reader.js";

const ids = {
  cycle: "00000000-0000-4000-8000-000000008001",
  employee: "00000000-0000-4000-8000-000000008002",
  manager: "00000000-0000-4000-8000-000000008003",
  eligibility: "00000000-0000-4000-8000-000000008004",
  snapshot: "00000000-0000-4000-8000-000000008005",
  criteria: Array.from(
    { length: 5 },
    (_, index) => `00000000-0000-4000-8000-${String(8100 + index).padStart(12, "0")}`,
  ),
} as const;

describe("ManagerEvaluationParticipantReader", () => {
  it("returns the frozen identified form only for the eligible employee", async () => {
    const findUnique = vi.fn(async () => eligibility());
    const reader = new ManagerEvaluationParticipantReader({
      managerEvaluatorEligibility: { findUnique },
    } as never);

    const result = await reader.read({ cycleId: ids.cycle, evaluatorId: ids.employee });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cycleId_evaluatorId: { cycleId: ids.cycle, evaluatorId: ids.employee } },
      }),
    );
    expect(result).toMatchObject({
      schemaVersion: 1,
      cycle: { id: ids.cycle, visibilityMode: "IDENTIFIED" },
      manager: { id: ids.manager, displayName: "Pilot Manager" },
      eligibility: { id: ids.eligibility, state: "ELIGIBLE_PENDING", version: 1 },
    });
    expect(result.criteria.map(({ stableCriterionId }) => stableCriterionId)).toEqual([
      "MGR-01",
      "MGR-02",
      "MGR-03",
      "MGR-04",
      "MGR-05",
    ]);
  });

  it("fails closed when the employee has no frozen eligibility", async () => {
    const reader = new ManagerEvaluationParticipantReader({
      managerEvaluatorEligibility: { findUnique: vi.fn(async () => null) },
    } as never);

    await expect(
      reader.read({ cycleId: ids.cycle, evaluatorId: ids.employee }),
    ).rejects.toMatchObject({ code: "MANAGER_EVALUATION_ELIGIBILITY_NOT_FOUND", status: 404 });
  });
});

function eligibility() {
  return {
    id: ids.eligibility,
    state: "ELIGIBLE_PENDING",
    version: 1,
    evaluator: { active: true },
    cycle: {
      id: ids.cycle,
      state: "OPEN",
      visibilityMode: "IDENTIFIED",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-10-01T00:00:00.000Z"),
      manager: { id: ids.manager, displayName: "Pilot Manager" },
      snapshot: {
        id: ids.snapshot,
        criteriaSnapshot: ids.criteria.map((criterionId, index) => ({
          criterionId,
          stableCriterionId: `MGR-0${index + 1}`,
          commentRequired: false,
          anchorSnapshot: Array.from({ length: 5 }, (_, rating) => ({
            rating: rating + 1,
            text: `Approved anchor ${rating + 1}`,
          })),
        })),
      },
    },
    response: null,
  };
}
