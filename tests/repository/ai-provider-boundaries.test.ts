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
    expect(result.stderr).toContain("later-assignment-generate.ts.fixture");
    expect(result.stderr).toContain("later-assignment-generate-alias.ts.fixture");
    expect(result.stderr).toContain("later-assignment-import.ts.fixture");
    expect(result.stderr).toContain("later-assignment-require.ts.fixture");
    expect(result.stderr).toContain("later-assignment-provider-url.ts.fixture");
    expect(result.stderr).toContain("later-assignment-provider-env-alias.ts.fixture");
    expect(result.stderr).toContain("ambiguous-conditional-generate.ts.fixture");
    expect(result.stderr).toContain("ambiguous-loop-generate.ts.fixture");
    expect(result.stderr).toContain("ambiguous-try-generate.ts.fixture");
    expect(result.stderr).toContain("ambiguous-logical-generate.ts.fixture");
    expect(result.stderr).toContain("ambiguous-compound-generate.ts.fixture");
    expect(result.stderr).toContain("uninitialized-redeclaration-generate.ts.fixture");
    expect(result.stderr).toContain("ambiguous-provider-environment.ts.fixture");
    expect(result.stderr).toContain("ambiguous-provider-import.ts.fixture");
    expect(result.stderr).toContain("cross-function-later-generate.ts.fixture");
    expect(result.stderr).toContain("cross-function-later-provider.ts.fixture");
    expect(result.stderr).toContain("cross-function-call-between-writes.ts.fixture");
    expect(result.stderr).toContain("cross-function-mutation-generate.ts.fixture");
    expect(result.stderr).toContain("indirect-alias-call-before-safe.ts.fixture");
    expect(result.stderr).toContain("indirect-callback-before-safe.ts.fixture");
    expect(result.stderr).toContain("nested-wrapper-before-safe.ts.fixture");
    expect(result.stderr).toContain("nested-wrapper-provider-import-before-safe.ts.fixture");
    expect(result.stderr).toContain("nested-wrapper-provider-env-before-safe.ts.fixture");
    expect(result.stderr).toContain("indirect-bound-call-before-safe.ts.fixture");
    expect(result.stderr).toContain("indirect-object-property-call-before-safe.ts.fixture");
    expect(result.stderr).toContain("indirect-destructured-property-before-safe.ts.fixture");
    expect(result.stderr).toContain("indirect-array-element-before-safe.ts.fixture");
    expect(result.stderr).toContain("indirect-container-callback-before-safe.ts.fixture");
    expect(result.stderr).toContain("container-computed-import-before-safe.ts.fixture");
    expect(result.stderr).toContain("container-provider-env-before-safe.ts.fixture");
    expect(result.stderr).toContain("object-default-computed-generate-before-safe.ts.fixture");
    expect(result.stderr).toContain("array-default-import-before-safe.ts.fixture");
    expect(result.stderr).toContain("object-rest-provider-env-before-safe.ts.fixture");
    expect(result.stderr).toContain("object-rest-unknown-source.ts.fixture");
    expect(result.stderr).toContain("array-rest-import-before-safe.ts.fixture");
    expect(result.stderr).toContain("member-write-computed-generate-before-safe.ts.fixture");
    expect(result.stderr).toContain("array-write-import-before-safe.ts.fixture");
    expect(result.stderr).toContain("class-instance-provider-env-before-safe.ts.fixture");
    expect(result.stderr).toContain("known-callback-container-before-safe.ts.fixture");
    expect(result.stderr).toContain("optional-direct-call-before-safe.ts.fixture");
    expect(result.stderr).toContain("optional-container-call-before-safe.ts.fixture");
    expect(result.stderr).toContain("optional-nested-callback-before-safe.ts.fixture");
    expect(result.stderr).toContain("optional-callback-container-before-safe.ts.fixture");
    expect(result.stderr).toContain("prototype-alias-import-before-safe.ts.fixture");
    expect(result.stderr).toContain("prototype-mutation-generate-before-safe.ts.fixture");
    expect(result.stderr).toContain("computed-prototype-provider-env-before-safe.ts.fixture");
    expect(result.stderr).toContain("static-alias-import-before-safe.ts.fixture");
    expect(result.stderr).toContain("overwritten-freeze-alias-before-safe.ts.fixture");
    expect(result.stderr).toContain("overwritten-metadata-alias-before-safe.ts.fixture");
    expect(result.stderr).toContain("ambiguous-freeze-alias-before-safe.ts.fixture");
    expect(result.stderr).toContain("shadowed-freeze-before-safe.ts.fixture");
    expect(result.stderr).toContain("similarly-named-metadata-before-safe.ts.fixture");
    expect(result.stderr).toContain("class-dispatch-before-safe.ts.fixture");
    expect(result.stderr).toContain("prototype-alias-mutation-before-safe.ts.fixture");
    expect(result.stderr).toContain("ambiguous-prototype-alias-before-safe.ts.fixture");
    expect(result.stderr).toContain("unknown-class-inheritance.ts.fixture");
    expect(result.stderr).toContain("overwritten-global-freeze-before-safe.ts.fixture");
    expect(result.stderr).toContain("computed-overwritten-global-freeze-before-safe.ts.fixture");
    expect(result.stderr).toContain("freeze-alias-after-mutation-before-safe.ts.fixture");
    expect(result.stderr).toContain("ambiguous-global-freeze-mutation-before-safe.ts.fixture");
    expect(result.stderr).toContain("inherited-runtime-receiver-before-safe.ts.fixture");
    expect(result.stderr).toContain("super-runtime-receiver-before-safe.ts.fixture");
    expect(result.stderr).toContain("object-alias-freeze-write-before-safe.ts.fixture");
    expect(result.stderr).toContain("destructured-global-freeze-write-before-safe.ts.fixture");
    expect(result.stderr).toContain("destructured-prototype-write-before-safe.ts.fixture");
    expect(result.stderr).toContain("ambiguous-freeze-restoration-before-safe.ts.fixture");
    expect(result.stderr).toContain("explicit-instance-receiver-call-before-safe.ts.fixture");
    expect(result.stderr).toContain("bound-instance-receiver-before-safe.ts.fixture");
    expect(result.stderr).toContain("nested-lexical-arrow-receiver-before-safe.ts.fixture");
    expect(result.stderr).toContain("define-property-global-freeze-before-safe.ts.fixture");
    expect(result.stderr).toContain("reflect-set-global-freeze-before-safe.ts.fixture");
    expect(result.stderr).toContain("define-property-prototype-before-safe.ts.fixture");
    expect(result.stderr).toContain("define-properties-prototype-before-safe.ts.fixture");
    expect(result.stderr).toContain("explicit-instance-apply-before-safe.ts.fixture");
    expect(result.stderr).toContain("explicit-static-subclass-call-before-safe.ts.fixture");
    expect(result.stderr).toContain("reflect-apply-subclass-before-safe.ts.fixture");
    expect(result.stderr).toContain("optional-bound-subclass-before-safe.ts.fixture");
    expect(result.stderr).toContain("unknown-indirect-receiver.ts.fixture");
    expect(result.stderr).toContain("ambiguous-reflective-freeze-value.ts.fixture");
    expect(result.stderr).toContain("bounded-expansion-generate.ts.fixture");
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
