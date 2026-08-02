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
    const matchOutput = {
      interpretationLabel: "AI_DRAFT_INTERPRETATION" as const,
      explanation: "One Project anchor exists, so employee review is still required.",
      uncertainties: ["A second independent anchor is missing."],
      sourceReferences: [sourceReference, anchorReference],
    };
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
      matchOutput,
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
    expect(result.suggestion.explanation).toContain("employee review is still required");
    expect(fixture.outputReferences).toEqual([
      `context-analysis:${analysisId}`,
      `project-link-suggestion:${suggestionId}`,
    ]);
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
    expect(fixture.suggestionRows[0]).toMatchObject({
      record: { id: suggestionId, decision: "REVIEW" },
      explanationCiphertext: expect.stringMatching(/^sealed:/u),
      explanationKeyVersion: "context-key-v7",
    });
    expect(JSON.stringify(fixture.suggestionRows[0]?.record)).not.toContain(
      "employee review is still required",
    );
    expect(fixture.suggestionRows[0]?.explanationCiphertext).not.toContain(
      "employee review is still required",
    );
    expect(JSON.parse(fixture.suggestionProtectedValues[0]!)).toEqual(matchOutput);
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

  it("reuses the persisted initial analysis when Project matching fails and is retried", async () => {
    const fixture = harness({
      summaryOutput: validSummary(),
      matchOutput: [new Error("Project match unavailable"), validMatch()],
    });

    await expect(fixture.service.analyze(command())).rejects.toThrow("Project match unavailable");
    await expect(fixture.service.analyze(command())).resolves.toMatchObject({
      analysis: { id: analysisId },
      suggestion: { id: suggestionId },
    });

    expect(fixture.analysisRows).toHaveLength(1);
    expect(fixture.router.requests.map(({ routeKey }) => routeKey)).toEqual([
      CONTEXT_SUMMARY_ROUTE,
      CONTEXT_PROJECT_MATCH_ROUTE,
      CONTEXT_PROJECT_MATCH_ROUTE,
    ]);
  });

  it("recovers an analysis append that committed before its response was lost", async () => {
    const fixture = harness(
      { summaryOutput: validSummary(), matchOutput: validMatch() },
      { loseAnalysisAppendResponseOnce: true },
    );

    await expect(fixture.service.analyze(command())).rejects.toThrow("analysis response lost");
    await expect(fixture.service.analyze(command())).resolves.toMatchObject({
      analysis: { id: analysisId },
      suggestion: { id: suggestionId },
    });

    expect(fixture.analysisRows).toHaveLength(1);
    expect(fixture.router.requests.map(({ routeKey }) => routeKey)).toEqual([
      CONTEXT_SUMMARY_ROUTE,
      CONTEXT_PROJECT_MATCH_ROUTE,
    ]);
  });

  it("returns the persisted suggestion after its committed append response was lost", async () => {
    const fixture = harness(
      { summaryOutput: validSummary(), matchOutput: validMatch() },
      { loseSuggestionAppendResponseOnce: true },
    );

    await expect(fixture.service.analyze(command())).rejects.toThrow("suggestion response lost");
    await expect(fixture.service.analyze(command())).resolves.toMatchObject({
      suggestion: { id: suggestionId },
    });

    expect(fixture.analysisRows).toHaveLength(1);
    expect(fixture.suggestionRows).toHaveLength(1);
    expect(fixture.router.requests.map(({ routeKey }) => routeKey)).toEqual([
      CONTEXT_SUMMARY_ROUTE,
      CONTEXT_PROJECT_MATCH_ROUTE,
    ]);
  });
});

function validSummary() {
  return {
    interpretationLabel: "AI_DRAFT_INTERPRETATION",
    summary: "The source asks for an acceptance checklist.",
    supportedClaims: [
      { claim: "An acceptance checklist was requested.", sourceReferences: [sourceReference] },
    ],
    uncertainties: ["The Project is not confirmed."],
    sourceReferences: [sourceReference],
  };
}

function validMatch() {
  return {
    interpretationLabel: "AI_DRAFT_INTERPRETATION",
    explanation: "One Project anchor exists, so employee review is still required.",
    uncertainties: ["A second independent anchor is missing."],
    sourceReferences: [sourceReference, anchorReference],
  };
}

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

function harness(
  input: { summaryOutput: unknown; matchOutput: unknown | unknown[] },
  options: Readonly<{
    loseAnalysisAppendResponseOnce?: boolean;
    loseSuggestionAppendResponseOnce?: boolean;
  }> = {},
) {
  const outputs = new Map([
    [CONTEXT_SUMMARY_ROUTE, input.summaryOutput],
    [CONTEXT_PROJECT_MATCH_ROUTE, input.matchOutput],
  ]);
  const traces = new Map<string, Record<string, unknown>>();
  const outputReferences: string[] = [];
  const requests: RouterRequest[] = [];
  const router = {
    requests,
    run: vi.fn(async (request: RouterRequest, persist: PersistOutput) => {
      requests.push(request);
      const configured = outputs.get(request.routeKey);
      const output = Array.isArray(configured) ? configured.shift() : configured;
      if (output instanceof Error) throw output;
      const validated = request.outputSchema.parse(output);
      const persisted = await persist(undefined, validated);
      outputReferences.push(persisted.outputReference);
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
  const suggestionProtectedValues: string[] = [];
  let loseAnalysisResponse = options.loseAnalysisAppendResponseOnce ?? false;
  let loseSuggestionResponse = options.loseSuggestionAppendResponseOnce ?? false;
  const suggestionPersistence = {
    appendInitial: vi.fn(async (inputRow: any) => {
      const existing = suggestionRows.find(
        (row) => (row.record?.id ?? row.id) === (inputRow.record?.id ?? inputRow.id),
      );
      if (existing === undefined) suggestionRows.push(inputRow);
      const stored = existing ?? inputRow;
      if (loseSuggestionResponse) {
        loseSuggestionResponse = false;
        throw new Error("suggestion response lost");
      }
      return materializeSuggestion(stored);
    }),
    findOwnedSuggestion: vi.fn(async ({ employeeId: ownerId, suggestionId: id }) => {
      const row = suggestionRows.find(
        (candidate) =>
          (candidate.record?.id ?? candidate.id) === id &&
          (candidate.record?.employeeId ?? candidate.employeeId) === ownerId,
      );
      return row === undefined ? null : materializeSuggestion(row);
    }),
    appendCorrectionRevision: vi.fn(),
  };
  const suggestionService = new ProjectLinkSuggestionService({
    persistence: suggestionPersistence,
    projectAuthorization: { canLink: async () => true },
    protector: {
      seal: async (value: string) => {
        suggestionProtectedValues.push(value);
        return {
          ciphertext: `sealed:${Buffer.from(value).toString("base64url")}`,
          keyVersion: "context-key-v7",
        };
      },
    },
    clock: () => now,
    idFactory: () => suggestionId,
  });
  const promptBodies = new Map([
    [CONTEXT_SUMMARY_ROUTE, CONTEXT_SUMMARY_TRUSTED_PROMPT],
    [CONTEXT_PROJECT_MATCH_ROUTE, CONTEXT_PROJECT_MATCH_TRUSTED_PROMPT],
  ]);
  return {
    router,
    outputReferences,
    analysisRows,
    suggestionRows,
    suggestionProtectedValues,
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
        findInitial: async () => analysisRows[0]?.record ?? null,
        append: async (row) => {
          const existing = analysisRows.find(({ record }) => record.id === row.record.id);
          if (existing === undefined) analysisRows.push(row);
          if (loseAnalysisResponse) {
            loseAnalysisResponse = false;
            throw new Error("analysis response lost");
          }
          return (existing ?? row).record;
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
      idFactory: (kind) =>
        kind === "analysis"
          ? analysisId
          : kind === "suggestion"
            ? suggestionId
            : crypto.randomUUID(),
      timeoutMs: 10_000,
    }),
  };
}

function materializeSuggestion(row: any) {
  if (row.record === undefined) return row;
  const encoded = String(row.explanationCiphertext).replace(/^sealed:/u, "");
  const protectedValue = Buffer.from(encoded, "base64url").toString();
  let explanation = protectedValue;
  try {
    const structured = JSON.parse(protectedValue) as { explanation?: unknown };
    if (typeof structured.explanation === "string") explanation = structured.explanation;
  } catch {
    // Fix-round RED compatibility: the pre-fix payload is a non-JSON formatted string.
  }
  return {
    ...row.record,
    explanation,
  };
}
