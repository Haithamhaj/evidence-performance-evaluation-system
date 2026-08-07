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
});
