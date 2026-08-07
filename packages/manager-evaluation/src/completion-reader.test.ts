import { describe, expect, it, vi } from "vitest";

import { IdentifiedCompletionReader } from "./completion-reader.js";

const cycleId = "00000000-0000-4000-8000-000000006301";
const managerId = "00000000-0000-4000-8000-000000006302";
const evaluatorId = "00000000-0000-4000-8000-000000006303";
const responseId = "00000000-0000-4000-8000-000000006304";

describe("identified completion read audit", () => {
  it("reads and audits one repeatable snapshot without placing identity content in audit", async () => {
    const cycle = {
      id: cycleId,
      managerId,
      visibilityMode: "IDENTIFIED",
      eligibilities: [
        {
          evaluatorId,
          state: "SUBMITTED",
          evaluator: { displayName: "Private Employee Name" },
          response: { id: responseId, submittedAt: new Date("2026-08-07T12:00:00.000Z") },
        },
      ],
    };
    const transaction = {
      managerEvaluationCycle: { findUnique: vi.fn(async () => cycle) },
    };
    const transact = vi.fn(
      async (work: (value: typeof transaction) => Promise<unknown>) => work(transaction),
    );
    const auditAppend = vi.fn(async () => ({ id: crypto.randomUUID() }));
    const reader = new IdentifiedCompletionReader(
      { managerEvaluationCycle: transaction.managerEvaluationCycle, $transaction: transact } as never,
      () => new Date("2026-08-07T12:05:00.000Z"),
      { append: auditAppend } as never,
    );

    await expect(reader.read({ cycleId, managerId })).resolves.toMatchObject({
      submitted: 1,
      pending: 0,
    });
    expect(transact).toHaveBeenCalledTimes(1);
    expect(auditAppend).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        eventType: "manager_evaluation.completion.read",
        safeDiff: {
          visibilityMode: "IDENTIFIED",
          eligible: 1,
          submitted: 1,
          pending: 0,
          approvedLeave: 0,
          postponed: 0,
          excluded: 0,
        },
      }),
    );
    expect(JSON.stringify(auditAppend.mock.calls)).not.toContain("Private Employee Name");
  });
});
