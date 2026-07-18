import { describe, expect, it } from "vitest";

import { workerHealthPort } from "./worker-health-port.js";

describe("workerHealthPort", () => {
  it("uses a default distinct from the API default", () => {
    expect(workerHealthPort({})).toBe(3002);
  });

  it("accepts an explicit valid worker health port", () => {
    expect(workerHealthPort({ WORKER_HEALTH_PORT: "4101" })).toBe(4101);
  });

  it.each(["not-a-port", "0", "65536"])("rejects invalid WORKER_HEALTH_PORT %s", (value) => {
    expect(() => workerHealthPort({ WORKER_HEALTH_PORT: value })).toThrow(
      "WORKER_HEALTH_PORT must be a valid TCP port",
    );
  });
});
