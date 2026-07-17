import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { PrismaCriteriaPhaseSnapshotReader } from "./criteria-phase-snapshot-reader.js";

const ids = {
  request: "30000000-0000-4000-8000-000000000001",
  actor: "30000000-0000-4000-8000-000000000002",
  correlation: "30000000-0000-4000-8000-000000000003",
  document: "30000000-0000-4000-8000-000000000004",
  version: "30000000-0000-4000-8000-000000000005",
  readiness: "30000000-0000-4000-8000-000000000006",
  project: "30000000-0000-4000-8000-000000000007",
  organization: "30000000-0000-4000-8000-000000000008",
  department: "30000000-0000-4000-8000-000000000009",
  prompt: "30000000-0000-4000-8000-000000000010",
  schema: "30000000-0000-4000-8000-000000000011",
  proposal: "30000000-0000-4000-8000-000000000012",
  transition: "30000000-0000-4000-8000-000000000013",
  review: "30000000-0000-4000-8000-000000000014",
} as const;

function fixture(
  options: {
    replacement?: "owner" | "material";
    actorId?: string;
    auditCorrelation?: string;
    routeKey?: string;
    promptHash?: string;
    artifactPromptHash?: string;
    pinnedReadinessCheckId?: string;
  } = {},
) {
  const promptHash = options.promptHash ?? "a".repeat(64);
  const routeKey = options.routeKey ?? "criteria.generate.project";
  const row = {
    id: ids.request,
    kind: "criteria_project",
    state: "running",
    operationId: ids.request,
    documentId: ids.document,
    currentDocumentVersionId: ids.version,
    pinnedReadinessCheckId: options.pinnedReadinessCheckId ?? ids.readiness,
    pinnedProposalId: options.replacement === undefined ? null : ids.proposal,
    expectedAggregateVersion: 2,
    routeKey,
    promptArtifactId: ids.prompt,
    promptVersion: "criteria-generation.v2",
    promptHash,
    promptArtifact: {
      routeKey,
      version: "criteria-generation.v2",
      bodyHash: options.artifactPromptHash ?? promptHash,
    },
    outputSchemaArtifactId: ids.schema,
    outputSchemaVersion: "criteria-generation-output.v2",
    outputSchemaHash: "b".repeat(64),
    outputSchemaArtifact: {
      routeKey,
      version: "criteria-generation-output.v2",
      schemaHash: "b".repeat(64),
    },
    createdAt: new Date("2026-07-17T09:00:00.000Z"),
  };
  const feedback = options.replacement === "material" ? "Reviewed scope change" : "Clarify wording";
  const audit =
    options.replacement === undefined
      ? null
      : {
          eventType:
            options.replacement === "material"
              ? "dynamic_criteria.revision_requested"
              : "dynamic_criteria.generation_requested",
          safeDiff:
            options.replacement === "material"
              ? { comparisonReviewId: ids.review }
              : {},
        };
  const transaction = {
    documentAnalysisRequest: { findUnique: vi.fn(async () => row) },
    auditEvent: {
      findFirst: vi.fn(async ({ where }: any) =>
        audit !== null &&
        where.correlationId === (options.auditCorrelation ?? ids.correlation)
          ? audit
          : null,
      ),
    },
    dynamicCriteriaProposalTransition: {
      findFirst: vi.fn(async () =>
        options.replacement === "owner"
          ? { id: ids.transition, reason: feedback }
          : null,
      ),
    },
    documentComparisonReview: {
      findUnique: vi.fn(async () =>
        options.replacement === "material" ? { reason: feedback } : null,
      ),
    },
  };
  const documentReader = {
    getPrerequisitesIn: vi.fn(async () => ({
      documentId: ids.document,
      documentVersionId: ids.version,
      documentVersion: 2,
      readinessCheckId: ids.readiness,
      projectId: ids.project,
      workstreamId: null,
      sourceReferences: [`document-readiness:${ids.readiness}`],
    })),
  };
  const reviewReader = {
    snapshotIn: vi.fn(async () => ({
      kind: "project",
      resourceId: ids.project,
      projectId: ids.project,
      organizationId: ids.organization,
      departmentId: ids.department,
      primaryOwnerId: options.actorId ?? ids.actor,
      contributorIds: [],
    })),
  };
  return {
    feedback,
    reader: new PrismaCriteriaPhaseSnapshotReader(
      documentReader as never,
      reviewReader as never,
    ),
    transaction,
  };
}

describe("PrismaCriteriaPhaseSnapshotReader", () => {
  it("reconstructs initial generation only from immutable request-time pins", async () => {
    const test = fixture();
    await expect(
      test.reader.readIn(test.transaction as never, {
        requestId: ids.request,
        actorId: ids.actor,
        correlationId: ids.correlation,
      }),
    ).resolves.toMatchObject({
      request: {
        ownerId: ids.actor,
        documentVersionId: ids.version,
        readinessCheckId: ids.readiness,
        replacesProposalId: null,
        ownerFeedbackSource: null,
      },
      job: { ownerFeedbackSource: null, expectedSnapshotVersion: 2 },
    });
  });

  it.each([
    ["owner", "proposal_transition", ids.transition],
    ["material", "comparison_review", ids.review],
  ] as const)("reconstructs %s replacement feedback from its immutable source", async (
    replacement,
    kind,
    referenceId,
  ) => {
    const test = fixture({ replacement });
    const result = await test.reader.readIn(test.transaction as never, {
      requestId: ids.request,
      actorId: ids.actor,
      correlationId: ids.correlation,
    });
    expect(result?.job.ownerFeedbackSource).toEqual({
      kind,
      referenceId,
      sha256: createHash("sha256").update(test.feedback).digest("hex"),
    });
    expect(result?.job.materialComparisonReviewId).toBe(
      replacement === "material" ? ids.review : null,
    );
  });

  it.each([
    ["actor", { actorId: "30000000-0000-4000-8000-000000000099" }],
    [
      "correlation",
      {
        replacement: "material" as const,
        auditCorrelation: "30000000-0000-4000-8000-000000000099",
      },
    ],
    ["route", { routeKey: "criteria.generate.workstream" }],
    ["artifact hash", { artifactPromptHash: "f".repeat(64) }],
    [
      "pinned readiness",
      { pinnedReadinessCheckId: "30000000-0000-4000-8000-000000000099" },
    ],
  ])("fails closed for a mismatched %s pin", async (_label, options) => {
    const test = fixture(options);
    await expect(
      test.reader.readIn(test.transaction as never, {
        requestId: ids.request,
        actorId: ids.actor,
        correlationId: ids.correlation,
      }),
    ).resolves.toBeNull();
  });
});
