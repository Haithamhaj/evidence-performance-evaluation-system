import { describe, expect, it } from "vitest";

import { ExportGenerationJobSchema, ExportManifestSchema, ExportStateSchema } from "./reporting.js";

const validManifest = {
  schemaVersion: 1,
  id: "10000000-0000-4000-8000-000000000001",
  requestId: "10000000-0000-4000-8000-000000000002",
  reportType: "EMPLOYEE_EVALUATION",
  audience: "EMPLOYEE_SELF",
  format: "PDF",
  locale: "en",
  projectionVersion: 1,
  rendererVersion: 1,
  cycleId: "10000000-0000-4000-8000-000000000003",
  sourceVersions: [{ source: "employee-evaluation", snapshotId: "snapshot-1", version: 1 }],
  createdAt: "2026-08-07T08:00:00.000Z",
};

describe("reporting contracts", () => {
  it("accepts export lifecycle states", () => {
    expect(ExportStateSchema.parse("READY")).toBe("READY");
  });

  it("rejects transient signed URLs in immutable manifests", () => {
    expect(() =>
      ExportManifestSchema.parse({ ...validManifest, signedUrl: "https://example.invalid/secret" }),
    ).toThrow();
  });

  it("accepts only the bounded versioned asynchronous generation job", () => {
    expect(
      ExportGenerationJobSchema.parse({
        schemaVersion: 1,
        jobType: "reporting.generate",
        requestId: "10000000-0000-4000-8000-000000000002",
        requesterId: "10000000-0000-4000-8000-000000000004",
        correlationId: "10000000-0000-4000-8000-000000000005",
      }),
    ).toMatchObject({ jobType: "reporting.generate", schemaVersion: 1 });
  });
});
