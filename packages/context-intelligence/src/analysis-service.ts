import { createHash } from "node:crypto";

import type { AiRouter } from "@evaluation/ai-routing";
import { ContextAnalysisSchema } from "@evaluation/contracts";

import { decideProjectLink, type ProjectCandidate } from "./matching-policy.js";
import type { ApprovedProjectSemanticContext } from "./project-semantic-context-reader.js";
import type { ProjectLinkSuggestionService } from "./project-link-suggestion-service.js";
import {
  CONTEXT_PROJECT_MATCH_OUTPUT_SCHEMA_VERSION,
  CONTEXT_PROJECT_MATCH_PROMPT_VERSION,
  CONTEXT_PROJECT_MATCH_ROUTE,
  CONTEXT_PROJECT_MATCH_TRUSTED_PROMPT,
  CONTEXT_SUMMARY_OUTPUT_SCHEMA_VERSION,
  CONTEXT_SUMMARY_PROMPT_VERSION,
  CONTEXT_SUMMARY_ROUTE,
  CONTEXT_SUMMARY_TRUSTED_PROMPT,
  ContextProjectMatchAiOutputSchema,
  ContextSummaryAiOutputSchema,
  assertContextProjectMatchSemantics,
  assertContextSummarySemantics,
  buildContextProjectMatchRequest,
  buildContextSummaryRequest,
  type ContextSourceInput,
} from "./prompts.js";

type Router = Pick<AiRouter, "run">;
type ContextAnalysis = import("@evaluation/contracts").ContextAnalysis;
type LinkDecision = import("./matching-policy.js").LinkDecision;
type ContextSummaryOutput = import("zod").infer<typeof ContextSummaryAiOutputSchema>;
type ContextProjectMatchOutput = import("zod").infer<typeof ContextProjectMatchAiOutputSchema>;

export type ContextPromptArtifact = Readonly<{
  id: string;
  routeKey: string;
  version: string;
  bodyHash: string;
  trustedBody: string;
}>;

export interface ContextPromptArtifactPublicReader {
  read(routeKey: string, version: string): Promise<ContextPromptArtifact | null>;
}

export type SucceededAiRunTrace = Readonly<{
  id: string;
  routeKey: string;
  routeConfigId: string;
  routeConfigVersion: number;
  outputSchemaVersion: string;
  promptTemplateVersion: string;
  sourceReferences: readonly string[];
  outputReference: string | null;
  state: "succeeded";
}>;

export interface SucceededAiRunTracePublicReader {
  readSucceeded(runId: string): Promise<SucceededAiRunTrace | null>;
}

export interface PrivateContextOutputProtector {
  seal(value: string): Promise<Readonly<{ ciphertext: string; keyVersion: string }>>;
}

export interface ContextAnalysisPersistence {
  findInitial(
    input: Readonly<{
      id: string;
      employeeId: string;
      sourceItemId: string;
    }>,
  ): Promise<ContextAnalysis | null>;
  append(
    input: Readonly<{
      record: ContextAnalysis;
      outputCiphertext: string;
      outputKeyVersion: string;
    }>,
  ): Promise<ContextAnalysis>;
}

type Dependencies = Readonly<{
  router: Router;
  promptArtifacts: ContextPromptArtifactPublicReader;
  aiRuns: SucceededAiRunTracePublicReader;
  analyses: ContextAnalysisPersistence;
  suggestions: Pick<ProjectLinkSuggestionService, "findRecordedDecision" | "recordDecision">;
  protector: PrivateContextOutputProtector;
  timeoutMs: number;
  clock?: () => Date;
  idFactory?: (kind: "analysis" | "suggestion") => string;
}>;

export type AnalyzeContextCommand = Readonly<{
  actor: Readonly<{ userId: string; active: boolean }>;
  sourceItemId: string;
  departmentId: string;
  systemId: string;
  correlationId: string;
  sources: readonly ContextSourceInput[];
  candidates: readonly ProjectCandidate[];
  semanticContexts: readonly ApprovedProjectSemanticContext[];
}>;

export class ContextAnalysisService {
  private readonly dependencies: Dependencies;

  constructor(dependencies: Dependencies) {
    this.dependencies = dependencies;
  }

  async analyze(command: AnalyzeContextCommand) {
    if (!command.actor.active) throw new Error("Active employee required");
    const decision = decideProjectLink(command.candidates);
    const analysisId = this.id("analysis", command);
    const suggestionId = this.id("suggestion", command);
    const summarySources = boundedReferences(command.sources.map(({ reference }) => reference));
    let analysis = await this.dependencies.analyses.findInitial({
      id: analysisId,
      employeeId: command.actor.userId,
      sourceItemId: command.sourceItemId,
    });
    if (analysis !== null) {
      analysis = requireInitialAnalysis(analysis, analysisId, command);
    } else {
      const summaryPrompt = await requirePrompt(
        this.dependencies.promptArtifacts,
        CONTEXT_SUMMARY_ROUTE,
        CONTEXT_SUMMARY_PROMPT_VERSION,
        CONTEXT_SUMMARY_TRUSTED_PROMPT,
      );
      const summaryRequest = buildContextSummaryRequest({
        prompt: { artifactId: summaryPrompt.id, sha256: summaryPrompt.bodyHash },
        sources: command.sources,
      });
      const summaryReference = `context-analysis:${analysisId}`;
      const summaryRun = await this.dependencies.router.run(
        {
          routeKey: CONTEXT_SUMMARY_ROUTE,
          departmentId: command.departmentId,
          systemId: command.systemId,
          input: summaryRequest.input,
          inputReference: `connected-source:${command.sourceItemId}`,
          inputSchemaVersion: summaryRequest.inputSchemaVersion,
          outputSchemaVersion: CONTEXT_SUMMARY_OUTPUT_SCHEMA_VERSION,
          promptTemplateVersion: CONTEXT_SUMMARY_PROMPT_VERSION,
          outputSchema: ContextSummaryAiOutputSchema,
          sourceReferences: summarySources,
          classification: "confidential",
          timeoutMs: this.dependencies.timeoutMs,
          requiresHumanApproval: true,
          correlationId: command.correlationId,
        },
        async () => ({ outputReference: summaryReference }),
      );
      assertContextSummarySemantics(summaryRun.output, summarySources);
      const summaryTrace = await requireTrace(this.dependencies.aiRuns, summaryRun, {
        routeKey: CONTEXT_SUMMARY_ROUTE,
        outputSchemaVersion: CONTEXT_SUMMARY_OUTPUT_SCHEMA_VERSION,
        promptTemplateVersion: CONTEXT_SUMMARY_PROMPT_VERSION,
        sourceReferences: summarySources,
      });
      const sealedSummary = await this.dependencies.protector.seal(
        JSON.stringify(summaryRun.output),
      );
      const createdAt = (this.dependencies.clock ?? (() => new Date()))();
      const pending = ContextAnalysisSchema.parse({
        id: analysisId,
        employeeId: command.actor.userId,
        sourceItemId: command.sourceItemId,
        revision: 1,
        schemaVersion: CONTEXT_SUMMARY_OUTPUT_SCHEMA_VERSION,
        promptVersion: CONTEXT_SUMMARY_PROMPT_VERSION,
        routeTrace: publicTrace(summaryTrace),
        sourceReferences: summaryRun.output.sourceReferences,
        reviewStatus: "PENDING",
        revisionOrigin: "AI",
        correctionReason: null,
        createdAt: createdAt.toISOString(),
        summary: summaryRun.output.summary,
        uncertainties: summaryRun.output.uncertainties,
        supersedesAnalysisId: null,
      });
      analysis = requireInitialAnalysis(
        await this.dependencies.analyses.append({
          record: pending,
          outputCiphertext: sealedSummary.ciphertext,
          outputKeyVersion: sealedSummary.keyVersion,
        }),
        analysisId,
        command,
      );
    }

    const matchSources = boundedReferences([
      ...summarySources,
      ...decisionSourceReferences(decision),
      ...command.semanticContexts.flatMap(({ sourceReferences }) => sourceReferences),
    ]);
    const recordedSuggestion = await this.dependencies.suggestions.findRecordedDecision({
      actor: command.actor,
      suggestionId,
      analysisId: analysis.id,
      sourceItemId: command.sourceItemId,
      schemaVersion: CONTEXT_PROJECT_MATCH_OUTPUT_SCHEMA_VERSION,
      promptVersion: CONTEXT_PROJECT_MATCH_PROMPT_VERSION,
      routeKey: CONTEXT_PROJECT_MATCH_ROUTE,
      decision,
      allowedSourceReferences: matchSources,
    });
    if (recordedSuggestion !== null) {
      return { analysis, decision, suggestion: recordedSuggestion } as const;
    }

    const matchPrompt = await requirePrompt(
      this.dependencies.promptArtifacts,
      CONTEXT_PROJECT_MATCH_ROUTE,
      CONTEXT_PROJECT_MATCH_PROMPT_VERSION,
      CONTEXT_PROJECT_MATCH_TRUSTED_PROMPT,
    );
    const matchRequest = buildContextProjectMatchRequest({
      prompt: { artifactId: matchPrompt.id, sha256: matchPrompt.bodyHash },
      sources: command.sources,
      decision,
      semanticContexts: command.semanticContexts,
    });
    const matchReference = `project-link-suggestion:${suggestionId}`;
    const matchRun = await this.dependencies.router.run(
      {
        routeKey: CONTEXT_PROJECT_MATCH_ROUTE,
        ...(decision.kind === "AUTO_LINK" ? { projectId: decision.projectId } : {}),
        departmentId: command.departmentId,
        systemId: command.systemId,
        input: matchRequest.input,
        inputReference: `connected-source:${command.sourceItemId}`,
        inputSchemaVersion: matchRequest.inputSchemaVersion,
        outputSchemaVersion: CONTEXT_PROJECT_MATCH_OUTPUT_SCHEMA_VERSION,
        promptTemplateVersion: CONTEXT_PROJECT_MATCH_PROMPT_VERSION,
        outputSchema: ContextProjectMatchAiOutputSchema,
        sourceReferences: matchSources,
        classification: "confidential",
        timeoutMs: this.dependencies.timeoutMs,
        requiresHumanApproval: true,
        correlationId: command.correlationId,
      },
      async () => ({ outputReference: matchReference }),
    );
    assertContextProjectMatchSemantics(matchRun.output, matchSources);
    const matchTrace = await requireTrace(this.dependencies.aiRuns, matchRun, {
      routeKey: CONTEXT_PROJECT_MATCH_ROUTE,
      outputSchemaVersion: CONTEXT_PROJECT_MATCH_OUTPUT_SCHEMA_VERSION,
      promptTemplateVersion: CONTEXT_PROJECT_MATCH_PROMPT_VERSION,
      sourceReferences: matchSources,
    });
    const suggestion = await this.dependencies.suggestions.recordDecision({
      actor: command.actor,
      analysisId: analysis.id,
      sourceItemId: command.sourceItemId,
      decision,
      schemaVersion: CONTEXT_PROJECT_MATCH_OUTPUT_SCHEMA_VERSION,
      promptVersion: CONTEXT_PROJECT_MATCH_PROMPT_VERSION,
      routeTrace: publicTrace(matchTrace),
      sourceReferences: matchRun.output.sourceReferences,
      suggestionId,
      aiExplanation: {
        label: matchRun.output.interpretationLabel,
        text: matchRun.output.explanation,
        sourceReferences: matchRun.output.sourceReferences,
        uncertainties: matchRun.output.uncertainties,
      },
    });
    return { analysis, decision, suggestion } as const;
  }

  private id(kind: "analysis" | "suggestion", command: AnalyzeContextCommand): string {
    return (
      this.dependencies.idFactory?.(kind) ??
      stableInitialId(kind, command.actor.userId, command.sourceItemId)
    );
  }
}

export function assertDeterministicTaskProject(
  decision: LinkDecision,
  draft: Readonly<{ projectId: string | null; workstreamId: string | null }>,
): void {
  const valid =
    decision.kind === "AUTO_LINK"
      ? draft.projectId === decision.projectId
      : draft.projectId === null && draft.workstreamId === null;
  if (!valid) {
    throw new Error("AI Task draft cannot upgrade the deterministic Project decision");
  }
  if (draft.workstreamId !== null && draft.projectId === null) {
    throw new Error("AI Task draft Workstream requires its deterministic Project");
  }
}

export async function requirePrompt(
  reader: ContextPromptArtifactPublicReader,
  routeKey: string,
  version: string,
  trustedBody: string,
): Promise<ContextPromptArtifact> {
  const artifact = await reader.read(routeKey, version);
  const expectedHash = createHash("sha256").update(trustedBody).digest("hex");
  if (
    artifact === null ||
    artifact.routeKey !== routeKey ||
    artifact.version !== version ||
    artifact.bodyHash !== expectedHash ||
    artifact.trustedBody !== trustedBody
  ) {
    throw new Error("Governed Context Intelligence prompt artifact does not match");
  }
  return artifact;
}

export async function requireTrace<T>(
  reader: SucceededAiRunTracePublicReader,
  result: Readonly<{ runId: string; outputReference: string; output: T }>,
  expected: Readonly<{
    routeKey: string;
    outputSchemaVersion: string;
    promptTemplateVersion: string;
    sourceReferences: readonly string[];
  }>,
): Promise<SucceededAiRunTrace> {
  const trace = await reader.readSucceeded(result.runId);
  if (
    trace === null ||
    trace.id !== result.runId ||
    trace.state !== "succeeded" ||
    trace.routeKey !== expected.routeKey ||
    trace.outputSchemaVersion !== expected.outputSchemaVersion ||
    trace.promptTemplateVersion !== expected.promptTemplateVersion ||
    trace.outputReference !== result.outputReference ||
    !sameReferences(trace.sourceReferences, expected.sourceReferences)
  ) {
    throw new Error("Governed Context Intelligence AI run trace does not match");
  }
  return trace;
}

function publicTrace(trace: SucceededAiRunTrace) {
  return {
    aiRunId: trace.id,
    routeKey: trace.routeKey,
    routeConfigId: trace.routeConfigId,
    routeConfigVersion: trace.routeConfigVersion,
  };
}

function decisionSourceReferences(decision: LinkDecision): string[] {
  return decision.kind === "AUTO_LINK"
    ? decision.anchors.map(({ reference }) => reference)
    : decision.kind === "REVIEW"
      ? decision.candidates.flatMap(({ anchors }) => anchors.map(({ anchor }) => anchor.reference))
      : [];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function boundedReferences(values: readonly string[]): string[] {
  const references = unique(values);
  if (references.length === 0 || references.length > 50) {
    throw new Error("Context Intelligence AI source references exceed the Router limit");
  }
  return references;
}

function sameReferences(left: readonly string[], right: readonly string[]): boolean {
  const a = unique(left).sort();
  const b = unique(right).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function stableInitialId(kind: string, employeeId: string, sourceItemId: string): string {
  const bytes = createHash("sha256")
    .update(`context-intelligence:${kind}:${employeeId}:${sourceItemId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requireInitialAnalysis(
  value: ContextAnalysis,
  id: string,
  command: AnalyzeContextCommand,
): ContextAnalysis {
  const analysis = ContextAnalysisSchema.parse(value);
  if (
    analysis.id !== id ||
    analysis.employeeId !== command.actor.userId ||
    analysis.sourceItemId !== command.sourceItemId ||
    analysis.revision !== 1
  ) {
    throw new Error("Persisted Context Analysis does not match the stable operation");
  }
  return analysis;
}
