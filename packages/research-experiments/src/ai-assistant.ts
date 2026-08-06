import { createHash } from "node:crypto";

import { AppError, ResearchAiRouteTraceSchema } from "@evaluation/contracts";
import type { z } from "zod";

import {
  EXPERIMENT_INTERPRET_ROUTE,
  EXPERIMENT_METHOD_REVIEW_ROUTE,
  RESEARCH_AI_ROUTES,
  RESEARCH_FRAME_ROUTE,
  RESEARCH_SOURCE_REVIEW_ROUTE,
  RESEARCH_SYNTHESIZE_ROUTE,
  assertExperimentInterpretationSemantics,
  assertExperimentMethodReviewSemantics,
  assertResearchOutputSemantics,
  buildResearchAiRequest,
} from "./prompts.js";

export type ResearchPromptArtifact = Readonly<{
  id: string;
  routeKey: string;
  version: string;
  bodyHash: string;
  trustedBody: string;
}>;

export interface ResearchPromptArtifactPublicReader {
  read(routeKey: string, version: string): Promise<ResearchPromptArtifact | null>;
}

export type SucceededResearchAiRunTrace = Readonly<{
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

export interface SucceededResearchAiRunTracePublicReader {
  readSucceeded(runId: string): Promise<SucceededResearchAiRunTrace | null>;
}

type Router<TTransaction> = Pick<import("@evaluation/ai-routing").AiRouter<TTransaction>, "run">;

type Dependencies<TTransaction> = Readonly<{
  router: Router<TTransaction>;
  promptArtifacts: ResearchPromptArtifactPublicReader;
  aiRuns: SucceededResearchAiRunTracePublicReader;
}>;

export type ResearchAiCommand<TPayload = unknown> = Readonly<{
  projectId: string;
  departmentId?: string;
  systemId: string;
  correlationId: string;
  inputReference: string;
  outputReference: string;
  sourceReferences: readonly string[];
  payload: TPayload;
}>;

export type ResearchSourceReviewAiCommand = ResearchAiCommand<
  Readonly<{
    retrievalState: "RETRIEVED" | "PARTIAL" | "BLOCKED";
    retrievedText: string | null;
    retrievalReason?: string | null;
    projectContext: unknown;
    [key: string]: unknown;
  }>
>;

export type ExperimentInterpretAiCommand = ResearchAiCommand<
  Readonly<{
    runId: string;
    methodRevisionId: string;
    resultStatus: "COMPLETED" | "FAILED" | "INVALID" | "STOPPED";
    runReference: string;
    [key: string]: unknown;
  }>
>;

export type GovernedResearchAiResult<T> = Readonly<{
  output: T;
  outputReference: string;
  promptVersion: string;
  requiresHumanApproval: true;
  routeTrace: Readonly<{
    aiRunId: string;
    routeKey: string;
    routeConfigId: string;
    routeConfigVersion: number;
  }>;
}>;

export class ResearchAiAssistant<TTransaction = unknown> {
  private readonly dependencies: Dependencies<TTransaction>;

  constructor(dependencies: Dependencies<TTransaction>) {
    this.dependencies = dependencies;
  }

  async reviewSource(
    command: ResearchSourceReviewAiCommand,
    persist: import("@evaluation/ai-routing").PersistValidatedOutput<
      import("./prompts.js").ResearchSourceReviewAiOutput,
      TTransaction
    >,
  ): Promise<GovernedResearchAiResult<import("./prompts.js").ResearchSourceReviewAiOutput>> {
    if (command.payload.retrievalState === "BLOCKED" || command.payload.retrievedText === null) {
      throw new AppError(
        "RESEARCH_AI_SOURCE_UNAVAILABLE",
        "errors.research.aiSourceUnavailable",
        409,
      );
    }
    return this.run(RESEARCH_SOURCE_REVIEW_ROUTE, command, persist, (output, references) => {
      assertResearchOutputSemantics(output, references);
      if (command.payload.retrievalState === "PARTIAL" && output.uncertainties.length === 0) {
        throw invalidOutput();
      }
    });
  }

  async frameResearch(
    command: ResearchAiCommand,
    persist: import("@evaluation/ai-routing").PersistValidatedOutput<
      import("./prompts.js").ResearchFrameAiOutput,
      TTransaction
    >,
  ): Promise<GovernedResearchAiResult<import("./prompts.js").ResearchFrameAiOutput>> {
    return this.run<import("./prompts.js").ResearchFrameAiOutput>(
      RESEARCH_FRAME_ROUTE,
      command,
      persist,
      assertResearchOutputSemantics,
    );
  }

  async synthesizeResearch(
    command: ResearchAiCommand,
    persist: import("@evaluation/ai-routing").PersistValidatedOutput<
      import("./prompts.js").ResearchSynthesisAiOutput,
      TTransaction
    >,
  ): Promise<GovernedResearchAiResult<import("./prompts.js").ResearchSynthesisAiOutput>> {
    return this.run(RESEARCH_SYNTHESIZE_ROUTE, command, persist, (output, references) => {
      assertResearchOutputSemantics(output, references);
      const topLevel = new Set(output.sourceReferences);
      if (
        output.supportedFindings.some(({ sourceReferences }) =>
          sourceReferences.some((reference) => !topLevel.has(reference)),
        )
      ) {
        throw invalidOutput();
      }
    });
  }

  async reviewExperimentMethod(
    command: ResearchAiCommand,
    persist: import("@evaluation/ai-routing").PersistValidatedOutput<
      import("./prompts.js").ExperimentMethodReviewAiOutput,
      TTransaction
    >,
  ): Promise<GovernedResearchAiResult<import("./prompts.js").ExperimentMethodReviewAiOutput>> {
    return this.run(
      EXPERIMENT_METHOD_REVIEW_ROUTE,
      command,
      persist,
      assertExperimentMethodReviewSemantics,
    );
  }

  async interpretExperiment(
    command: ExperimentInterpretAiCommand,
    persist: import("@evaluation/ai-routing").PersistValidatedOutput<
      import("./prompts.js").ExperimentInterpretAiOutput,
      TTransaction
    >,
  ): Promise<GovernedResearchAiResult<import("./prompts.js").ExperimentInterpretAiOutput>> {
    return this.run(EXPERIMENT_INTERPRET_ROUTE, command, persist, (output, references) =>
      assertExperimentInterpretationSemantics(output, references, command.payload),
    );
  }

  private async run<TOutput>(
    routeKey: string,
    command: ResearchAiCommand,
    persist: import("@evaluation/ai-routing").PersistValidatedOutput<TOutput, TTransaction>,
    assertSemantics: (output: TOutput, allowedReferences: readonly string[]) => void,
  ): Promise<GovernedResearchAiResult<TOutput>> {
    try {
      const route = requireRoute<TOutput>(routeKey);
      const prompt = await requirePrompt(this.dependencies.promptArtifacts, route);
      const request = buildResearchAiRequest({
        routeKey,
        prompt: { artifactId: prompt.id, sha256: prompt.bodyHash },
        allowedSourceReferences: command.sourceReferences,
        untrustedPayload: command.payload,
      });
      const sourceReferences = request.input.allowedSourceReferences;
      const result = await this.dependencies.router.run(
        {
          routeKey,
          projectId: command.projectId,
          ...(command.departmentId === undefined ? {} : { departmentId: command.departmentId }),
          systemId: command.systemId,
          input: request.input,
          inputReference: command.inputReference,
          inputSchemaVersion: route.inputSchemaVersion,
          outputSchemaVersion: route.outputSchemaVersion,
          promptTemplateVersion: route.promptTemplateVersion,
          outputSchema: route.outputSchema,
          sourceReferences,
          classification: "confidential",
          timeoutMs: 60_000,
          requiresHumanApproval: true,
          correlationId: command.correlationId,
        },
        async (transaction, output) => {
          assertSemantics(output, sourceReferences);
          const persisted = await persist(transaction, output);
          if (persisted.outputReference !== command.outputReference) throw invalidOutput();
          return persisted;
        },
      );
      requireResult(result, command.outputReference);
      assertSemantics(result.output, sourceReferences);
      const trace = await requireTrace(this.dependencies.aiRuns, result, {
        routeKey,
        outputSchemaVersion: route.outputSchemaVersion,
        promptTemplateVersion: route.promptTemplateVersion,
        sourceReferences,
      });
      const routeTrace = ResearchAiRouteTraceSchema.parse({
        aiRunId: trace.id,
        routeKey: trace.routeKey,
        routeConfigId: trace.routeConfigId,
        routeConfigVersion: trace.routeConfigVersion,
      });
      return {
        output: result.output,
        outputReference: result.outputReference,
        promptVersion: route.promptTemplateVersion,
        requiresHumanApproval: true,
        routeTrace,
      };
    } catch (error) {
      if (error instanceof AppError && error.code === "RESEARCH_AI_SOURCE_UNAVAILABLE") throw error;
      throw new AppError(
        "RESEARCH_AI_ASSISTANCE_UNAVAILABLE",
        "errors.research.aiAssistanceUnavailable",
        503,
      );
    }
  }
}

type RouteMetadata<TOutput> = Readonly<{
  routeKey: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  promptTemplateVersion: string;
  trustedPrompt: string;
  outputSchema: z.ZodType<TOutput>;
}>;

function requireRoute<TOutput>(routeKey: string): RouteMetadata<TOutput> {
  const route = RESEARCH_AI_ROUTES.find((candidate) => candidate.routeKey === routeKey);
  if (route === undefined) throw invalidOutput();
  return route as unknown as RouteMetadata<TOutput>;
}

async function requirePrompt<TOutput>(
  reader: ResearchPromptArtifactPublicReader,
  route: RouteMetadata<TOutput>,
): Promise<ResearchPromptArtifact> {
  const artifact = await reader.read(route.routeKey, route.promptTemplateVersion);
  const expectedHash = createHash("sha256").update(route.trustedPrompt).digest("hex");
  if (
    artifact === null ||
    artifact.routeKey !== route.routeKey ||
    artifact.version !== route.promptTemplateVersion ||
    artifact.bodyHash !== expectedHash ||
    artifact.trustedBody !== route.trustedPrompt
  ) {
    throw invalidOutput();
  }
  return artifact;
}

function requireResult<TOutput>(
  result: import("@evaluation/ai-routing").ValidatedAiResult<TOutput>,
  outputReference: string,
): void {
  if (!result.requiresHumanApproval || result.outputReference !== outputReference) {
    throw invalidOutput();
  }
}

async function requireTrace<TOutput>(
  reader: SucceededResearchAiRunTracePublicReader,
  result: import("@evaluation/ai-routing").ValidatedAiResult<TOutput>,
  expected: Readonly<{
    routeKey: string;
    outputSchemaVersion: string;
    promptTemplateVersion: string;
    sourceReferences: readonly string[];
  }>,
): Promise<SucceededResearchAiRunTrace> {
  const trace = await reader.readSucceeded(result.runId);
  if (
    trace === null ||
    trace.id !== result.runId ||
    trace.routeKey !== expected.routeKey ||
    trace.outputSchemaVersion !== expected.outputSchemaVersion ||
    trace.promptTemplateVersion !== expected.promptTemplateVersion ||
    trace.outputReference !== result.outputReference ||
    !sameReferences(trace.sourceReferences, expected.sourceReferences)
  ) {
    throw invalidOutput();
  }
  return trace;
}

function sameReferences(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((reference, index) => reference === [...right].sort()[index])
  );
}

function invalidOutput(): AppError {
  return new AppError("RESEARCH_AI_OUTPUT_INVALID", "errors.research.aiOutputInvalid", 409);
}
