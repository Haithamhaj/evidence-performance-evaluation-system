import { describe, expect, it, vi } from "vitest";

import { ManagerEvaluationSubmissionService } from "./submission-service.js";

const ids = {
  cycle: "00000000-0000-4000-8000-000000006001",
  evaluator: "00000000-0000-4000-8000-000000006002",
  manager: "00000000-0000-4000-8000-000000006003",
  snapshot: "00000000-0000-4000-8000-000000006004",
  eligibility: "00000000-0000-4000-8000-000000006005",
  response: "00000000-0000-4000-8000-000000006006",
  idempotency: "00000000-0000-4000-8000-000000006007",
  criteria: Array.from(
    { length: 5 },
    (_, index) => `00000000-0000-4000-8000-${String(6100 + index).padStart(12, "0")}`,
  ),
} as const;

describe("manager evaluation submission server time", () => {
  it("rejects after the cycle closes even when the client confirmation is backdated", async () => {
    const harness = submissionHarness(new Date("2026-10-01T00:00:00.000Z"));

    await expect(harness.service.submit(input("2026-09-30T12:00:00.000Z"))).rejects.toMatchObject({
      code: "MANAGER_EVALUATION_CONFIRMATION_TIME_INVALID",
    });
    expect(harness.createResponse).not.toHaveBeenCalled();
  });

  it("stores the server receipt time rather than the client confirmation time", async () => {
    const serverNow = new Date("2026-08-07T15:30:00.000Z");
    const harness = submissionHarness(serverNow);

    await expect(harness.service.submit(input("2026-07-02T09:00:00.000Z"))).resolves.toMatchObject({
      submittedAt: serverNow.toISOString(),
    });
    expect(harness.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submittedAt: serverNow, visibleToManagerAt: serverNow }),
      }),
    );
  });
});

function input(confirmedAt: string) {
  return {
    schemaVersion: 1,
    cycleId: ids.cycle,
    evaluatorId: ids.evaluator,
    expectedVersion: 1,
    idempotencyKey: ids.idempotency,
    identifiedNoticeConfirmed: true,
    confirmedAt,
    responses: ids.criteria.map((criterionId) => ({ criterionId, rating: 3, comment: "" })),
  };
}

function submissionHarness(serverNow: Date) {
  const createResponse = vi.fn(async ({ data }: any) => ({
    id: ids.response,
    cycleId: data.cycleId,
    evaluatorId: data.evaluatorId,
    submittedAt: data.submittedAt,
  }));
  const transaction = {
    managerEvaluationResponse: {
      findUnique: vi.fn(async () => null),
      create: createResponse,
    },
    managerEvaluatorEligibility: {
      findUnique: vi.fn(async () => ({
        id: ids.eligibility,
        evaluatorId: ids.evaluator,
        state: "ELIGIBLE_PENDING",
        version: 1,
        evaluator: { active: true },
        cycle: {
          id: ids.cycle,
          managerId: ids.manager,
          state: "OPEN",
          visibilityMode: "IDENTIFIED",
          startsAt: new Date("2026-07-01T00:00:00.000Z"),
          endsAt: new Date("2026-10-01T00:00:00.000Z"),
          snapshot: {
            id: ids.snapshot,
            criteriaSnapshot: ids.criteria.map((criterionId) => ({
              criterionId,
              commentRequired: false,
            })),
          },
        },
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    managerEvaluatorEligibilityDecision: { create: vi.fn(async () => ({})) },
  };
  const database = {
    $transaction: vi.fn(async (work: (value: typeof transaction) => Promise<unknown>) =>
      work(transaction),
    ),
  };
  return {
    createResponse,
    service: new ManagerEvaluationSubmissionService(
      database as never,
      { append: vi.fn(async () => ({ id: crypto.randomUUID() })) } as never,
      () => new Date(serverNow),
    ),
  };
}
