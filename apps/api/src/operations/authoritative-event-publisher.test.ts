import { describe, expect, it, vi } from "vitest";

import { AuthoritativeOperationsEventPublisher } from "./authoritative-event-publisher.js";

describe("AuthoritativeOperationsEventPublisher", () => {
  it("publishes due check-ins, reassignment cases, and actionable health from production results", async () => {
    const publish = vi.fn().mockResolvedValue({ id: "intent" });
    const database = {
      reassignmentQueueItem: {
        findMany: async () => [
          { caseId: "10000000-0000-4000-8000-000000000010", departmentId: "department" },
        ],
      },
      roleAssignment: {
        findMany: async () => [{ userId: "10000000-0000-4000-8000-000000000020" }],
      },
    };
    const publisher = new AuthoritativeOperationsEventPublisher(
      database as never,
      { publish } as never,
      () => new Date("2026-08-07T10:00:00.000Z"),
    );
    await publisher.publishDueCheckIns("10000000-0000-4000-8000-000000000001", [
      {
        workstreamId: "10000000-0000-4000-8000-000000000002",
        weekStartsAt: "2026-08-02T00:00:00.000Z",
        state: "required",
      },
    ] as never);
    await publisher.publishReassignments(["10000000-0000-4000-8000-000000000010"]);
    await publisher.publishHealth("10000000-0000-4000-8000-000000000030", {
      dependencies: [{ dependency: "QUEUE", state: "ACTION_REQUIRED" }],
    } as never);
    expect(publish).toHaveBeenCalledTimes(3);
    expect(publish.mock.calls.map(([event]) => event.type)).toEqual([
      "CHECK_IN_DUE",
      "REASSIGNMENT_REQUIRED",
      "SYSTEM_HEALTH_ACTION_REQUIRED",
    ]);
  });
});
