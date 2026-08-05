import { describe, expect, it } from "vitest";

import {
  CreateResearchSourceReviewInputSchema,
  ExperimentStateSchema,
  RecordExperimentRunInputSchema,
  ResearchScopeSchema,
  ResearchSourceReviewOutputSchema,
  ResearchSourceReviewStateSchema,
  ResearchStateSchema,
  ReviseExperimentMethodInputSchema,
} from "./research-experiments.js";

const ids = {
  projectId: "11111111-1111-4111-8111-111111111111",
  workstreamId: "22222222-2222-4222-8222-222222222222",
  workItemId: "33333333-3333-4333-8333-333333333333",
  researchId: "44444444-4444-4444-8444-444444444444",
  experimentId: "55555555-5555-4555-8555-555555555555",
  methodRevisionId: "66666666-6666-4666-8666-666666666666",
  testCaseId: "77777777-7777-4777-8777-777777777777",
};

const scope = {
  projectId: ids.projectId,
  workstreamId: null,
  workItemId: null,
};

describe("Research & Experiments contracts", () => {
  it("preserves the approved research, experiment, and source-review lifecycles", () => {
    expect(ResearchStateSchema.options).toEqual([
      "DRAFT",
      "ACTIVE",
      "CONCLUDED",
      "CANCELLED",
      "SUPERSEDED",
    ]);
    expect(ExperimentStateSchema.options).toEqual([
      "DRAFT",
      "READY",
      "RUNNING",
      "RESULT_RECORDED",
      "CONCLUDED",
      "ABANDONED",
      "SUPERSEDED",
    ]);
    expect(ResearchSourceReviewStateSchema.options).toEqual([
      "PENDING_RETRIEVAL",
      "READY_FOR_REVIEW",
      "PARTIAL",
      "BLOCKED",
      "CONFIRMED",
      "DISMISSED",
      "STALE",
    ]);
  });

  it("requires one Project while allowing an optional Workstream and Work Item", () => {
    expect(ResearchScopeSchema.parse(scope)).toEqual(scope);
    expect(
      ResearchScopeSchema.parse({
        projectId: ids.projectId,
        workstreamId: ids.workstreamId,
        workItemId: ids.workItemId,
      }),
    ).toMatchObject({ projectId: ids.projectId });
    expect(() => ResearchScopeSchema.parse({ workstreamId: null, workItemId: null })).toThrow();
    expect(() => ResearchScopeSchema.parse({ ...scope, ownerId: ids.researchId })).toThrow();
  });

  it("accepts only strict, bounded source-review inputs", () => {
    expect(
      CreateResearchSourceReviewInputSchema.parse({
        scope,
        idempotencyKey: "88888888-8888-4888-8888-888888888888",
        source: { kind: "URL", url: "https://example.com/research" },
      }),
    ).toMatchObject({ source: { kind: "URL" } });
    expect(() =>
      CreateResearchSourceReviewInputSchema.parse({
        scope,
        idempotencyKey: "88888888-8888-4888-8888-888888888888",
        source: { kind: "URL", url: `https://example.com/${"a".repeat(2_000)}` },
      }),
    ).toThrow();
    expect(() =>
      CreateResearchSourceReviewInputSchema.parse({
        scope,
        idempotencyKey: "88888888-8888-4888-8888-888888888888",
        source: { kind: "CONNECTED_CONTEXT", sourceItemId: ids.workItemId, rating: 5 },
      }),
    ).toThrow();
  });

  it("requires cited, strict source-review output and rejects rating output", () => {
    expect(() =>
      ResearchSourceReviewOutputSchema.parse({
        schemaVersion: "research-source-review-output.v1",
        summary: "Useful retrieval approach.",
        relevance: "May reduce retrieval latency for this Project.",
        citations: [],
        benefits: [],
        risks: [],
        mismatches: [],
        uncertainties: [],
        disposition: "DRAFT_EXPERIMENT",
        proposals: [],
        suggestedRating: 5,
      }),
    ).toThrow();
    expect(
      ResearchSourceReviewOutputSchema.parse({
        schemaVersion: "research-source-review-output.v1",
        summary: "Useful retrieval approach.",
        relevance: "May reduce retrieval latency for this Project.",
        citations: [{ sourceReference: "retrieval:00000001", locator: "README#benchmark" }],
        benefits: ["Could shorten one bounded retrieval path."],
        risks: ["Benchmark conditions may not match the Project."],
        mismatches: [],
        uncertainties: ["Production latency is not available from the source."],
        disposition: "DRAFT_EXPERIMENT",
        proposals: [],
      }),
    ).toMatchObject({ disposition: "DRAFT_EXPERIMENT" });
  });

  it("normalizes experiment measures and retains non-volume run observations", () => {
    const method = ReviseExperimentMethodInputSchema.parse({
      expectedVersion: 1,
      question: "Does the retrieval change reduce p95 latency?",
      baseline: {
        description: "Current retrieval path",
        value: "120",
        sourceReference: "run:baseline",
      },
      measures: [
        {
          stableId: "p95_latency_ms",
          name: "p95 latency",
          kind: "NUMERIC",
          unit: "ms",
          direction: "LOWER",
          baselineValue: "120",
          baselineReference: "run:baseline",
          interpretationRule: "Lower than the baseline is favorable.",
        },
      ],
      testCases: [
        {
          id: ids.testCaseId,
          inputIdentity: "retrieval-benchmark-v1",
          expectedObservation: "A p95 latency observation is recorded.",
          category: "benchmark",
          inclusionReason: "Represents the selected bounded sample.",
        },
      ],
      controls: [
        { comparisonTarget: "Current retrieval path", constantConditions: "Same bounded sample." },
      ],
      conditions: ["Same environment and selected sample."],
      reproducibilityInstructions: "Run the selected benchmark with the recorded configuration.",
      knownRisks: [],
      failureCases: [],
      sourceReferences: ["document_version:00000001"],
      executionMode: "manual",
    });

    expect(method.measures[0]).toMatchObject({ stableId: "p95_latency_ms", direction: "LOWER" });
    expect(() =>
      ReviseExperimentMethodInputSchema.parse({
        ...method,
        measures: [{ ...method.measures[0], score: 99 }],
      }),
    ).toThrow();
    expect(
      RecordExperimentRunInputSchema.parse({
        expectedVersion: 1,
        methodRevisionId: ids.methodRevisionId,
        startedAt: "2026-08-05T09:00:00.000Z",
        completedAt: "2026-08-05T09:05:00.000Z",
        resultStatus: "COMPLETED",
        environment: [{ name: "runtime", value: "node-24" }],
        inputs: [{ name: "sample", value: "retrieval-benchmark-v1" }],
        modelConfigurations: [],
        observations: [
          {
            measureStableId: "p95_latency_ms",
            testCaseId: ids.testCaseId,
            observedValue: "98",
            unit: "ms",
            note: "Measured on the bounded sample.",
          },
        ],
        unexpectedConditions: [],
        executionNotes: "Completed without an observed interruption.",
        sourceReferences: ["run:00000001"],
      }),
    ).toMatchObject({ resultStatus: "COMPLETED" });
  });
});
