import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("AI-native frontend capability coverage", () => {
  it("matches the authoritative 44 engine records", () => {
    expect(() =>
      execFileSync("node", ["scripts/validate-ai-native-frontend-capabilities.mjs"], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
