import type { z } from "zod";

export type DataClassification = "public" | "internal" | "confidential" | "local_only";
export type ProviderLocality = "local" | "external";
export type ProviderErrorCategory =
  "retryable" | "non_retryable" | "policy" | "timeout" | "invalid_output";
export type RouteLevel = "project" | "department" | "system";

export type AiProviderRoute = Readonly<{
  providerKey: string;
  modelKey: string;
  locality: ProviderLocality;
}>;

export type ResolvedRoute = Readonly<{
  routeId: string;
  configId: string;
  configVersion: number;
  level: RouteLevel;
  scopeId: string;
  routeKey: string;
  providers: readonly AiProviderRoute[];
}>;

export type RouteScope = Readonly<{
  projectId?: string;
  departmentId?: string;
  systemId: string;
}>;

export interface RouteRepository {
  findActiveRoute(
    query: Readonly<{
      routeKey: string;
      level: RouteLevel;
      scopeId: string;
    }>,
  ): Promise<ResolvedRoute | null>;
}

export type ProviderRequest = Readonly<{
  routeKey: string;
  modelKey: string;
  input: unknown;
}>;

export type ProviderUsage = Readonly<{
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}>;

export type ProviderResult = Readonly<{
  output: unknown;
  usage?: ProviderUsage;
  costUsd?: number;
}>;

export interface AiProviderAdapter {
  readonly providerKey: string;
  readonly locality: ProviderLocality;
  generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult>;
}

export class AiProviderError extends Error {
  readonly category: ProviderErrorCategory;

  constructor(category: ProviderErrorCategory) {
    super(`AI provider failed with ${category}`);
    this.name = "AiProviderError";
    this.category = category;
  }
}

export type AiRunRequest<TInput, TOutput> = Readonly<{
  routeKey: string;
  projectId?: string;
  departmentId?: string;
  systemId: string;
  input: TInput;
  inputReference: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  promptTemplateVersion: string;
  outputSchema: z.ZodType<TOutput>;
  sourceReferences: readonly string[];
  classification: DataClassification;
  timeoutMs: number;
  requiresHumanApproval: boolean;
  correlationId: string;
}>;

export type FallbackHop = Readonly<{
  providerKey: string;
  modelKey: string;
  outcome: ProviderErrorCategory | "succeeded";
}>;

export type AiRunTrace = Readonly<{
  routeKey: string;
  routeId: string;
  routeConfigId: string;
  routeConfigVersion: number;
  routeLevel: RouteLevel;
  scopeId: string;
  providerKey: string;
  modelKey: string;
  classification: DataClassification;
  inputReference: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  promptTemplateVersion: string;
  sourceReferences: readonly string[];
  outputReference: string | null;
  startedAt: Date;
  completedAt: Date;
  latencyMs: number;
  usage: ProviderUsage | null;
  costUsd: number | null;
  state: "succeeded" | "failed" | "quarantined";
  errorCategory: ProviderErrorCategory | null;
  fallbackChain: readonly FallbackHop[];
  humanApprovalState: "not_required" | "pending";
  correlationId: string;
  validationIssueCodes: readonly string[];
}>;

export interface RunTraceRepository {
  appendRunTrace(trace: AiRunTrace): Promise<Readonly<{ id: string }>>;
}

export type ValidatedAiResult<T> = Readonly<{
  runId: string;
  output: T;
  outputReference: string;
  requiresHumanApproval: boolean;
}>;

export type PersistValidatedOutput<T> = (
  output: T,
) => Promise<Readonly<{ outputReference: string }>>;
