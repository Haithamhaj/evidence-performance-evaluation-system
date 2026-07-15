import { AppError } from "@evaluation/contracts";

import { AiProviderError } from "./contracts.js";
import { validateAiOutput, validateAiOutputSchema } from "./output-validator.js";
import { resolveFallback, resolveRoute } from "./resolve-route.js";

export class AiRouter {
  private readonly routes: import("./contracts.js").RouteRepository;
  private readonly traces: import("./contracts.js").RunTraceRepository;
  private readonly adapters: ReadonlyMap<string, import("./contracts.js").AiProviderAdapter>;

  constructor(
    routes: import("./contracts.js").RouteRepository,
    traces: import("./contracts.js").RunTraceRepository,
    adapters: readonly import("./contracts.js").AiProviderAdapter[],
  ) {
    this.routes = routes;
    this.traces = traces;
    const entries = adapters.map((adapter) => [adapter.providerKey, adapter] as const);
    if (new Set(entries.map(([key]) => key)).size !== entries.length) {
      throw new Error("AI provider keys must be unique");
    }
    this.adapters = new Map(entries);
  }

  async run<TInput, TOutput>(
    input: import("./contracts.js").AiRunRequest<TInput, TOutput>,
    persistValidatedOutput: import("./contracts.js").PersistValidatedOutput<TOutput>,
  ): Promise<import("./contracts.js").ValidatedAiResult<TOutput>> {
    validateRequest(input);
    validateAiOutputSchema(input.routeKey, input.outputSchema);
    const route = await resolveRoute(
      this.routes,
      input.routeKey,
      {
        ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
        ...(input.departmentId === undefined ? {} : { departmentId: input.departmentId }),
        systemId: input.systemId,
      },
      input.classification,
    );
    const startedAt = new Date();
    const fallbackChain: import("./contracts.js").FallbackHop[] = [];
    let providerIndex = 0;

    while (providerIndex < route.providers.length) {
      const provider = route.providers[providerIndex]!;
      const adapter = this.adapters.get(provider.providerKey);
      if (adapter === undefined || adapter.locality !== provider.locality) {
        const category = "non_retryable" as const;
        fallbackChain.push({ ...provider, outcome: category });
        return this.failRun(input, route, provider, startedAt, fallbackChain, category);
      }

      let result: import("./contracts.js").ProviderResult;
      try {
        result = await generateWithTimeout(
          adapter,
          {
            routeKey: input.routeKey,
            modelKey: provider.modelKey,
            input: input.input,
          },
          input.timeoutMs,
        );
      } catch (error) {
        const category = normalizedCategory(error);
        fallbackChain.push({
          providerKey: provider.providerKey,
          modelKey: provider.modelKey,
          outcome: category,
        });
        let fallback;
        try {
          fallback = resolveFallback(route, providerIndex, input.classification, category);
        } catch (fallbackError) {
          await this.appendTrace(
            input,
            route,
            provider,
            startedAt,
            fallbackChain,
            "failed",
            "policy",
            null,
            null,
            null,
            [],
          );
          throw fallbackError;
        }
        if (fallback === null) {
          return this.failRun(input, route, provider, startedAt, fallbackChain, category);
        }
        providerIndex += 1;
        continue;
      }

      const validation = validateAiOutput(input.routeKey, input.outputSchema, result.output);
      if (!validation.valid) {
        fallbackChain.push({
          providerKey: provider.providerKey,
          modelKey: provider.modelKey,
          outcome: "invalid_output",
        });
        await this.appendTrace(
          input,
          route,
          provider,
          startedAt,
          fallbackChain,
          "quarantined",
          "invalid_output",
          null,
          sanitizeUsage(result.usage),
          sanitizeCost(result.costUsd),
          validation.issueCodes,
        );
        throw new AppError("AI_OUTPUT_QUARANTINED", "errors.ai.outputQuarantined", 502);
      }

      const persisted = await persistValidatedOutput(validation.output);
      if (persisted.outputReference.trim().length === 0) {
        throw new AppError("AI_OUTPUT_REFERENCE_INVALID", "errors.ai.outputReferenceInvalid", 500);
      }
      fallbackChain.push({
        providerKey: provider.providerKey,
        modelKey: provider.modelKey,
        outcome: "succeeded",
      });
      const run = await this.appendTrace(
        input,
        route,
        provider,
        startedAt,
        fallbackChain,
        "succeeded",
        null,
        persisted.outputReference,
        sanitizeUsage(result.usage),
        sanitizeCost(result.costUsd),
        [],
      );
      return {
        runId: run.id,
        output: validation.output,
        outputReference: persisted.outputReference,
        requiresHumanApproval: input.requiresHumanApproval,
      };
    }

    throw new AppError("AI_ROUTE_INVALID", "errors.ai.routeInvalid", 500);
  }

  private async failRun<TInput, TOutput>(
    input: import("./contracts.js").AiRunRequest<TInput, TOutput>,
    route: import("./contracts.js").ResolvedRoute,
    provider: import("./contracts.js").ResolvedRoute["providers"][number],
    startedAt: Date,
    fallbackChain: readonly import("./contracts.js").FallbackHop[],
    category: import("./contracts.js").ProviderErrorCategory,
  ): Promise<never> {
    await this.appendTrace(
      input,
      route,
      provider,
      startedAt,
      fallbackChain,
      category === "invalid_output" ? "quarantined" : "failed",
      category,
      null,
      null,
      null,
      [],
    );
    throw new AppError("AI_PROVIDER_FAILED", "errors.ai.providerFailed", 502);
  }

  private appendTrace<TInput, TOutput>(
    input: import("./contracts.js").AiRunRequest<TInput, TOutput>,
    route: import("./contracts.js").ResolvedRoute,
    provider: import("./contracts.js").ResolvedRoute["providers"][number],
    startedAt: Date,
    fallbackChain: readonly import("./contracts.js").FallbackHop[],
    state: import("./contracts.js").AiRunTrace["state"],
    errorCategory: import("./contracts.js").ProviderErrorCategory | null,
    outputReference: string | null,
    usage: import("./contracts.js").AiRunTrace["usage"],
    costUsd: number | null,
    validationIssueCodes: readonly string[],
  ) {
    const completedAt = new Date();
    return this.traces.appendRunTrace({
      routeKey: input.routeKey,
      routeId: route.routeId,
      routeConfigId: route.configId,
      routeConfigVersion: route.configVersion,
      routeLevel: route.level,
      scopeId: route.scopeId,
      providerKey: provider.providerKey,
      modelKey: provider.modelKey,
      classification: input.classification,
      inputReference: input.inputReference,
      inputSchemaVersion: input.inputSchemaVersion,
      outputSchemaVersion: input.outputSchemaVersion,
      promptTemplateVersion: input.promptTemplateVersion,
      sourceReferences: [...input.sourceReferences],
      outputReference,
      startedAt,
      completedAt,
      latencyMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      usage,
      costUsd,
      state,
      errorCategory,
      fallbackChain: [...fallbackChain],
      humanApprovalState: input.requiresHumanApproval ? "pending" : "not_required",
      correlationId: input.correlationId,
      validationIssueCodes: [...validationIssueCodes],
    });
  }
}

async function generateWithTimeout(
  adapter: import("./contracts.js").AiProviderAdapter,
  request: Parameters<import("./contracts.js").AiProviderAdapter["generate"]>[0],
  timeoutMs: number,
): Promise<import("./contracts.js").ProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Timed out", "TimeoutError")),
    timeoutMs,
  );
  try {
    return await adapter.generate(request, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizedCategory(error: unknown): import("./contracts.js").ProviderErrorCategory {
  return error instanceof AiProviderError ? error.category : "retryable";
}

function validateRequest<TInput, TOutput>(
  input: import("./contracts.js").AiRunRequest<TInput, TOutput>,
): void {
  if (
    input.routeKey.trim().length === 0 ||
    input.inputReference.trim().length === 0 ||
    input.inputSchemaVersion.trim().length === 0 ||
    input.outputSchemaVersion.trim().length === 0 ||
    input.promptTemplateVersion.trim().length === 0 ||
    input.sourceReferences.some((reference) => reference.trim().length === 0) ||
    !Number.isSafeInteger(input.timeoutMs) ||
    input.timeoutMs < 1 ||
    input.timeoutMs > 300_000
  ) {
    throw new AppError("AI_RUN_REQUEST_INVALID", "errors.ai.runRequestInvalid", 400);
  }
}

function sanitizeUsage(
  usage: import("./contracts.js").ProviderResult["usage"],
): import("./contracts.js").AiRunTrace["usage"] {
  if (usage === undefined) return null;
  const approved: { inputTokens?: number; outputTokens?: number; totalTokens?: number } = {};
  const inputTokens = safeUsageCount(usage.inputTokens);
  const outputTokens = safeUsageCount(usage.outputTokens);
  const totalTokens = safeUsageCount(usage.totalTokens);
  if (inputTokens !== undefined) approved.inputTokens = inputTokens;
  if (outputTokens !== undefined) approved.outputTokens = outputTokens;
  if (totalTokens !== undefined) approved.totalTokens = totalTokens;
  return Object.keys(approved).length === 0 ? null : approved;
}

function safeUsageCount(value: number | undefined): number | undefined {
  return Number.isSafeInteger(value) && (value ?? -1) >= 0 ? value : undefined;
}

function sanitizeCost(cost: number | undefined): number | null {
  return typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : null;
}
