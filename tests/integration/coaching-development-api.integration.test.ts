import { describe, expect, it } from "vitest";

import { CoachingActionsController } from "../../apps/api/src/coaching-development/actions.controller.js";

describe("coaching development API boundary", () => {
  it("does not let a manager force an employee action transition", async () => {
    const controller = new CoachingActionsController(
      {
        read: async () => ({}),
        transition: async () => {
          const error = new Error("forbidden");
          Object.assign(error, { code: "AUTHZ_ACTION" });
          throw error;
        },
      } as never,
      { append: async () => ({}) } as never,
    );
    await expect(
      controller.transition(
        { principal: { userId: "10000000-0000-4000-8000-000000000001", active: true }, params: {} },
        { actionId: "10000000-0000-4000-8000-000000000002", toState: "COMPLETED" },
      ),
    ).rejects.toMatchObject({ code: "AUTHZ_ACTION" });
  });
});
