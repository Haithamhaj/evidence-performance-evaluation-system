import { describe, expect, it } from "vitest";

import { AnalysisCriteriaJobPayloadSchema } from "./analysis-criteria-jobs.js";

const requestId = "00000000-0000-4000-8000-000000000001";
const documentVersionId = "00000000-0000-4000-8000-000000000002";
const schemaArtifactId = "00000000-0000-4000-8000-000000000003";
const promptArtifactId = "00000000-0000-4000-8000-000000000004";
const hash = "a".repeat(64);

const artifactPins = {
  schemaArtifactId,
  schemaArtifactHash: hash,
  promptArtifactId,
  promptArtifactHash: hash,
  expectedSnapshotVersion: 1,
};

describe("analysis and criteria job contracts", () => {
  it("accepts opaque ID-and-hash-only readiness work", () => {
    expect(
      AnalysisCriteriaJobPayloadSchema.parse({
        type: "document.readiness.v1",
        requestId,
        documentVersionId,
        ...artifactPins,
      }),
    ).toMatchObject({ type: "document.readiness.v1", requestId });
  });

  it("pins both immutable versions for comparison", () => {
    expect(
      AnalysisCriteriaJobPayloadSchema.parse({
        type: "document.comparison.v1",
        requestId,
        beforeDocumentVersionId: documentVersionId,
        afterDocumentVersionId: "00000000-0000-4000-8000-000000000005",
        ...artifactPins,
      }),
    ).toMatchObject({ type: "document.comparison.v1" });
  });

  it("pins readiness and optional replacement proposal for criteria generation", () => {
    expect(
      AnalysisCriteriaJobPayloadSchema.parse({
        type: "criteria.generate.v1",
        kind: "workstream",
        requestId,
        documentVersionId,
        readinessCheckId: "00000000-0000-4000-8000-000000000006",
        replacesProposalId: "00000000-0000-4000-8000-000000000007",
        ...artifactPins,
      }),
    ).toMatchObject({ type: "criteria.generate.v1", kind: "workstream" });
  });

  it.each(["content", "bytes", "url", "comment", "secret", "employeeReadiness"])(
    "rejects private or mutable field %s",
    (field) => {
      expect(() =>
        AnalysisCriteriaJobPayloadSchema.parse({
          type: "document.readiness.v1",
          requestId,
          documentVersionId,
          ...artifactPins,
          [field]: "must not enter the queue",
        }),
      ).toThrow();
    },
  );
});
