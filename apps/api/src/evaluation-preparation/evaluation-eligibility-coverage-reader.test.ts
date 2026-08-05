import { describe, expect, it, vi } from "vitest";

import { EvaluationEligibilityCoverageReader } from "./evaluation-eligibility-coverage-reader.js";

describe("EvaluationEligibilityCoverageReader", () => {
  it("adds a neutral exclusion note only for an approved-leave cycle entry", async () => {
    const cycleId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    const findUnique = vi.fn(async () => ({ state: "approved_leave" }));
    const reader = new EvaluationEligibilityCoverageReader({
      eligibilityEntry: { findUnique },
    } as never);

    const result = await reader.readAuthorizedFacts({
      cycleId,
      subjectEmployeeId: employeeId,
      cycleStart: "2026-07-01T00:00:00.000Z",
      cycleEnd: "2026-09-30T23:59:59.999Z",
      requester: {
        actorId: employeeId,
        subjectEmployeeId: employeeId,
        access: "self",
        active: true,
      },
    });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cycleId_employeeId: { cycleId, employeeId } },
      }),
    );
    expect(result.sourceCoverageNotes).toEqual([
      expect.objectContaining({ code: "approved_leave_excluded", neutral: true }),
    ]);
  });

  it("does not create a leave note for an active entry", async () => {
    const reader = new EvaluationEligibilityCoverageReader({
      eligibilityEntry: { findUnique: vi.fn(async () => ({ state: "active" })) },
    } as never);
    const employeeId = crypto.randomUUID();

    await expect(
      reader.readAuthorizedFacts({
        cycleId: crypto.randomUUID(),
        subjectEmployeeId: employeeId,
        cycleStart: "2026-07-01T00:00:00.000Z",
        cycleEnd: "2026-09-30T23:59:59.999Z",
        requester: {
          actorId: employeeId,
          subjectEmployeeId: employeeId,
          access: "self",
          active: true,
        },
      }),
    ).resolves.toEqual({ sourceCoverageNotes: [] });
  });
});
