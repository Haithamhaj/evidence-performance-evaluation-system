import { describe, expect, it } from "vitest";

import { apiPort } from "./api-port.js";

describe("API listen port", () => {
  it("defaults to the separate local API port", () => {
    expect(apiPort({})).toBe(3001);
  });

  it("accepts a configured TCP port", () => {
    expect(apiPort({ API_PORT: "4100" })).toBe(4100);
  });

  it.each(["not-a-port", "0", "65536"])("rejects invalid API_PORT %s", (value) => {
    expect(() => apiPort({ API_PORT: value })).toThrow("API_PORT must be a valid TCP port");
  });
});
