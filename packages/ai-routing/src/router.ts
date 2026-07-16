import { AppError } from "@evaluation/contracts";

import {
  AiProviderError,
  OpaqueReferenceSchema,
  RouteKeySchema,
  VersionReferenceSchema,
} from "./contracts.js";
import { validateAiOutput, validateAiOutputSchema } from "./output-validator.js";
import { outputSchemaDescriptor } from "./configuration.js";
import { resolveFallback, resolveRoute } from "./resolve-route.js";

export class AiRouter<TTransaction = unknown> {
  private readonly routes: import("./contracts.js").RouteRepository;
  private readonly traces: import("./contracts.js").RunTraceRepository<TTransaction>;
  private readonly adapters: ReadonlyMap<string, import("./contracts.js").AiProviderAdapter>;

  constructor(
    routes: import("./contracts.js").RouteRepository,
    traces: import("./contracts.js").RunTraceRepository<TTransaction>,
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
    persistValidatedOutput: import("./contracts.js").PersistValidatedOutput<TOutput, TTransaction>,
  ): Promise<import("./contracts.js").ValidatedAiResult<TOutput>> {
    validateRequest(input);
    const deadline = new WholeRunDeadline(input.timeoutMs);
    const startedAt = new Date();
    try {
      return await this.runWithinDeadline(input, persistValidatedOutput, deadline, startedAt);
    } finally {
      deadline.dispose();
    }
  }

  private async runWithinDeadline<TInput, TOutput>(
    input: import("./contracts.js").AiRunRequest<TInput, TOutput>,
    persistValidatedOutput: import("./contracts.js").PersistValidatedOutput<TOutput, TTransaction>,
    deadline: WholeRunDeadline,
    startedAt: Date,
  ): Promise<import("./contracts.js").ValidatedAiResult<TOutput>> {
    deadline.assertActive();
    validateAiOutputSchema(input.routeKey, input.outputSchema);
    deadline.assertActive();
    const schemaDescriptor = outputSchemaDescriptor(
      input.routeKey,
      input.outputSchemaVersion,
      input.outputSchema,
    );
    deadline.assertActive();
    const schemaArtifact = await deadline.race(() =>
      this.routes.findOutputSchemaArtifact({
        routeKey: input.routeKey,
        version: input.outputSchemaVersion,
        schemaHash: schemaDescriptor.schemaHash,
      }),
    );
    if (schemaArtifact === null) {
      throw new AppError("AI_SCHEMA_ARTIFACT_NOT_FOUND", "errors.ai.schemaArtifactNotFound", 500);
    }
    if (schemaArtifact.routeKey !== input.routeKey) {
      throw new AppError(
        "AI_SCHEMA_ARTIFACT_ROUTE_MISMATCH",
        "errors.ai.schemaArtifactRouteMismatch",
        500,
      );
    }
    const invocationScope = {
      ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      ...(input.departmentId === undefined ? {} : { departmentId: input.departmentId }),
      systemId: input.systemId,
    };
    await deadline.race(() => this.routes.validateInvocationScope(invocationScope));
    const route = await deadline.race(() =>
      resolveRoute(this.routes, input.routeKey, invocationScope, input.classification),
    );
    const fallbackChain: import("./contracts.js").FallbackHop[] = [];
    let providerIndex = 0;

    while (providerIndex < route.providers.length) {
      const provider = route.providers[providerIndex]!;
      const adapter = this.adapters.get(provider.providerKey);
      if (adapter === undefined || !adapter.matchesConfiguration(provider)) {
        const category = "non_retryable" as const;
        fallbackChain.push({ ...provider, outcome: category });
        return this.failRun(
          input,
          schemaArtifact,
          route,
          provider,
          startedAt,
          fallbackChain,
          category,
        );
      }

      let result: import("./contracts.js").ProviderResult;
      try {
        result = await deadline.race(() =>
          adapter.generate(
            {
              routeKey: input.routeKey,
              modelKey: provider.modelKey,
              input: input.input,
            },
            deadline.signal,
          ),
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
            schemaArtifact,
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
          return this.failRun(
            input,
            schemaArtifact,
            route,
            provider,
            startedAt,
            fallbackChain,
            category,
          );
        }
        providerIndex += 1;
        continue;
      }

      const validation = await deadline.race(async () =>
        validateAiOutput(input.routeKey, input.outputSchema, result.output),
      );
      if (!validation.valid) {
        fallbackChain.push({
          providerKey: provider.providerKey,
          modelKey: provider.modelKey,
          outcome: "invalid_output",
        });
        await this.appendTrace(
          input,
          schemaArtifact,
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

      fallbackChain.push({
        providerKey: provider.providerKey,
        modelKey: provider.modelKey,
        outcome: "succeeded",
      });
      let run: Readonly<{
        id: string;
        outputReference: import("./contracts.js").OpaqueReference;
      }>;
      try {
        run = await deadline.race(() =>
          this.traces.commitSucceededRun({
            output: validation.output,
            persistValidatedOutput: async (transaction, output) => {
              const persisted = await persistValidatedOutput(transaction, output);
              const parsed = OpaqueReferenceSchema.safeParse(persisted.outputReference);
              if (!parsed.success) {
                throw new AppError(
                  "AI_OUTPUT_REFERENCE_INVALID",
                  "errors.ai.outputReferenceInvalid",
                  500,
                );
              }
              return { outputReference: parsed.data };
            },
            buildTrace: (outputReference) =>
              this.createTrace(
                input,
                schemaArtifact,
                route,
                provider,
                startedAt,
                fallbackChain,
                "succeeded",
                null,
                outputReference,
                sanitizeUsage(result.usage),
                sanitizeCost(result.costUsd),
                [],
              ),
            signal: deadline.signal,
            timeoutMs: deadline.remainingMs(),
          }),
        );
      } catch (error) {
        if (!deadline.signal.aborted) {
          try {
            await deadline.race(() =>
              this.appendTrace(
                input,
                schemaArtifact,
                route,
                provider,
                startedAt,
                fallbackChain,
                "failed",
                "persistence",
                null,
                null,
                null,
                [],
              ),
            );
          } catch {
            // The success transaction rolled back; return only a sanitized application error.
          }
        }
        if (error instanceof AppError && error.code === "AI_OUTPUT_REFERENCE_INVALID") throw error;
        throw new AppError("AI_RUN_PERSISTENCE_FAILED", "errors.ai.runPersistenceFailed", 500);
      }
      return {
        runId: run.id,
        output: validation.output,
        outputReference: run.outputReference,
        requiresHumanApproval: input.requiresHumanApproval,
      };
    }

    throw new AppError("AI_ROUTE_INVALID", "errors.ai.routeInvalid", 500);
  }

  private async failRun<TInput, TOutput>(
    input: import("./contracts.js").AiRunRequest<TInput, TOutput>,
    schemaArtifact: Readonly<{ id: string; routeKey: string; version: string; schemaHash: string }>,
    route: import("./contracts.js").ResolvedRoute,
    provider: import("./contracts.js").ResolvedRoute["providers"][number],
    startedAt: Date,
    fallbackChain: readonly import("./contracts.js").FallbackHop[],
    category: import("./contracts.js").ProviderErrorCategory,
  ): Promise<never> {
    await this.appendTrace(
      input,
      schemaArtifact,
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
    schemaArtifact: Readonly<{ id: string; routeKey: string; version: string; schemaHash: string }>,
    route: import("./contracts.js").ResolvedRoute,
    provider: import("./contracts.js").ResolvedRoute["providers"][number],
    startedAt: Date,
    fallbackChain: readonly import("./contracts.js").FallbackHop[],
    state: import("./contracts.js").AiRunTrace["state"],
    errorCategory: import("./contracts.js").RunErrorCategory | null,
    outputReference: string | null,
    usage: import("./contracts.js").AiRunTrace["usage"],
    costUsd: number | null,
    validationIssueCodes: readonly string[],
  ) {
    return this.traces.appendRunTrace(
      this.createTrace(
        input,
        schemaArtifact,
        route,
        provider,
        startedAt,
        fallbackChain,
        state,
        errorCategory,
        outputReference,
        usage,
        costUsd,
        validationIssueCodes,
      ),
    );
  }

  private createTrace<TInput, TOutput>(
    input: import("./contracts.js").AiRunRequest<TInput, TOutput>,
    schemaArtifact: Readonly<{ id: string; routeKey: string; version: string; schemaHash: string }>,
    route: import("./contracts.js").ResolvedRoute,
    provider: import("./contracts.js").ResolvedRoute["providers"][number],
    startedAt: Date,
    fallbackChain: readonly import("./contracts.js").FallbackHop[],
    state: import("./contracts.js").AiRunTrace["state"],
    errorCategory: import("./contracts.js").RunErrorCategory | null,
    outputReference: string | null,
    usage: import("./contracts.js").AiRunTrace["usage"],
    costUsd: number | null,
    validationIssueCodes: readonly string[],
  ): import("./contracts.js").AiRunTrace {
    const completedAt = new Date();
    return {
      routeKey: input.routeKey,
      routeId: route.routeId,
      routeConfigId: route.configId,
      routeConfigVersion: route.configVersion,
      routeLevel: route.level,
      scopeId: route.scopeId,
      routeConfigProviderId: provider.routeConfigProviderId,
      providerConfigId: provider.providerConfigId,
      providerConfigVersion: provider.providerConfigVersion,
      providerKey: provider.providerKey,
      modelKey: provider.modelKey,
      classification: input.classification,
      inputReference: input.inputReference,
      inputSchemaVersion: input.inputSchemaVersion,
      outputSchemaVersion: input.outputSchemaVersion,
      outputSchemaArtifactId: schemaArtifact.id,
      outputSchemaHash: schemaArtifact.schemaHash,
      promptTemplateVersion: input.promptTemplateVersion,
      sourceReferences: [...input.sourceReferences],
      projectScopeId: input.projectId ?? null,
      departmentScopeId: input.departmentId ?? null,
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
    };
  }
}

class WholeRunDeadline {
  private readonly controller = new AbortController();
  private readonly expiresAt: number;

  constructor(timeoutMs: number) {
    this.expiresAt = performance.now() + timeoutMs;
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  async race<T>(start: () => Promise<T>): Promise<T> {
    const remaining = this.expiresAt - performance.now();
    if (remaining <= 0 || this.signal.aborted) {
      this.abort();
      throw new AiProviderError("timeout");
    }
    const operation = Promise.resolve().then(start);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;
    const expired = new Promise<never>((_, reject) => {
      abortListener = () => reject(new AiProviderError("timeout"));
      this.signal.addEventListener("abort", abortListener, { once: true });
      timeout = setTimeout(() => this.abort(), remaining);
    });
    try {
      const result = await Promise.race([operation, expired]);
      this.assertActive();
      return result;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      if (abortListener !== undefined) this.signal.removeEventListener("abort", abortListener);
      operation.catch(() => undefined);
    }
  }

  dispose(): void {
    this.abort();
  }

  remainingMs(): number {
    this.assertActive();
    return Math.max(1, Math.ceil(this.expiresAt - performance.now()));
  }

  assertActive(): void {
    if (this.expiresAt - performance.now() <= 0 || this.signal.aborted) {
      this.abort();
      throw new AiProviderError("timeout");
    }
  }

  private abort(): void {
    if (!this.controller.signal.aborted) {
      this.controller.abort(new DOMException("Timed out", "TimeoutError"));
    }
  }
}

function normalizedCategory(error: unknown): import("./contracts.js").ProviderErrorCategory {
  return error instanceof AiProviderError ? error.category : "non_retryable";
}

function validateRequest<TInput, TOutput>(
  input: import("./contracts.js").AiRunRequest<TInput, TOutput>,
): void {
  const validReferences =
    OpaqueReferenceSchema.safeParse(input.inputReference).success &&
    input.sourceReferences.length > 0 &&
    input.sourceReferences.length <= 50 &&
    input.sourceReferences.every((reference) => OpaqueReferenceSchema.safeParse(reference).success);
  const validVersions = [
    input.inputSchemaVersion,
    input.outputSchemaVersion,
    input.promptTemplateVersion,
  ].every((version) => VersionReferenceSchema.safeParse(version).success);
  if (
    !RouteKeySchema.safeParse(input.routeKey).success ||
    !validReferences ||
    !validVersions ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      input.correlationId,
    ) ||
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
