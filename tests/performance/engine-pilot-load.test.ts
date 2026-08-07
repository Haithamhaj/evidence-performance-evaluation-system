import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { PrivateInboxQueryService } from "../../packages/work-items/src/inbox-query-service.js";

const employeeId = "10000000-0000-4000-8000-000000000001";

function p95(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

describe("pilot engine bounded read load", () => {
  it("keeps a representative authorized paginated My Work read under the 500ms p95 target", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      id: `10000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      employeeId,
      text: `Synthetic private item ${index}`,
      projectId: null,
      status: "open" as const,
      promotedWorkItemId: null,
      version: 1,
      createdAt: new Date("2026-08-07T00:00:00.000Z"),
      updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    }));
    const service = new PrivateInboxQueryService({
      privateInboxItem: { findMany: async () => rows },
    } as never);
    const durations: number[] = [];

    for (let index = 0; index < 100; index += 1) {
      const started = performance.now();
      const result = await service.list({
        actor: { userId: employeeId, active: true },
        input: { status: "open", cursor: null, limit: 50 },
      });
      durations.push(performance.now() - started);
      expect(result.items).toHaveLength(50);
      expect(result.nextCursor).not.toBeNull();
    }

    expect(p95(durations)).toBeLessThan(500);
  });
});
