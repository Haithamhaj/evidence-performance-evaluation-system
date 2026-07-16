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
    expect(result.stderr).toContain("require-provider.ts.fixture");
    expect(result.stderr).toContain("generate.ts.fixture");
    expect(result.stderr).toContain("split-url.ts.fixture");
    expect(result.stderr).toContain("public-adapter.ts.fixture");
    expect(result.stderr).toContain("computed-import.ts.fixture");
    expect(result.stderr).toContain("computed-require.ts.fixture");
    expect(result.stderr).toContain("bracket-generate.ts.fixture");
    expect(result.stderr).toContain("aliased-generate.ts.fixture");
    expect(result.stderr).toContain("destructured-generate.ts.fixture");
    expect(result.stderr).toContain("client-generate.ts.fixture");
    expect(result.stderr).toContain("gateway-aliased-generate.ts.fixture");
    expect(result.stderr).toContain("gateway-destructured-generate.ts.fixture");
    expect(result.stderr).toContain("optional-generate.ts.fixture");
    expect(result.stderr).toContain("bind-generate.ts.fixture");
    expect(result.stderr).toContain("call-generate.ts.fixture");
    expect(result.stderr).toContain("reflect-generate.ts.fixture");
    expect(result.stderr).toContain("assignment-generate.ts.fixture");
    expect(result.stderr).toContain("destructured-assignment-generate.ts.fixture");
    expect(result.stderr).toContain("destructured-parameter-generate.ts.fixture");
    expect(result.stderr).toContain("reassigned-local-generate.ts.fixture");
    expect(result.stderr).toContain("object-pattern-reassigned-local-generate.ts.fixture");
    expect(result.stderr).toContain("array-pattern-reassigned-local-generate.ts.fixture");
    expect(result.stderr).toContain("nested-pattern-reassigned-local-generate.ts.fixture");
    expect(result.stderr).toContain("defaulted-pattern-reassigned-local-generate.ts.fixture");
    expect(result.stderr).toContain("defaulted-destructured-parameter-generate.ts.fixture");
    expect(result.stderr).toContain("nested-destructured-parameter-generate.ts.fixture");
    expect(result.stderr).toContain("nested-destructured-assignment-generate.ts.fixture");
    expect(result.stderr).toContain("opaque-wrapped-generate.ts.fixture");
    expect(result.stderr).toContain("rest-parameter-generate.ts.fixture");
    expect(result.stderr).toContain("parameter-shadow-generate.ts.fixture");
    expect(result.stderr).toContain("uninitialized-shadow-generate.ts.fixture");
    expect(result.stderr).toContain("compound-assignment-generate.ts.fixture");
    expect(result.stderr).toContain("iteration-write-generate.ts.fixture");
    expect(result.stderr).toContain("computed-key-shadow-outer-first.ts.fixture");
    expect(result.stderr).toContain("computed-key-shadow-inner-first.ts.fixture");
    expect(result.stderr).toContain("computed-import-shadow.ts.fixture");
    expect(result.stderr).toContain("computed-require-shadow.ts.fixture");
    expect(result.stderr).toContain("environment-provider-alias-shadow.ts.fixture");
    expect(result.stderr).toContain("apps/api/src/packages/ai-routing/escape.ts");
    expect(result.stderr).toContain("environment-provider-url.ts.fixture");
    expect(result.stderr).toContain("restricted-composition.ts.fixture");
    expect(result.stderr).toContain("relative-admin-composition.ts.fixture");
    expect(result.stderr).toContain("relative-route-config.ts.fixture");
    expect(result.stderr).toContain("normalized-admin-import.ts.fixture");
    expect(result.stderr).toContain("normalized-route-config-import.ts.fixture");
    expect(result.stderr).toContain("BOUNDARY_RESTRICTED_AI_COMPOSITION");
  });

  it("allows neutral provider integration inside packages/ai-routing", () => {
    const result = validate("tests/repository/fixtures/ai-provider-boundary/allowed");

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("BOUNDARIES VALID");
  });
});
