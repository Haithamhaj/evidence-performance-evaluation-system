import { describe, expect, it, vi } from "vitest";

import { ContinuityExperienceQueryService } from "./continuity-experience-query.service.js";

describe("ContinuityExperienceQueryService", () => {
  it("returns the manager queue without handover body content", async () => {
    const source = {
      load: vi.fn(async () => ({
        mode: "manager" as const,
        leaves: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            employeeId: "20000000-0000-4000-8000-000000000002",
            employeeName: "Codex",
            state: "SUBMITTED" as const,
            startsAt: "2026-08-20T00:00:00.000Z",
            endsAt: "2026-08-22T00:00:00.000Z",
            affectedScopeCount: 1,
            version: 1,
            handover: null,
          },
        ],
        availableScopes: [],
      })),
    };
    const service = new ContinuityExperienceQueryService(
      source,
      () => new Date("2026-08-15T08:00:00Z"),
    );

    const result = await service.load("20000000-0000-4000-8000-000000000003");

    expect(result.mode).toBe("manager");
    expect(result.leaves[0]?.state).toBe("SUBMITTED");
    expect(JSON.stringify(result)).not.toContain("completedWork");
    expect(JSON.stringify(result)).not.toContain("blockersAndRisks");
  });
});
