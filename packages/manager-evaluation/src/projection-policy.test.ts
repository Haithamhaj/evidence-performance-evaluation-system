import { describe, expect, it, vi } from "vitest";

import { IdentifiedProjectionPolicy, createProjectionPolicy } from "./projection-policy.js";

describe("manager evaluation projection policy", () => {
  it("enables only the truthful IDENTIFIED pilot projection", () => {
    expect(createProjectionPolicy("IDENTIFIED")).toMatchObject({ mode: "IDENTIFIED" });
    expect(() => createProjectionPolicy("MANAGER_BLINDED")).toThrowError(
      expect.objectContaining({ code: "MANAGER_EVALUATION_VISIBILITY_DISABLED" }),
    );
    expect(() => createProjectionPolicy("ANONYMOUS_AGGREGATED")).toThrowError(
      expect.objectContaining({ code: "MANAGER_EVALUATION_VISIBILITY_DISABLED" }),
    );
  });

  it("composes completion, originals, summary, and audit from one repeatable transaction", async () => {
    const ids = {
      cycle: "00000000-0000-4000-8000-000000006401",
      manager: "00000000-0000-4000-8000-000000006402",
      evaluator: "00000000-0000-4000-8000-000000006403",
      response: "00000000-0000-4000-8000-000000006404",
      criteria: Array.from(
        { length: 5 },
        (_, index) => `00000000-0000-4000-8000-${String(6405 + index).padStart(12, "0")}`,
      ),
    };
    const staleCycle = {
      id: ids.cycle,
      managerId: ids.manager,
      visibilityMode: "IDENTIFIED",
      eligibilities: [
        {
          evaluatorId: ids.evaluator,
          state: "ELIGIBLE_PENDING",
          evaluator: { displayName: "Private Employee" },
          response: null,
        },
      ],
    };
    const response = {
      id: ids.response,
      cycleId: ids.cycle,
      managerId: ids.manager,
      evaluatorId: ids.evaluator,
      visibilityMode: "IDENTIFIED",
      submittedAt: new Date("2026-08-07T12:00:00.000Z"),
      evaluator: { displayName: "Private Employee" },
      criterionResponses: ids.criteria.map((criterionId) => ({
        criterionId,
        rating: 3,
        comment: "Private original comment",
      })),
    };
    const currentCycle = {
      ...staleCycle,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-10-01T00:00:00.000Z"),
      eligibilities: [
        {
          evaluatorId: ids.evaluator,
          state: "SUBMITTED",
          evaluator: { displayName: "Private Employee" },
          response: { id: ids.response, submittedAt: response.submittedAt },
        },
      ],
      responses: [response],
      summaryRevisions: [],
    };
    const transaction = {
      managerEvaluationCycle: { findUnique: vi.fn(async () => currentCycle) },
      managerEvaluationSummarySource: { findMany: vi.fn(async () => []) },
    };
    const transact = vi.fn(
      async (work: (value: typeof transaction) => Promise<unknown>) => work(transaction),
    );
    const auditAppend = vi.fn(async () => ({ id: crypto.randomUUID() }));
    const service = new IdentifiedProjectionPolicy(
      {
        managerEvaluationCycle: { findUnique: vi.fn(async () => staleCycle) },
        $transaction: transact,
      } as never,
      { append: auditAppend } as never,
      () => new Date("2026-08-07T12:05:00.000Z"),
    );

    await expect(
      service.readManagerCycle({ cycleId: ids.cycle, managerId: ids.manager, reason: "Review" }),
    ).resolves.toMatchObject({
      completion: { submitted: 1, pending: 0 },
      responses: [{ responseId: ids.response }],
    });
    expect(transact).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
    expect(JSON.stringify(auditAppend.mock.calls)).not.toContain("Private original comment");
  });
});
