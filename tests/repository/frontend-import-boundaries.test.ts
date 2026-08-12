import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const validator = path.join(repositoryRoot, "scripts/validate-frontend-import-boundaries.mjs");

function validate(root: string) {
  return spawnSync(process.execPath, [validator, "--root", root], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

describe("frontend import boundaries", () => {
  it("rejects every prohibited frontend, telemetry, and provider direction", () => {
    const result = validate("tests/repository/fixtures/frontend-boundaries/invalid");

    expect(result.status).toBe(1);
    for (const code of [
      "FRONTEND_FEATURE_INTERNAL",
      "FRONTEND_GENERIC_UI_PRODUCT",
      "FRONTEND_PRODUCT_UI_SERVER",
      "FRONTEND_CLIENT_SERVER",
      "FRONTEND_ROUTE_PERSISTENCE",
      "FRONTEND_TELEMETRY_AUTHORITY",
      "FRONTEND_TELEMETRY_PROTECTED_IMPORT",
      "BOUNDARY_DIRECT_AI_PROVIDER",
    ]) {
      expect(result.stderr).toContain(code);
    }
    expect(result.stderr).toContain("client-dynamic.tsx");
    expect(result.stderr).toContain("evaluations/page.tsx");
    expect(result.stderr).toContain("illegal-experience-event.ts");
    expect(result.stderr).toContain("illegal-work-signal.ts");
    expect(result.stderr).toContain("protected-document.ts");
  });

  it("allows public contracts, localization, UI primitives, and safe composition", () => {
    const result = validate("tests/repository/fixtures/frontend-boundaries/valid");

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("FRONTEND BOUNDARIES VALID");
  });
});
