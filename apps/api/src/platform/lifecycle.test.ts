import { describe, expect, it, vi } from "vitest";

import { enableGracefulShutdown } from "./lifecycle.js";

describe("API application lifecycle", () => {
  it("enables Nest shutdown hooks", () => {
    const app = { enableShutdownHooks: vi.fn() };

    enableGracefulShutdown(app);

    expect(app.enableShutdownHooks).toHaveBeenCalledTimes(1);
  });
});
