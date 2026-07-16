import { describe, expect, it, vi } from "vitest";

import { ManagedAuthDatabaseClient } from "./auth-database.js";

describe("authentication database lifecycle", () => {
  it("disconnects the singleton client when the module is destroyed", async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const client = {
      $disconnect: disconnect,
      $transaction: vi.fn(),
    };
    const managed = new ManagedAuthDatabaseClient(client as never);

    await managed.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
