import { describe, expect, it, vi } from "vitest";

import { ManagerCoachingQueryService } from "./manager-coaching-query.service.js";

describe("ManagerCoachingQueryService", () => {
  it("returns only employee-shared actions and formal plans", async () => {
    const source = {
      load: vi.fn(async () => ({
        sharedActions: [
          {
            id: "10000000-0000-4000-8000-000000000001",
            employeeId: "10000000-0000-4000-8000-000000000002",
            employeeName: "Codex",
            state: "ACTIVE",
            title: "Improve release handoff",
            objective: "Make the next release easier to continue",
            targetDate: null,
            updatedAt: "2026-08-15T07:00:00.000Z",
          },
        ],
        formalPlans: [],
      })),
    };
    const service = new ManagerCoachingQueryService(source, () => new Date("2026-08-15T08:00:00Z"));

    const result = await service.load("10000000-0000-4000-8000-000000000003");

    expect(result.boundary).toBe("shared_and_formal_only");
    expect(result.sharedActions[0]?.title).toBe("Improve release handoff");
    expect(JSON.stringify(result)).not.toContain("privateReason");
    expect(JSON.stringify(result)).not.toContain("employeeSelectedContext");
  });
});
