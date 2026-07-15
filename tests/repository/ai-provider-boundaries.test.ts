import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const validator = path.join(repositoryRoot, "scripts/validate-boundaries.mjs");

function validate(root: string) {
  return spawnSync(process.execPath, [validator, "--root", root], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

describe("AI provider boundary", () => {
  it("rejects provider SDK imports and direct provider HTTP routes outside ai-routing", () => {
    const result = validate("tests/repository/fixtures/ai-provider-boundary/forbidden");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BOUNDARY_DIRECT_AI_PROVIDER");
    expect(result.stderr).toContain("openai");
    expect(result.stderr).toContain("chat/completions");
  });

  it("allows neutral provider integration inside packages/ai-routing", () => {
    const result = validate("tests/repository/fixtures/ai-provider-boundary/allowed");

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("BOUNDARIES VALID");
  });
});
