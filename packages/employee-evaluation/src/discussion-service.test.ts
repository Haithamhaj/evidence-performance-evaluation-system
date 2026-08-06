import { describe, expect, it, vi } from "vitest";

import { EvaluationDiscussionService } from "./discussion-service.js";

describe("EvaluationDiscussionService", () => {
  it("adds a versioned, audited discussion entry using only submitted sources", async () => {
    const assignmentId = crypto.randomUUID();
    const actorId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const create = vi.fn(async ({ data }) => ({
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date("2026-08-06T12:00:00Z"),
    }));
    const transaction = {
      evaluationDiscussionEntry: { findUnique: vi.fn(async () => null), create },
      evaluationAssignment: {
        findUnique: vi.fn(async () => ({
          id: assignmentId,
          employeeId: actorId,
          managerId: crypto.randomUUID(),
          cycleId: crypto.randomUUID(),
          version: 1,
          cycle: { state: "COMPARISON" },
          submissions: [
            {
              revision: {
                entries: [
                  {
                    criterionId: crypto.randomUUID(),
                    rating: 3,
                    justification: "Employee judgment.",
                    sourceReferences: [sourceId],
                    directObservationBasis: null,
                  },
                ],
              },
            },
            {
              revision: {
                entries: [
                  {
                    criterionId: crypto.randomUUID(),
                    rating: 3,
                    justification: "Manager judgment.",
                    sourceReferences: [sourceId],
                    directObservationBasis: "Observed during the cycle.",
                  },
                ],
              },
            },
          ],
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const audit = { append: vi.fn(async () => ({ id: crypto.randomUUID() })) };
    const database = { $transaction: async (work: (tx: unknown) => unknown) => work(transaction) };
    const service = new EvaluationDiscussionService(database as never, audit as never);

    await expect(
      service.add({
        schemaVersion: 1,
        assignmentId,
        actorId,
        body: "We clarified the source-supported delivery constraint.",
        sourceReferences: [sourceId],
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).resolves.toMatchObject({ assignmentId, actorId, resultingVersion: 2 });
    expect(create).toHaveBeenCalledOnce();
    expect(audit.append).toHaveBeenCalledOnce();
  });
});
