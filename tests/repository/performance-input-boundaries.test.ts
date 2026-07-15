import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const scanner = path.join(repositoryRoot, "scripts/scan-performance-inputs.mjs");

function scan(fixture: string) {
  return spawnSync(process.execPath, [scanner, fixture], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

describe("performance input boundary scanner", () => {
  it("rejects raw activity and project counts from a performance input", () => {
    const result = scan("tests/repository/fixtures/performance-input-bad.ts.fixture");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("commitCount");
    expect(result.stderr).toContain("pullRequestCount");
    expect(result.stderr).toContain("checkCount");
    expect(result.stderr).toContain("activityCount");
    expect(result.stderr).toContain("projectCount");
  });

  it("accepts criterion, selected rating, and evidence references", () => {
    const result = scan("tests/repository/fixtures/performance-input-good.ts.fixture");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PERFORMANCE INPUTS VALID");
  });

  it("detects forbidden counts from a nested evaluation path", () => {
    const result = spawnSync(
      process.execPath,
      [scanner, "--root", "tests/repository/fixtures/scanner-root"],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("evaluation/input.ts.fixture:projectCount");
  });
});
