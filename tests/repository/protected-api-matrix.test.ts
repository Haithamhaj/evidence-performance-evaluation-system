import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  hasSemanticEvidenceTest,
  validateProtectedApiMatrix,
} from "../../scripts/validate-protected-api-matrix.mjs";

describe("protected API matrix", () => {
  it("classifies every API controller and records allow, deny, and audit evidence", async () => {
    const result = await validateProtectedApiMatrix(process.cwd());

    expect(result.uncoveredProtectedRoutes).toEqual([]);
    expect(result.missingEvidence).toEqual([]);
    expect(result.invalidEvidence).toEqual([]);
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

  it("does not accept unrelated imports or vocabulary outside an asserted test case", () => {
    const unrelatedImport = `
      import { databaseAuditWriter } from "@evaluation/audit";
      it("creates a document", () => {
        expect({ status: 201 }).toMatchObject({ status: 201 });
      });
    `;
    const persistedAuditAssertion = `
      it("persists the protected audit event", async () => {
        const event = await client.auditEvent.findFirstOrThrow({ where: { eventType: "x" } });
        expect(event.eventType).toBe("x");
      });
    `;

    expect(hasSemanticEvidenceTest(unrelatedImport, "PERSISTED_EVENT")).toBe(false);
    expect(hasSemanticEvidenceTest(persistedAuditAssertion, "PERSISTED_EVENT")).toBe(true);
  });
});
