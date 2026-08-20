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

  it("returns only the employee's finalized cycle metadata without ratings or comments", async () => {
    const findMany = vi.fn(async () => [
      {
        id: "30000000-0000-4000-8000-000000000001",
        cycle: {
          id: "20000000-0000-4000-8000-000000000001",
          cycleType: "CALIBRATION_NON_BASELINE",
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          endsAt: new Date("2026-03-31T23:59:59.000Z"),
        },
        finalSnapshot: { finalizedAt: new Date("2026-04-07T08:00:00.000Z") },
        acknowledgment: null,
      },
    ]);
    const service = new EmployeeEvaluationQueryService(
      { evaluationAssignment: { findMany } } as never,
      { read: vi.fn() } as never,
    );

    const result = await service.readFinalizedHistory({
      actorId: employeeId,
      active: true,
      limit: 10,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId, finalSnapshot: { isNot: null } }, take: 10 }),
    );
    expect(result).toEqual([
      {
        assignmentId: "30000000-0000-4000-8000-000000000001",
        cycle: {
          id: "20000000-0000-4000-8000-000000000001",
          type: "CALIBRATION_NON_BASELINE",
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: "2026-03-31T23:59:59.000Z",
        },
        finalizedAt: "2026-04-07T08:00:00.000Z",
        acknowledgment: null,
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/rating|justification|comment/iu);
  });

  it("fails closed for a deactivated employee's finalized history", async () => {
    const service = new EmployeeEvaluationQueryService(
      { evaluationAssignment: { findMany: vi.fn() } } as never,
      { read: vi.fn() } as never,
    );

    await expect(
      service.readFinalizedHistory({ actorId: employeeId, active: false, limit: 10 }),
    ).rejects.toMatchObject({ status: 403 });
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
