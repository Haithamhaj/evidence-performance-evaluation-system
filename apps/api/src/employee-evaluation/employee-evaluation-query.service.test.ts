import { describe, expect, it, vi } from "vitest";

import { EmployeeEvaluationQueryService } from "./employee-evaluation-query.service.js";

const employeeId = "10000000-0000-4000-8000-000000000001";
const managerId = "10000000-0000-4000-8000-000000000002";

describe("EmployeeEvaluationQueryService cycle journey", () => {
  it("returns the frozen visibility and only the requesting actor's editable draft", async () => {
    const findFirst = vi.fn().mockResolvedValue(assignment());
    const readFacts = vi.fn().mockResolvedValue({ schemaVersion: 2, projectFacts: [] });
    const service = new EmployeeEvaluationQueryService(
      {
        evaluationAssignment: { findFirst },
      } as never,
      { read: readFacts } as never,
    );

    const employee = (await service.readCycleJourney({
      cycleId: "20000000-0000-4000-8000-000000000001",
      actorId: employeeId,
    })) as {
      cycle: { visibilityMode: string };
      drafts: Array<{ kind: string }>;
      factView: { schemaVersion: number };
    };
    const manager = (await service.readCycleJourney({
      cycleId: "20000000-0000-4000-8000-000000000001",
      actorId: managerId,
    })) as { cycle: { visibilityMode: string }; drafts: Array<{ kind: string }> };

    expect(employee.cycle.visibilityMode).toBe("identified");
    expect(employee.factView.schemaVersion).toBe(2);
    expect(readFacts).toHaveBeenCalledWith(
      expect.objectContaining({
        cycle: expect.objectContaining({ rubricVersionId: "40000000-0000-4000-8000-000000000001" }),
        requester: expect.objectContaining({ access: "self", actorId: employeeId }),
      }),
    );
    expect(employee.drafts).toEqual([expect.objectContaining({ kind: "SELF", version: 2 })]);
    expect(manager.drafts).toEqual([
      expect.objectContaining({ kind: "MANAGER_INITIAL", version: 3 }),
    ]);
    expect(manager.drafts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "SELF" })]),
    );
  });
});

function assignment() {
  const cycleId = "20000000-0000-4000-8000-000000000001";
  const now = new Date("2026-08-15T12:00:00Z");
  return {
    id: "30000000-0000-4000-8000-000000000001",
    cycleId,
    employeeId,
    managerId,
    version: 1,
    cycle: {
      id: cycleId,
      cycleType: "CALIBRATION_NON_BASELINE",
      state: "SELF_ASSESSMENT",
      startsAt: new Date("2026-07-01T00:00:00Z"),
      endsAt: new Date("2026-09-30T20:59:59Z"),
      version: 2,
      closedAt: null,
      snapshot: {
        visibilityMode: "identified",
        rubricVersionId: "40000000-0000-4000-8000-000000000001",
        templateSnapshot: { items: [] },
      },
    },
    submissions: [],
    assessments: [
      {
        kind: "SELF",
        version: 2,
        revisions: [{ entries: [], createdAt: now }],
        submissions: [],
      },
      {
        kind: "MANAGER_INITIAL",
        version: 3,
        revisions: [{ entries: [], createdAt: now }],
        submissions: [],
      },
    ],
    discussionEntries: [],
    finalSnapshot: null,
    acknowledgment: null,
  };
}
