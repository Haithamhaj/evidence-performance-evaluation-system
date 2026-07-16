import type { z } from "zod";
import { z as schema } from "zod";

const SENSITIVE_REFERENCE =
  /(?:^|[^a-z0-9])(?:api[-_]?key|bearer|credential|password|secret|token)(?:[^a-z0-9]|$)/iu;

export const OpaqueReferenceSchema = schema
  .string()
  .min(3)
  .max(256)
  .regex(
    /^[a-z][a-z0-9._-]{0,63}:(?:[0-9]{1,20}|[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}|[0-9A-HJKMNP-TV-Z]{26}|[A-Fa-f0-9]{32,64})$/u,
  )
  .refine((value) => !/^https?:/iu.test(value) && !SENSITIVE_REFERENCE.test(value))
  .brand<"OpaqueReference">();

export const VersionReferenceSchema = schema
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)
  .brand<"VersionReference">();

export const RouteKeySchema = schema
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9-]+)*$/u)
  .brand<"RouteKey">();

export type OpaqueReference = schema.infer<typeof OpaqueReferenceSchema>;
export type VersionReference = schema.infer<typeof VersionReferenceSchema>;

export type DataClassification = "public" | "internal" | "confidential" | "local_only";
export type ProviderLocality = "local" | "external";
export type ProviderErrorCategory =
  "retryable" | "non_retryable" | "policy" | "timeout" | "invalid_output";
export type RunErrorCategory = ProviderErrorCategory | "persistence";
export type RouteLevel = "project" | "department" | "system";

export type AiProviderRoute = Readonly<{
  routeConfigProviderId: string;
  providerConfigId: string;
  providerConfigVersion: number;
  providerKey: string;
  adapterKey: string;
  modelKey: string;
  locality: ProviderLocality;
  endpoint: string;
  localTrustPolicyId: string | null;
  localTrustPolicyVersion: number | null;
  localTrustAllowedIp: string | null;
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
  validateInvocationScope(scope: RouteScope): Promise<void>;
  findActiveRoute(
    query: Readonly<{
      routeKey: string;
      level: RouteLevel;
      scopeId: string;
    }>,
  ): Promise<ResolvedRoute | null>;
  findOutputSchemaArtifact(
    query: Readonly<{
      routeKey: string;
      version: string;
      schemaHash: string;
    }>,
  ): Promise<Readonly<{ id: string; version: string; schemaHash: string }> | null>;
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
  readonly adapterKey: string;
  readonly locality: ProviderLocality;
  matchesConfiguration(provider: AiProviderRoute): boolean;
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
  routeConfigProviderId: string;
  providerConfigId: string;
  providerConfigVersion: number;
  providerKey: string;
  modelKey: string;
  classification: DataClassification;
  inputReference: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  outputSchemaArtifactId: string;
  outputSchemaHash: string;
  promptTemplateVersion: string;
  sourceReferences: readonly string[];
  projectScopeId: string | null;
  departmentScopeId: string | null;
  outputReference: string | null;
  startedAt: Date;
  completedAt: Date;
  latencyMs: number;
  usage: ProviderUsage | null;
  costUsd: number | null;
  state: "succeeded" | "failed" | "quarantined";
  errorCategory: RunErrorCategory | null;
  fallbackChain: readonly FallbackHop[];
  humanApprovalState: "not_required" | "pending";
  correlationId: string;
  validationIssueCodes: readonly string[];
}>;

export interface RunTraceRepository<TTransaction = unknown> {
  appendRunTrace(trace: AiRunTrace): Promise<Readonly<{ id: string }>>;
  commitSucceededRun<T>(
    input: Readonly<{
      output: T;
      persistValidatedOutput: PersistValidatedOutput<T, TTransaction>;
      buildTrace(outputReference: OpaqueReference): AiRunTrace;
    }>,
  ): Promise<Readonly<{ id: string; outputReference: OpaqueReference }>>;
}

export type ValidatedAiResult<T> = Readonly<{
  runId: string;
  output: T;
  outputReference: string;
  requiresHumanApproval: boolean;
}>;

export type PersistValidatedOutput<T, TTransaction = unknown> = (
  transaction: TTransaction,
  output: T,
) => Promise<Readonly<{ outputReference: string }>>;
