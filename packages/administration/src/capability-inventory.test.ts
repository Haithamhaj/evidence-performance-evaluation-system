import { describe, expect, it } from "vitest";

import { AdminCommandService } from "./admin-command-service.js";

describe("AdminCommandService capability inventory", () => {
  it("reports only wired owner commands as available without exposing implementation details", () => {
    const service = new AdminCommandService({} as never, {} as never, {
      AI_ROUTES_MANAGE: { execute: async () => ({}) as never },
    });

    const capabilities = service.capabilities();

    expect(capabilities.find(({ capability }) => capability === "AI_ROUTES_MANAGE")).toEqual({
      capability: "AI_ROUTES_MANAGE",
      available: true,
    });
    expect(capabilities.find(({ capability }) => capability === "USERS_MANAGE")).toEqual({
      capability: "USERS_MANAGE",
      available: false,
    });
    expect(JSON.stringify(capabilities)).not.toMatch(/execute|database|secret/iu);
  });
});
