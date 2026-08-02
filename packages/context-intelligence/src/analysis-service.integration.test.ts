import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { ProjectLinkSuggestionService } from "./project-link-suggestion-service.js";
import {
  CONTEXT_PROJECT_MATCH_ROUTE,
  CONTEXT_PROJECT_MATCH_TRUSTED_PROMPT,
  CONTEXT_SUMMARY_PROMPT_VERSION,
  CONTEXT_SUMMARY_ROUTE,
  CONTEXT_SUMMARY_TRUSTED_PROMPT,
} from "./prompts.js";
import { ContextAnalysisService } from "./analysis-service.js";

const employeeId = "00000000-0000-4000-8000-000000000801";
const sourceItemId = "00000000-0000-4000-8000-000000000802";
const departmentId = "00000000-0000-4000-8000-000000000803";
const systemId = "00000000-0000-4000-8000-000000000804";
const projectId = "00000000-0000-4000-8000-000000000805";
const correlationId = "00000000-0000-4000-8000-000000000806";
const analysisId = "00000000-0000-4000-8000-000000000807";
const suggestionId = "00000000-0000-4000-8000-000000000808";
const sourceReference = `connected-source:${sourceItemId}`;
const anchorReference = `source-project-link:${sourceItemId}`;
const now = new Date("2026-08-02T13:00:00.000Z");

type RouterRequest = Readonly<{
  routeKey: string;
  outputSchema: Readonly<{ parse(value: unknown): unknown }>;
  outputSchemaVersion: string;
  promptTemplateVersion: string;
  sourceReferences: readonly string[];
}> &
  Record<string, unknown>;

type PersistOutput = (
  transaction: unknown,
  output: unknown,
) => Promise<Readonly<{ outputReference: string }>>;

describe("ContextAnalysisService", () => {
  it("routes both analyses, preserves deterministic REVIEW, and persists sealed source-labelled output", async () => {
    const fixture = harness({
      summaryOutput: {
        interpretationLabel: "AI_DRAFT_INTERPRETATION",
        summary: "The source asks for an acceptance checklist.",
        supportedClaims: [
          { claim: "An acceptance checklist was requested.", sourceReferences: [sourceReference] },
        ],
        uncertainties: ["The Project is not confirmed."],
        sourceReferences: [sourceReference],
      },
      matchOutput: {
        interpretationLabel: "AI_DRAFT_INTERPRETATION",
        explanation: "One Project anchor exists, so employee review is still required.",
        uncertainties: ["A second independent anchor is missing."],
        sourceReferences: [sourceReference, anchorReference],
      },
    });

    const result = await fixture.service.analyze(command());

    expect(fixture.router.requests.map(({ routeKey }) => routeKey)).toEqual([
      CONTEXT_SUMMARY_ROUTE,
      CONTEXT_PROJECT_MATCH_ROUTE,
    ]);
    expect(result.decision).toMatchObject({
      kind: "REVIEW",
      reasons: ["INSUFFICIENT_INDEPENDENT_ANCHORS"],
    });
    expect(result.suggestion).toMatchObject({
      id: suggestionId,
      decision: "REVIEW",
      projectId,
      routeTrace: {
        routeKey: CONTEXT_PROJECT_MATCH_ROUTE,
        routeConfigVersion: 7,
      },
    });
    expect(result.suggestion.explanation).toContain("INSUFFICIENT_INDEPENDENT_ANCHORS");
    expect(result.suggestion.explanation).toContain("AI_DRAFT_INTERPRETATION");
    expect(result.suggestion.explanation).toContain("employee review is still required");
    expect(fixture.analysisRows).toHaveLength(1);
    expect(fixture.analysisRows[0]).toMatchObject({
      record: {
        id: analysisId,
        schemaVersion: "context-analysis-output.v1",
        promptVersion: CONTEXT_SUMMARY_PROMPT_VERSION,
        sourceReferences: [sourceReference],
        reviewStatus: "PENDING",
        revisionOrigin: "AI",
      },
      outputCiphertext: expect.stringMatching(/^sealed:/u),
      outputKeyVersion: "context-key-v7",
    });
    expect(fixture.analysisRows[0]?.outputCiphertext).not.toContain("acceptance checklist");
    expect(JSON.stringify(fixture.analysisRows)).not.toMatch(
      /credential|accessToken|refreshToken|apiKey/iu,
    );
  });

  it("rejects ungrounded model references before any governed output is appended", async () => {
    const fixture = harness({
      summaryOutput: {
        interpretationLabel: "AI_DRAFT_INTERPRETATION",
        summary: "Unsupported summary.",
        supportedClaims: [
          {
            claim: "Unsupported claim.",
            sourceReferences: ["connected-source:00000000-0000-4000-8000-000000000899"],
          },
        ],
        uncertainties: [],
        sourceReferences: ["connected-source:00000000-0000-4000-8000-000000000899"],
      },
      matchOutput: null,
    });

    await expect(fixture.service.analyze(command())).rejects.toThrow(
      "AI output cited a source outside the governed input",
    );
    expect(fixture.analysisRows).toHaveLength(0);
    expect(fixture.suggestionRows).toHaveLength(0);
    expect(fixture.router.requests).toHaveLength(1);
  });

  it("leaves raw source input intact and appends nothing when the routed AI fails", async () => {
    const raw = "Keep this manual source even when AI is unavailable.";
    const fixture = harness({
      summaryOutput: new Error("AI provider unavailable"),
      matchOutput: null,
    });
    const input = command(raw);

    await expect(fixture.service.analyze(input)).rejects.toThrow("AI provider unavailable");
    expect(input.sources[0]?.content).toBe(raw);
    expect(fixture.analysisRows).toHaveLength(0);
    expect(fixture.suggestionRows).toHaveLength(0);
  });
});

function command(content = "Please prepare the acceptance checklist.") {
  return {
    actor: { userId: employeeId, active: true },
    sourceItemId,
    departmentId,
    systemId,
    correlationId,
    sources: [
      { kind: "EMAIL" as const, reference: sourceReference, mediaType: "text/plain", content },
    ],
    candidates: [
      {
        projectId,
        accessible: true,
        anchors: [
          {
            anchor: {
              kind: "EXPLICIT_PROJECT_REFERENCE" as const,
              reference: anchorReference,
              conflicts: false,
            },
            current: true,
          },
        ],
      },
    ],
    semanticContexts: [],
  };
}

function harness(input: { summaryOutput: unknown; matchOutput: unknown }) {
  const outputs = new Map([
    [CONTEXT_SUMMARY_ROUTE, input.summaryOutput],
    [CONTEXT_PROJECT_MATCH_ROUTE, input.matchOutput],
  ]);
  const traces = new Map<string, Record<string, unknown>>();
  const requests: RouterRequest[] = [];
  const router = {
    requests,
    run: vi.fn(async (request: RouterRequest, persist: PersistOutput) => {
      requests.push(request);
      const output = outputs.get(request.routeKey);
      if (output instanceof Error) throw output;
      const validated = request.outputSchema.parse(output);
      const persisted = await persist(undefined, validated);
      const runId = crypto.randomUUID();
      traces.set(runId, {
        id: runId,
        routeKey: request.routeKey,
        routeConfigId: crypto.randomUUID(),
        routeConfigVersion: 7,
        outputSchemaVersion: request.outputSchemaVersion,
        promptTemplateVersion: request.promptTemplateVersion,
        sourceReferences: request.sourceReferences,
        outputReference: persisted.outputReference,
        state: "succeeded",
      });
      return {
        runId,
        output: validated,
        outputReference: persisted.outputReference,
        requiresHumanApproval: true,
      };
    }),
  };
  const analysisRows: any[] = [];
  const suggestionRows: any[] = [];
  const suggestionPersistence = {
    appendInitial: vi.fn(async (suggestion) => {
      suggestionRows.push(suggestion);
      return suggestion;
    }),
    findOwnedSuggestion: vi.fn(),
    appendCorrectionRevision: vi.fn(),
  };
  const suggestionService = new ProjectLinkSuggestionService({
    persistence: suggestionPersistence,
    projectAuthorization: { canLink: async () => true },
    clock: () => now,
    idFactory: () => suggestionId,
  });
  const promptBodies = new Map([
    [CONTEXT_SUMMARY_ROUTE, CONTEXT_SUMMARY_TRUSTED_PROMPT],
    [CONTEXT_PROJECT_MATCH_ROUTE, CONTEXT_PROJECT_MATCH_TRUSTED_PROMPT],
  ]);
  return {
    router,
    analysisRows,
    suggestionRows,
    service: new ContextAnalysisService({
      router: router as never,
      promptArtifacts: {
        read: async (routeKey: string, version: string) => {
          const trustedBody = promptBodies.get(routeKey)!;
          return {
            id: crypto.randomUUID(),
            routeKey,
            version,
            bodyHash: createHash("sha256").update(trustedBody).digest("hex"),
            trustedBody,
          };
        },
      },
      aiRuns: { readSucceeded: async (runId: string) => traces.get(runId) as never },
      analyses: {
        append: async (row) => {
          analysisRows.push(row);
          return row.record;
        },
      },
      suggestions: suggestionService,
      protector: {
        seal: async (value: string) => ({
          ciphertext: `sealed:${Buffer.from(value).toString("base64url")}`,
          keyVersion: "context-key-v7",
        }),
      },
      clock: () => now,
      idFactory: (kind) => (kind === "analysis" ? analysisId : crypto.randomUUID()),
      timeoutMs: 10_000,
    }),
  };
}
