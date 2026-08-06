import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { AppError } from "@evaluation/contracts";

import { ResearchAiAssistant } from "./ai-assistant.js";
import {
  EXPERIMENT_INTERPRET_OUTPUT_SCHEMA_VERSION,
  EXPERIMENT_INTERPRET_PROMPT_VERSION,
  EXPERIMENT_INTERPRET_ROUTE,
  EXPERIMENT_INTERPRET_TRUSTED_PROMPT,
  EXPERIMENT_METHOD_REVIEW_OUTPUT_SCHEMA_VERSION,
  EXPERIMENT_METHOD_REVIEW_PROMPT_VERSION,
  EXPERIMENT_METHOD_REVIEW_ROUTE,
  EXPERIMENT_METHOD_REVIEW_TRUSTED_PROMPT,
  RESEARCH_FRAME_OUTPUT_SCHEMA_VERSION,
  RESEARCH_FRAME_PROMPT_VERSION,
  RESEARCH_FRAME_ROUTE,
  RESEARCH_FRAME_TRUSTED_PROMPT,
  RESEARCH_SOURCE_REVIEW_OUTPUT_SCHEMA_VERSION,
  RESEARCH_SOURCE_REVIEW_PROMPT_VERSION,
  RESEARCH_SOURCE_REVIEW_ROUTE,
  RESEARCH_SOURCE_REVIEW_TRUSTED_PROMPT,
  RESEARCH_SYNTHESIZE_OUTPUT_SCHEMA_VERSION,
  RESEARCH_SYNTHESIZE_PROMPT_VERSION,
  RESEARCH_SYNTHESIZE_ROUTE,
  RESEARCH_SYNTHESIZE_TRUSTED_PROMPT,
} from "./prompts.js";

const ids = {
  projectId: "11111111-1111-4111-8111-111111111111",
  departmentId: "22222222-2222-4222-8222-222222222222",
  systemId: "33333333-3333-4333-8333-333333333333",
  correlationId: "44444444-4444-4444-8444-444444444444",
  promptId: "55555555-5555-4555-8555-555555555555",
  runId: "66666666-6666-4666-8666-666666666666",
  routeConfigId: "77777777-7777-4777-8777-777777777777",
};
const source = "retrieval:88888888-8888-4888-8888-888888888888";
const context = `project-context:${"a".repeat(64)}`;
const outputReference = "research-source-review:99999999-9999-4999-8999-999999999999";

const output = {
  schemaVersion: "research-source-review-output.v1",
  summary: "The retrieved README describes a bounded retrieval approach.",
  relevance: "It may inform a Project experiment; possible benefit requires verification.",
  citations: [{ sourceReference: source, locator: "README#retrieval" }],
  benefits: ["Could provide one alternative to compare."],
  risks: ["The source conditions differ from the Project."],
  mismatches: ["No Project dataset result is supplied."],
  uncertainties: ["License information is missing."],
  disposition: "DRAFT_EXPERIMENT",
  proposals: [],
} as const;

function harness(routerRun = vi.fn()) {
  const expectedHash = createHash("sha256")
    .update(RESEARCH_SOURCE_REVIEW_TRUSTED_PROMPT)
    .digest("hex");
  const promptArtifacts = {
    read: vi.fn(async () => ({
      id: ids.promptId,
      routeKey: RESEARCH_SOURCE_REVIEW_ROUTE,
      version: RESEARCH_SOURCE_REVIEW_PROMPT_VERSION,
      bodyHash: expectedHash,
      trustedBody: RESEARCH_SOURCE_REVIEW_TRUSTED_PROMPT,
    })),
  };
  const aiRuns = {
    readSucceeded: vi.fn(async () => ({
      id: ids.runId,
      routeKey: RESEARCH_SOURCE_REVIEW_ROUTE,
      routeConfigId: ids.routeConfigId,
      routeConfigVersion: 1,
      outputSchemaVersion: RESEARCH_SOURCE_REVIEW_OUTPUT_SCHEMA_VERSION,
      promptTemplateVersion: RESEARCH_SOURCE_REVIEW_PROMPT_VERSION,
      sourceReferences: [context, source],
      outputReference,
      state: "succeeded" as const,
    })),
  };
  return {
    routerRun,
    promptArtifacts,
    aiRuns,
    assistant: new ResearchAiAssistant({
      router: { run: routerRun },
      promptArtifacts,
      aiRuns,
    }),
  };
}

function command() {
  return {
    projectId: ids.projectId,
    departmentId: ids.departmentId,
    systemId: ids.systemId,
    correlationId: ids.correlationId,
    inputReference: source,
    outputReference,
    sourceReferences: [source, context],
    payload: {
      retrievalState: "RETRIEVED",
      retrievedText: "A bounded README excerpt.",
      projectContext: { projectId: ids.projectId, fingerprintSha256: "a".repeat(64) },
    },
  } as const;
}

describe("ResearchAiAssistant", () => {
  it("routes a source review only through AiRouter with governed confidential metadata", async () => {
    const persist = vi.fn(async () => ({ outputReference }));
    const fixture = harness(
      vi.fn(async (request, persistValidatedOutput) => {
        await persistValidatedOutput(undefined, output);
        return {
          runId: ids.runId,
          output,
          outputReference,
          requiresHumanApproval: true,
        };
      }),
    );

    const result = await fixture.assistant.reviewSource(command(), persist);

    expect(fixture.routerRun).toHaveBeenCalledOnce();
    expect(fixture.routerRun.mock.calls[0]?.[0]).toMatchObject({
      routeKey: RESEARCH_SOURCE_REVIEW_ROUTE,
      projectId: ids.projectId,
      departmentId: ids.departmentId,
      systemId: ids.systemId,
      inputReference: source,
      outputSchemaVersion: RESEARCH_SOURCE_REVIEW_OUTPUT_SCHEMA_VERSION,
      promptTemplateVersion: RESEARCH_SOURCE_REVIEW_PROMPT_VERSION,
      sourceReferences: [context, source],
      classification: "confidential",
      timeoutMs: 60_000,
      requiresHumanApproval: true,
      correlationId: ids.correlationId,
    });
    expect(persist).toHaveBeenCalledWith(undefined, output);
    expect(result).toMatchObject({
      output,
      outputReference,
      promptVersion: RESEARCH_SOURCE_REVIEW_PROMPT_VERSION,
      requiresHumanApproval: true,
      routeTrace: {
        aiRunId: ids.runId,
        routeKey: RESEARCH_SOURCE_REVIEW_ROUTE,
        routeConfigId: ids.routeConfigId,
        routeConfigVersion: 1,
      },
    });
  });

  it("fails closed before the router when source content is inaccessible", async () => {
    const fixture = harness();
    await expect(
      fixture.assistant.reviewSource(
        {
          ...command(),
          payload: {
            retrievalState: "BLOCKED",
            retrievedText: null,
            retrievalReason: "SOURCE_UNAVAILABLE",
            projectContext: { projectId: ids.projectId, fingerprintSha256: "a".repeat(64) },
          },
        },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: "RESEARCH_AI_SOURCE_UNAVAILABLE", status: 409 });
    expect(fixture.routerRun).not.toHaveBeenCalled();
  });

  it("turns provider/schema/trace failure into a typed recoverable error without persisting raw input", async () => {
    const persist = vi.fn();
    const fixture = harness(
      vi.fn(async () => {
        throw new AppError("AI_PROVIDER_FAILED", "errors.ai.providerFailed", 502);
      }),
    );

    await expect(fixture.assistant.reviewSource(command(), persist)).rejects.toMatchObject({
      code: "RESEARCH_AI_ASSISTANCE_UNAVAILABLE",
      status: 503,
    });
    expect(persist).not.toHaveBeenCalled();
    expect(JSON.stringify(fixture.routerRun.mock.calls)).toContain("A bounded README excerpt.");
    expect(JSON.stringify(persist.mock.calls)).not.toContain("A bounded README excerpt.");
  });

  it("rejects semantic policy violations before the validated-output transaction persists them", async () => {
    const persist = vi.fn(async () => ({ outputReference }));
    const unsafeOutput = {
      ...output,
      summary: "Employee performance is excellent and the worker is a top performer.",
    };
    const fixture = harness(
      vi.fn(async (_request, persistValidatedOutput) => {
        await persistValidatedOutput(undefined, unsafeOutput);
        return {
          runId: ids.runId,
          output: unsafeOutput,
          outputReference,
          requiresHumanApproval: true,
        };
      }),
    );

    await expect(fixture.assistant.reviewSource(command(), persist)).rejects.toMatchObject({
      code: "RESEARCH_AI_ASSISTANCE_UNAVAILABLE",
      status: 503,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects a succeeded-run trace whose public identity is malformed", async () => {
    const fixture = harness(
      vi.fn(async (_request, persistValidatedOutput) => {
        await persistValidatedOutput(undefined, output);
        return {
          runId: ids.runId,
          output,
          outputReference,
          requiresHumanApproval: true,
        };
      }),
    );
    fixture.aiRuns.readSucceeded.mockResolvedValue({
      id: ids.runId,
      routeKey: RESEARCH_SOURCE_REVIEW_ROUTE,
      routeConfigId: "not-a-uuid",
      routeConfigVersion: 1,
      outputSchemaVersion: RESEARCH_SOURCE_REVIEW_OUTPUT_SCHEMA_VERSION,
      promptTemplateVersion: RESEARCH_SOURCE_REVIEW_PROMPT_VERSION,
      sourceReferences: [context, source],
      outputReference,
      state: "succeeded",
    });

    await expect(
      fixture.assistant.reviewSource(command(), async () => ({ outputReference })),
    ).rejects.toMatchObject({ code: "RESEARCH_AI_ASSISTANCE_UNAVAILABLE", status: 503 });
  });

  it.each([
    {
      routeKey: RESEARCH_FRAME_ROUTE,
      promptVersion: RESEARCH_FRAME_PROMPT_VERSION,
      promptBody: RESEARCH_FRAME_TRUSTED_PROMPT,
      outputSchemaVersion: RESEARCH_FRAME_OUTPUT_SCHEMA_VERSION,
      output: {
        schemaVersion: RESEARCH_FRAME_OUTPUT_SCHEMA_VERSION,
        problemStatement: "A retrieval choice needs investigation.",
        context: "The Project needs a bounded comparison.",
        question: "Which approach behaves more predictably?",
        objective: "Prepare a controlled comparison.",
        hypothesis: { kind: "NO_HYPOTHESIS" as const, reason: "Exploratory framing." },
        assumptions: [],
        constraints: ["Use approved inputs."],
        knownUncertainty: ["Production transfer is unknown."],
        alternatives: ["Keep the current approach."],
        decisionQuestion: "Should an Experiment be prepared?",
        sourceReferences: [source],
        nextQuestion: null,
        draftOnly: true as const,
        requiresHumanApproval: true as const,
      },
      invoke: "frameResearch" as const,
    },
    {
      routeKey: RESEARCH_SYNTHESIZE_ROUTE,
      promptVersion: RESEARCH_SYNTHESIZE_PROMPT_VERSION,
      promptBody: RESEARCH_SYNTHESIZE_TRUSTED_PROMPT,
      outputSchemaVersion: RESEARCH_SYNTHESIZE_OUTPUT_SCHEMA_VERSION,
      output: {
        schemaVersion: RESEARCH_SYNTHESIZE_OUTPUT_SCHEMA_VERSION,
        comparison: "The cited sources use different conditions.",
        supportedFindings: [
          { claim: "One source uses a bounded input.", sourceReferences: [source] },
        ],
        unsupportedClaims: ["Possible Project benefit requires verification."],
        missingAlternatives: ["The current baseline is missing."],
        remainingUncertainty: ["Transfer remains unknown."],
        possibleDecisionPaths: ["Prepare a bounded Experiment."],
        sourceReferences: [source],
        draftOnly: true as const,
        requiresHumanApproval: true as const,
      },
      invoke: "synthesizeResearch" as const,
    },
    {
      routeKey: EXPERIMENT_METHOD_REVIEW_ROUTE,
      promptVersion: EXPERIMENT_METHOD_REVIEW_PROMPT_VERSION,
      promptBody: EXPERIMENT_METHOD_REVIEW_TRUSTED_PROMPT,
      outputSchemaVersion: EXPERIMENT_METHOD_REVIEW_OUTPUT_SCHEMA_VERSION,
      output: {
        schemaVersion: EXPERIMENT_METHOD_REVIEW_OUTPUT_SCHEMA_VERSION,
        missingElements: ["Comparison target is missing."],
        observations: ["One measure is named."],
        uncertainties: ["Dataset coverage is unknown."],
        sourceReferences: [source],
        nextQuestion: "What comparison target should remain constant?",
        draftOnly: true as const,
        requiresHumanApproval: true as const,
      },
      invoke: "reviewExperimentMethod" as const,
    },
    {
      routeKey: EXPERIMENT_INTERPRET_ROUTE,
      promptVersion: EXPERIMENT_INTERPRET_PROMPT_VERSION,
      promptBody: EXPERIMENT_INTERPRET_TRUSTED_PROMPT,
      outputSchemaVersion: EXPERIMENT_INTERPRET_OUTPUT_SCHEMA_VERSION,
      output: {
        schemaVersion: EXPERIMENT_INTERPRET_OUTPUT_SCHEMA_VERSION,
        runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        methodRevisionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        resultStatus: "FAILED" as const,
        summary: "The run failed before the intended observation.",
        observations: [],
        limitations: ["No Project outcome can be inferred."],
        possibleDecisionPaths: ["Correct the environment and record a new run."],
        uncertainties: ["The failure cause is not isolated."],
        sourceReferences: [source],
        draftOnly: true as const,
        requiresHumanApproval: true as const,
      },
      invoke: "interpretExperiment" as const,
    },
  ])("routes $routeKey through the same governed adapter", async (route) => {
    const promptHash = createHash("sha256").update(route.promptBody).digest("hex");
    const routerRun = vi.fn(async (request, persistValidatedOutput) => {
      await persistValidatedOutput(undefined, route.output);
      return {
        runId: ids.runId,
        output: route.output,
        outputReference,
        requiresHumanApproval: true,
      };
    });
    const assistant = new ResearchAiAssistant({
      router: { run: routerRun as never },
      promptArtifacts: {
        read: async () => ({
          id: ids.promptId,
          routeKey: route.routeKey,
          version: route.promptVersion,
          bodyHash: promptHash,
          trustedBody: route.promptBody,
        }),
      },
      aiRuns: {
        readSucceeded: async () => ({
          id: ids.runId,
          routeKey: route.routeKey,
          routeConfigId: ids.routeConfigId,
          routeConfigVersion: 1,
          outputSchemaVersion: route.outputSchemaVersion,
          promptTemplateVersion: route.promptVersion,
          sourceReferences: [source],
          outputReference,
          state: "succeeded" as const,
        }),
      },
    });
    const base = { ...command(), sourceReferences: [source], payload: { note: "draft" } };
    const persist = vi.fn(async () => ({ outputReference }));

    if (route.invoke === "frameResearch") await assistant.frameResearch(base, persist);
    else if (route.invoke === "synthesizeResearch") {
      await assistant.synthesizeResearch(base, persist);
    } else if (route.invoke === "reviewExperimentMethod") {
      await assistant.reviewExperimentMethod(base, persist);
    } else {
      await assistant.interpretExperiment(
        {
          ...base,
          payload: {
            runId: route.output.runId,
            methodRevisionId: route.output.methodRevisionId,
            resultStatus: route.output.resultStatus,
            runReference: source,
          },
        },
        persist,
      );
    }

    expect(routerRun.mock.calls[0]?.[0]).toMatchObject({
      routeKey: route.routeKey,
      classification: "confidential",
      timeoutMs: 60_000,
      requiresHumanApproval: true,
    });
  });
});
