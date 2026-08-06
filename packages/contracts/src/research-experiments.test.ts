import { describe, expect, it } from "vitest";

import { EvaluationFactViewSchema } from "./evaluation-fact-view.js";

import {
  ConcludeExperimentInputSchema,
  ExperimentDetailSchema,
  CreateResearchSourceReviewInputSchema,
  ExperimentStateSchema,
  RecordExperimentRunInputSchema,
  ResearchDetailSchema,
  ResearchScopeSchema,
  ResearchSourceReviewDetailSchema,
  ResearchSourceReviewOutputSchema,
  ResearchSourceReviewStateSchema,
  ResearchStateSchema,
  ReviseExperimentMethodInputSchema,
  TransitionExperimentInputSchema,
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

const aiProvenance = {
  promptVersion: "research-source-review-prompt.v1",
  routeTrace: {
    aiRunId: "99999999-9999-4999-8999-999999999999",
    routeKey: "research.source-review.v1",
    routeConfigId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    routeConfigVersion: 1,
  },
} as const;

describe("Research & Experiments contracts", () => {
  it("keeps Research Fact View v2 source-supported and neutral", () => {
    const sourceId = crypto.randomUUID();
    const view = EvaluationFactViewSchema.parse({
      schemaVersion: 2,
      cycle: {
        id: crypto.randomUUID(),
        startsAt: "2026-08-01T00:00:00.000Z",
        endsAt: "2026-08-31T23:59:59.999Z",
        rubricVersionId: crypto.randomUUID(),
      },
      subjectEmployeeId: crypto.randomUUID(),
      generatedAt: "2026-09-01T00:00:00.000Z",
      responsibilityWindows: [],
      projectFacts: [],
      confirmedEvidence: [],
      checkInFacts: [],
      dynamicCriteriaVersions: [],
      employeeInterpretations: [],
      sourceCoverageNotes: [],
      researchFacts: [
        {
          kind: "source_fact",
          sourceType: "research",
          factType: "experiment_conclusion",
          sourceId,
          sourceOccurredAt: "2026-08-15T10:00:00.000Z",
          projectId: crypto.randomUUID(),
          workstreamId: null,
          relatedWorkItemId: null,
          humanConfirmationState: "human_decision",
          verificationState: "source_supported",
          responsibilityWindowIds: [],
          summary: "The result was confirmed.",
          limitations: ["Bounded sample"],
          uncertainty: null,
          sourceReferences: [
            {
              sourceType: "experiment_conclusion",
              sourceId,
              sourceVersion: null,
              occurredAt: "2026-08-15T10:00:00.000Z",
              url: null,
            },
          ],
        },
      ],
    });
    expect(view.schemaVersion).toBe(2);
    expect(view.researchFacts[0]?.factType).toBe("experiment_conclusion");
    expect(Object.keys(view)).toContain("researchFacts");
  });

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

  it("accepts only opaque source references in every persisted Research contract", () => {
    const reviewOutput = {
      schemaVersion: "research-source-review-output.v1",
      summary: "Useful retrieval approach.",
      relevance: "May reduce retrieval latency for this Project.",
      citations: [{ sourceReference: "retrieval:00000001", locator: "README#benchmark" }],
      benefits: [],
      risks: [],
      mismatches: [],
      uncertainties: [],
      disposition: "DRAFT_EXPERIMENT",
      proposals: [],
    } as const;

    expect(() =>
      ResearchSourceReviewOutputSchema.parse({
        ...reviewOutput,
        citations: [{ sourceReference: "https://private.example/repository", locator: "README" }],
      }),
    ).toThrow();
    expect(() =>
      ResearchSourceReviewOutputSchema.parse({
        ...reviewOutput,
        citations: [{ sourceReference: "token:00000001", locator: "README" }],
      }),
    ).toThrow();
    expect(() =>
      ReviseExperimentMethodInputSchema.parse({
        expectedVersion: 1,
        question: "Does the retrieval change reduce p95 latency?",
        baseline: {
          description: "Current retrieval path",
          value: "120",
          sourceReference: "https://private.example/baseline",
        },
        measures: [
          {
            stableId: "p95_latency_ms",
            name: "p95 latency",
            kind: "NUMERIC",
            unit: "ms",
            direction: "LOWER",
            baselineValue: "120",
            baselineReference: "run:00000001",
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
        controls: [],
        conditions: ["Same environment and selected sample."],
        reproducibilityInstructions: "Run the selected benchmark with the recorded configuration.",
        knownRisks: [],
        failureCases: [],
        sourceReferences: ["retrieval:00000001"],
        executionMode: "manual",
      }),
    ).toThrow();
  });

  it("requires AI provenance whenever a source review stores AI output", () => {
    const detail = {
      id: ids.researchId,
      scope,
      ownerId: ids.workItemId,
      state: "READY_FOR_REVIEW",
      version: 1,
      source: { kind: "URL", url: "https://example.com/research" },
      displayUrl: "https://example.com/research",
      retrievalState: "RETRIEVED",
      retrievalReason: null,
      contentFingerprint: "fingerprint-v1",
      output: {
        schemaVersion: "research-source-review-output.v1",
        summary: "Useful retrieval approach.",
        relevance: "May reduce retrieval latency for this Project.",
        citations: [{ sourceReference: "retrieval:00000001", locator: "README#benchmark" }],
        benefits: [],
        risks: [],
        mismatches: [],
        uncertainties: [],
        disposition: "DRAFT_EXPERIMENT",
        proposals: [],
      },
      outputProvenance: aiProvenance,
      recoveryOptions: [],
      createdAt: "2026-08-05T09:00:00.000Z",
      updatedAt: "2026-08-05T09:05:00.000Z",
    } as const;

    expect(ResearchSourceReviewDetailSchema.parse(detail)).toMatchObject({
      outputProvenance: aiProvenance,
    });
    const missingProvenance = { ...detail } as Record<string, unknown>;
    delete missingProvenance.outputProvenance;
    expect(() => ResearchSourceReviewDetailSchema.parse(missingProvenance)).toThrow();
  });

  it("requires AI provenance on AI Research and Experiment revision details", () => {
    const researchDetail = {
      id: ids.researchId,
      scope,
      ownerId: ids.workItemId,
      state: "DRAFT",
      revision: 1,
      version: 1,
      currentRevision: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        revision: 1,
        origin: "AI_DRAFT",
        authorId: ids.workItemId,
        aiProvenance,
        problemStatement: "Retrieval latency needs a bounded investigation.",
        context: "The Project has an existing retrieval path.",
        question: "Can the selected approach reduce latency?",
        objective: "Decide whether to run a bounded Experiment.",
        hypothesis: { kind: "TESTABLE", statement: "The selected approach lowers p95 latency." },
        assumptions: [],
        constraints: [],
        knownUncertainty: [],
        alternatives: [],
        decisionQuestion: "Should the Project run the Experiment?",
        sourceReferences: ["retrieval:00000001"],
        executionMode: "ai_assisted",
        createdAt: "2026-08-05T09:00:00.000Z",
      },
      createdAt: "2026-08-05T09:00:00.000Z",
      transitionedAt: "2026-08-05T09:00:00.000Z",
    } as const;
    expect(ResearchDetailSchema.parse(researchDetail)).toMatchObject({
      currentRevision: { aiProvenance },
    });
    expect(() =>
      ResearchDetailSchema.parse({
        ...researchDetail,
        currentRevision: { ...researchDetail.currentRevision, aiProvenance: null },
      }),
    ).toThrow();

    const experimentDetail = {
      id: ids.experimentId,
      researchId: ids.researchId,
      scope,
      state: "DRAFT",
      methodRevision: 1,
      version: 1,
      currentMethod: {
        id: ids.methodRevisionId,
        revision: 1,
        origin: "AI_DRAFT",
        authorId: ids.workItemId,
        aiProvenance,
        question: "Does the retrieval change reduce p95 latency?",
        baseline: {
          description: "Current retrieval path",
          value: "120",
          sourceReference: "run:00000001",
        },
        measures: [
          {
            stableId: "p95_latency_ms",
            name: "p95 latency",
            kind: "NUMERIC",
            unit: "ms",
            direction: "LOWER",
            baselineValue: "120",
            baselineReference: "run:00000001",
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
        controls: [],
        conditions: ["Same environment and selected sample."],
        reproducibilityInstructions: "Run the selected benchmark with the recorded configuration.",
        knownRisks: [],
        failureCases: [],
        sourceReferences: ["retrieval:00000001"],
        executionMode: "ai_assisted",
        createdAt: "2026-08-05T09:00:00.000Z",
      },
      createdAt: "2026-08-05T09:00:00.000Z",
      transitionedAt: "2026-08-05T09:00:00.000Z",
    } as const;
    expect(ExperimentDetailSchema.parse(experimentDetail)).toMatchObject({
      currentMethod: { aiProvenance },
    });
    expect(() =>
      ExperimentDetailSchema.parse({
        ...experimentDetail,
        currentMethod: { ...experimentDetail.currentMethod, aiProvenance: null },
      }),
    ).toThrow();
  });

  it("requires a reason and successor for terminal Experiment transitions", () => {
    expect(() =>
      TransitionExperimentInputSchema.parse({
        expectedVersion: 1,
        state: "ABANDONED",
        reason: null,
        successorExperimentId: null,
      }),
    ).toThrow();
    expect(() =>
      TransitionExperimentInputSchema.parse({
        expectedVersion: 1,
        state: "SUPERSEDED",
        reason: "A more focused method replaces this Experiment.",
        successorExperimentId: null,
      }),
    ).toThrow();
    expect(
      TransitionExperimentInputSchema.parse({
        expectedVersion: 1,
        state: "SUPERSEDED",
        reason: "A more focused method replaces this Experiment.",
        successorExperimentId: ids.experimentId,
      }),
    ).toMatchObject({ state: "SUPERSEDED" });
  });

  it("uses the declared measure stable-ID validation for Experiment conclusions", () => {
    const conclusion = {
      expectedVersion: 1,
      outcome: "NOT_SUPPORTED",
      summary: "The selected approach did not reduce latency in the bounded test.",
      runIds: [ids.methodRevisionId],
      measureStableIds: ["p95_latency_ms"],
      limitations: [],
      confidenceDescription: "The bounded sample supports this limited conclusion.",
      decisionRelevance: "Do not adopt this approach without another method.",
      nextStep: "Refine the method before another Experiment.",
    } as const;

    expect(ConcludeExperimentInputSchema.parse(conclusion)).toMatchObject({
      measureStableIds: ["p95_latency_ms"],
    });
    expect(() =>
      ConcludeExperimentInputSchema.parse({ ...conclusion, measureStableIds: ["p95 latency"] }),
    ).toThrow();
  });

  it("normalizes experiment measures and retains non-volume run observations", () => {
    const method = ReviseExperimentMethodInputSchema.parse({
      expectedVersion: 1,
      question: "Does the retrieval change reduce p95 latency?",
      baseline: {
        description: "Current retrieval path",
        value: "120",
        sourceReference: "run:00000001",
      },
      measures: [
        {
          stableId: "p95_latency_ms",
          name: "p95 latency",
          kind: "NUMERIC",
          unit: "ms",
          direction: "LOWER",
          baselineValue: "120",
          baselineReference: "run:00000001",
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
