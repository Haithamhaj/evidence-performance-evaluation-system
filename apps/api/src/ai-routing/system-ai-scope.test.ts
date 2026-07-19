import { describe, expect, it, vi } from "vitest";

import { resolveSystemAiScopeId } from "./system-ai-scope.js";

describe("resolveSystemAiScopeId", () => {
  it("uses the configured system route scope when the route exists", async () => {
    const findRoute = vi.fn().mockResolvedValue({ scopeId: "route-scope" });
    const findScope = vi.fn();

    await expect(
      resolveSystemAiScopeId(
        {
          aiRoute: { findFirst: findRoute },
          authorizationScope: { findUnique: findScope },
        },
        "project.progress-contract.draft",
      ),
    ).resolves.toBe("route-scope");
    expect(findScope).not.toHaveBeenCalled();
  });

  it("falls back to the canonical system scope when an optional route is not registered", async () => {
    const findRoute = vi.fn().mockResolvedValue(null);
    const findScope = vi.fn().mockResolvedValue({ id: "canonical-system-scope" });

    await expect(
      resolveSystemAiScopeId(
        {
          aiRoute: { findFirst: findRoute },
          authorizationScope: { findUnique: findScope },
        },
        "project.progress-contract.draft",
      ),
    ).resolves.toBe("canonical-system-scope");
  });

  it("still rejects startup when the canonical system scope itself is missing", async () => {
    await expect(
      resolveSystemAiScopeId(
        {
          aiRoute: { findFirst: vi.fn().mockResolvedValue(null) },
          authorizationScope: { findUnique: vi.fn().mockResolvedValue(null) },
        },
        "project.progress-contract.draft",
      ),
    ).rejects.toThrow("The canonical system authorization scope is not configured");
  });
});
