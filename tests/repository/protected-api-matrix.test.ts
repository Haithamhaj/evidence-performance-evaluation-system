import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { validateProtectedApiMatrix } from "../../scripts/validate-protected-api-matrix.mjs";

describe("protected API matrix", () => {
  it("classifies every API controller and records allow, deny, and audit evidence", async () => {
    const result = await validateProtectedApiMatrix(process.cwd());

    expect(result.uncoveredProtectedRoutes).toEqual([]);
    expect(result.missingEvidence).toEqual([]);
    expect(
      result.matrix
        .filter((row) => row.classification === "PROTECTED")
        .every((row) => row.allowTest && row.denyTest && row.auditRule),
    ).toBe(true);
  });

  it("rejects a new API route that only matches the authenticated API root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "protected-api-matrix-"));
    try {
      const controllerDirectory = path.join(root, "apps/api/src/unclassified");
      await mkdir(controllerDirectory, { recursive: true });
      await writeFile(
        path.join(controllerDirectory, "unclassified.controller.ts"),
        'Controller("api/v1/unclassified")(UnclassifiedController);\n',
      );

      const result = await validateProtectedApiMatrix(root);

      expect(result.uncoveredProtectedRoutes).toEqual([
        expect.objectContaining({ route: "api/v1/unclassified" }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
