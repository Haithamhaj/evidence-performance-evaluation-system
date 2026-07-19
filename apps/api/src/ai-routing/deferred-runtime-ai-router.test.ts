import { describe, expect, it, vi } from "vitest";

import { createDeferredRuntimeAiRouter } from "./deferred-runtime-ai-router.js";

describe("createDeferredRuntimeAiRouter", () => {
  it("does not compose governed provider adapters until an AI request is made", async () => {
    const run = vi.fn().mockResolvedValue({ output: { summary: "ready" } });
    const factory = vi.fn().mockResolvedValue({ run });
    const router = createDeferredRuntimeAiRouter(factory);

    expect(factory).not.toHaveBeenCalled();

    await expect(router.run({ routeKey: "update.structure" } as never, vi.fn())).resolves.toEqual({
      output: { summary: "ready" },
    });
    expect(factory).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledOnce();
  });

  it("fails the feature request without preventing application startup", async () => {
    const failure = new Error("AI route is not configured");
    const router = createDeferredRuntimeAiRouter(vi.fn().mockRejectedValue(failure));

    await expect(
      router.run({ routeKey: "project.progress-contract.draft" } as never, vi.fn()),
    ).rejects.toBe(failure);
  });
});
