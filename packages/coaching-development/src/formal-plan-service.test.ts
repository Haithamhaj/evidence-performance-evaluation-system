import { describe, expect, it } from "vitest";

import { FormalDevelopmentPlanService } from "./formal-plan-service.js";

const employeeId = "10000000-0000-4000-8000-000000000001";
const managerId = "10000000-0000-4000-8000-000000000002";
const planId = "10000000-0000-4000-8000-000000000003";

describe("FormalDevelopmentPlanService", () => {
  it("requires employee approval before a manager can activate a plan", async () => {
    const service = new FormalDevelopmentPlanService({
      find: async () => ({
        id: planId,
        employeeId,
        managerId,
        state: "DRAFT",
        version: 1,
        evidenceLinks: [],
      }),
      append: async () => undefined,
    });
    await expect(
      service.activate({
        planId,
        actorId: managerId,
        expectedVersion: 1,
        idempotencyKey: "10000000-0000-4000-8000-000000000004",
      }),
    ).rejects.toMatchObject({ code: "EMPLOYEE_APPROVAL_REQUIRED" });
  });
});
