import { describe, expect, it } from "vitest";

import { createEngineSignal } from "./engine-signals.js";

describe("engine signals", () => {
  it("keeps bounded operational fields without private labels", () => {
    expect(
      createEngineSignal({
        kind: "AI_ROUTE",
        state: "DEGRADED",
        observedAt: "2026-08-07T00:00:00.000Z",
        correlationId: "00000000-0000-4000-8000-000000007101",
        latencyMs: 425,
        failureCount: 2,
        labels: { route: "update.structure", employee: "must-not-pass" },
      }),
    ).toEqual({
      schemaVersion: 1,
      kind: "AI_ROUTE",
      state: "DEGRADED",
      observedAt: "2026-08-07T00:00:00.000Z",
      correlationId: "00000000-0000-4000-8000-000000007101",
      latencyMs: 425,
      failureCount: 2,
      labels: { route: "update.structure" },
    });
  });
});
