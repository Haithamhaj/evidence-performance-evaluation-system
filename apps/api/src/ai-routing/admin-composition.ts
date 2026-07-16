import { isIP } from "node:net";

import {
  OpaqueReferenceSchema,
  outputSchemaDescriptor,
  safeEndpoint,
} from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { AppError } from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";
import { z } from "zod";

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];
type AuditWriter = import("@evaluation/contracts").AuditWriter<DatabaseTransaction>;

export type AiGovernancePrincipal = Readonly<{ userId: string; active: boolean }>;

export type AiGovernanceComposition = Readonly<{
  registerLocalTrustPolicy(
    principal: AiGovernancePrincipal,
    input: unknown,
  ): Promise<Readonly<{ id: string; policyKey: string; version: number }>>;
  registerProviderConfig(
    principal: AiGovernancePrincipal,
    input: unknown,
  ): Promise<Readonly<{ id: string; version: number }>>;
  registerOutputSchema(
    principal: AiGovernancePrincipal,
    input: unknown,
  ): Promise<Readonly<{ id: string; schemaHash: string }>>;
  changeRoute(
    principal: AiGovernancePrincipal,
    input: unknown,
  ): Promise<Readonly<{ routeId: string; configId: string; configVersion: number }>>;
}>;

const trimmedReason = z
  .string()
  .min(3)
  .max(500)
  .refine((value) => value === value.trim());
const correlationId = z.string().uuid();
const key = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u)
  .refine((value) => value === value.trim());

const AiRouteChangeSchema = z
  .object({
    routeKey: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:[.-][a-z0-9-]+)*$/u),
    level: z.enum(["project", "department", "system"]),
    scopeId: z.string().uuid(),
    reason: trimmedReason,
    correlationId,
    providers: z
      .array(z.object({ providerConfigId: z.string().uuid() }).strict())
      .min(1)
      .max(10)
      .refine(
        (providers) =>
          new Set(providers.map(({ providerConfigId }) => providerConfigId)).size ===
          providers.length,
      ),
  })
  .strict();

type AiRouteChangeRequest = Readonly<z.infer<typeof AiRouteChangeSchema>>;

const LocalTrustPolicySchema = z
  .object({
    policyKey: key,
    allowedIps: z
      .array(z.string().refine((value) => isIP(value) > 0 && !value.includes("/")))
      .min(1)
      .max(100)
      .refine(
        (values) => new Set(values.map((value) => value.toLowerCase())).size === values.length,
      ),
    reason: trimmedReason,
    correlationId,
  })
  .strict();

const ProviderConfigurationSchema = z
  .object({
    providerKey: key,
    adapterKey: key,
    modelKey: z
      .string()
      .min(1)
      .max(200)
      .refine((value) => value === value.trim()),
    locality: z.enum(["local", "external"]),
    endpoint: z.string().min(1).max(2048),
    localTrustPolicyId: z.string().uuid().optional(),
    localTrustPolicyVersion: z.number().int().positive().optional(),
    localTrustAllowedIp: z.string().optional(),
    reason: trimmedReason,
    correlationId,
  })
  .strict()
  .superRefine((value, context) => {
    const trustFields = [
      value.localTrustPolicyId,
      value.localTrustPolicyVersion,
      value.localTrustAllowedIp,
    ];
    if (
      (value.locality === "local" && trustFields.some((field) => field === undefined)) ||
      (value.locality === "external" && trustFields.some((field) => field !== undefined))
    ) {
      context.addIssue({ code: "custom", message: "Local trust identity does not match locality" });
    }
  });

const OutputSchemaRegistrationSchema = z
  .object({
    routeKey: AiRouteChangeSchema.shape.routeKey,
    version: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u),
    schema: z.custom<z.ZodType>((value) => {
      return value !== null && typeof value === "object" && "_zod" in value;
    }),
    reason: trimmedReason,
    expectedBehavior: z
      .string()
      .min(10)
      .max(2000)
      .refine((value) => value === value.trim()),
    evaluationEvidenceReferences: z
      .array(OpaqueReferenceSchema)
      .min(1)
      .max(50)
      .refine((values) => new Set(values).size === values.length),
    correlationId,
  })
  .strict();

export function createAiGovernanceComposition(client: DatabaseClient): AiGovernanceComposition {
  const writer = databaseAuditWriter as AuditWriter;
  return {
    registerLocalTrustPolicy: (principal: AiGovernancePrincipal, input: unknown) =>
      registerLocalTrustPolicy(client, writer, principal, input),
    registerProviderConfig: (principal: AiGovernancePrincipal, input: unknown) =>
      registerProviderConfig(client, writer, principal, input),
    registerOutputSchema: (principal: AiGovernancePrincipal, input: unknown) =>
      registerOutputSchema(client, writer, principal, input),
    changeRoute: (principal: AiGovernancePrincipal, input: unknown) =>
      changeRoute(client, writer, principal, input),
  } as const;
}

async function registerLocalTrustPolicy(
  client: DatabaseClient,
  writer: AuditWriter,
  principal: AiGovernancePrincipal,
  input: unknown,
) {
  const parsed = LocalTrustPolicySchema.parse(input);
  return serializable(client, async (transaction) => {
    const systemScopeId = await authorizeSystemAdministrator(transaction, principal);
    const previous = await transaction.aiLocalTrustPolicy.findFirst({
      where: { policyKey: parsed.policyKey },
      orderBy: { version: "desc" },
      include: { allowedIps: { orderBy: { ipAddress: "asc" } } },
    });
    const version = (previous?.version ?? 0) + 1;
    const policy = await transaction.aiLocalTrustPolicy.create({
      data: {
        policyKey: parsed.policyKey,
        version,
        reason: parsed.reason,
        createdById: principal.userId,
        allowedIps: {
          create: parsed.allowedIps.map((ipAddress) => ({ ipAddress })),
        },
      },
      include: { allowedIps: { orderBy: { ipAddress: "asc" } } },
    });
    await writer.append(transaction, {
      eventType: "ai.localtrust.registered",
      actor: { kind: "human", id: principal.userId },
      effectiveSubjectId: principal.userId,
      scopeType: "system",
      scopeId: systemScopeId,
      targetType: "ai_local_trust_policy",
      targetId: policy.id,
      reason: parsed.reason,
      safeDiff: {
        administratorId: principal.userId,
        effectiveAt: policy.createdAt.toISOString(),
        previous: previous === null ? null : policySnapshot(previous),
        next: policySnapshot(policy),
      },
      correlationId: parsed.correlationId,
      source: "api",
    });
    return { id: policy.id, policyKey: policy.policyKey, version: policy.version };
  });
}

async function registerProviderConfig(
  client: DatabaseClient,
  writer: AuditWriter,
  principal: AiGovernancePrincipal,
  input: unknown,
) {
  const parsed = ProviderConfigurationSchema.parse(input);
  return serializable(client, async (transaction) => {
    const systemScopeId = await authorizeSystemAdministrator(transaction, principal);
    const localTrust =
      parsed.locality === "local"
        ? await transaction.aiLocalTrustPolicyAllowedIp.findUnique({
            where: {
              policyId_policyVersion_ipAddress: {
                policyId: parsed.localTrustPolicyId!,
                policyVersion: parsed.localTrustPolicyVersion!,
                ipAddress: parsed.localTrustAllowedIp!,
              },
            },
          })
        : null;
    if (parsed.locality === "local" && localTrust === null) {
      throw new AppError("AI_LOCAL_TRUST_INVALID", "errors.ai.localTrustInvalid", 400);
    }
    const trustIdentity =
      localTrust === null
        ? undefined
        : {
            id: localTrust.policyId,
            version: localTrust.policyVersion,
            allowedIp: localTrust.ipAddress,
          };
    const endpoint = safeEndpoint(parsed.endpoint, parsed.locality, trustIdentity);
    const previous = await transaction.aiProviderConfig.findFirst({
      where: { providerKey: parsed.providerKey },
      orderBy: { version: "desc" },
    });
    const provider = await transaction.aiProviderConfig.create({
      data: {
        providerKey: parsed.providerKey,
        version: (previous?.version ?? 0) + 1,
        adapterKey: parsed.adapterKey,
        modelKey: parsed.modelKey,
        locality: parsed.locality,
        endpoint: endpoint.toString(),
        endpointProtocol: endpoint.protocol.slice(0, -1),
        endpointHost: endpoint.hostname.replace(/^\[|\]$/gu, "").toLowerCase(),
        ...(trustIdentity === undefined
          ? {}
          : {
              localTrustPolicyId: trustIdentity.id,
              localTrustPolicyVersion: trustIdentity.version,
              localTrustAllowedIp: trustIdentity.allowedIp,
            }),
        reason: parsed.reason,
        createdById: principal.userId,
      },
    });
    await writer.append(transaction, {
      eventType: "ai.provider.registered",
      actor: { kind: "human", id: principal.userId },
      effectiveSubjectId: principal.userId,
      scopeType: "system",
      scopeId: systemScopeId,
      targetType: "ai_provider_config",
      targetId: provider.id,
      reason: parsed.reason,
      safeDiff: {
        administratorId: principal.userId,
        affectedDataType: "ai_provider_configuration",
        effectiveAt: provider.createdAt.toISOString(),
        previous: previous === null ? null : providerSnapshot(previous),
        next: providerSnapshot(provider),
      },
      correlationId: parsed.correlationId,
      source: "api",
    });
    return provider;
  });
}

async function registerOutputSchema(
  client: DatabaseClient,
  writer: AuditWriter,
  principal: AiGovernancePrincipal,
  input: unknown,
) {
  const parsed = OutputSchemaRegistrationSchema.parse(input);
  return serializable(client, async (transaction) => {
    const systemScopeId = await authorizeSystemAdministrator(transaction, principal);
    const descriptor = outputSchemaDescriptor(parsed.routeKey, parsed.version, parsed.schema);
    const existing = await transaction.aiOutputSchemaArtifact.findUnique({
      where: { routeKey_version: { routeKey: descriptor.routeKey, version: descriptor.version } },
    });
    if (
      existing !== null &&
      (existing.schemaHash !== descriptor.schemaHash ||
        existing.reason !== parsed.reason ||
        existing.expectedBehavior !== parsed.expectedBehavior ||
        JSON.stringify(existing.evaluationEvidenceReferences) !==
          JSON.stringify(parsed.evaluationEvidenceReferences))
    ) {
      throw new AppError("AI_SCHEMA_VERSION_CONFLICT", "errors.ai.schemaVersionConflict", 409);
    }
    const artifact =
      existing ??
      (await transaction.aiOutputSchemaArtifact.create({
        data: {
          ...descriptor,
          schemaArtifact: descriptor.schemaArtifact as never,
          reason: parsed.reason,
          expectedBehavior: parsed.expectedBehavior,
          evaluationEvidenceReferences: parsed.evaluationEvidenceReferences,
          humanApprovalPolicy: "feature_defined",
          createdById: principal.userId,
        },
      }));
    await writer.append(transaction, {
      eventType: "ai.outputschema.registered",
      actor: { kind: "human", id: principal.userId },
      effectiveSubjectId: principal.userId,
      scopeType: "system",
      scopeId: systemScopeId,
      targetType: "ai_output_schema_artifact",
      targetId: artifact.id,
      reason: parsed.reason,
      safeDiff: {
        administratorId: principal.userId,
        affectedDataType: parsed.routeKey,
        effectiveAt: artifact.createdAt.toISOString(),
        schemaHash: artifact.schemaHash,
        expectedBehavior: parsed.expectedBehavior,
        evaluationEvidenceReferences: parsed.evaluationEvidenceReferences,
        humanApprovalPolicy: "feature_defined",
        reusedExistingArtifact: existing !== null,
      },
      correlationId: parsed.correlationId,
      source: "api",
    });
    return artifact;
  });
}

async function changeRoute(
  client: DatabaseClient,
  writer: AuditWriter,
  principal: AiGovernancePrincipal,
  input: unknown,
) {
  const parsed = AiRouteChangeSchema.parse(input);
  return serializable(client, async (transaction) => {
    await authorizeSystemAdministrator(transaction, principal);
    return changeRouteInTransaction(transaction, writer, principal.userId, parsed);
  });
}

async function changeRouteInTransaction(
  transaction: DatabaseTransaction,
  writer: AuditWriter,
  administratorId: string,
  input: AiRouteChangeRequest,
) {
  const scope = await transaction.authorizationScope.findUnique({
    where: { id_scopeType: { id: input.scopeId, scopeType: input.level } },
    select: { id: true },
  });
  if (scope === null) {
    throw new AppError("AI_ROUTE_SCOPE_INVALID", "errors.ai.routeScopeInvalid", 400);
  }
  const providerConfigs = await transaction.aiProviderConfig.findMany({
    where: { id: { in: input.providers.map(({ providerConfigId }) => providerConfigId) } },
  });
  const providersById = new Map(providerConfigs.map((provider) => [provider.id, provider]));
  const orderedProviders = input.providers.map(({ providerConfigId }) => {
    const provider = providersById.get(providerConfigId);
    if (provider === undefined) {
      throw new AppError("AI_PROVIDER_CONFIG_INVALID", "errors.ai.providerConfigInvalid", 400);
    }
    return provider;
  });

  let route = await transaction.aiRoute.findUnique({
    where: {
      routeKey_level_scopeId: {
        routeKey: input.routeKey,
        level: input.level,
        scopeId: input.scopeId,
      },
    },
    select: { id: true },
  });
  route ??= await transaction.aiRoute.create({
    data: { routeKey: input.routeKey, level: input.level, scopeId: input.scopeId },
    select: { id: true },
  });
  const previous = await transaction.aiRouteConfig.findFirst({
    where: { routeId: route.id },
    orderBy: { version: "desc" },
    include: { providers: { orderBy: { position: "asc" }, include: { providerConfig: true } } },
  });
  const version = (previous?.version ?? 0) + 1;
  const config = await transaction.aiRouteConfig.create({
    data: {
      routeId: route.id,
      version,
      reason: input.reason,
      createdById: administratorId,
      providers: {
        create: orderedProviders.map((provider, position) => ({
          position,
          providerConfigId: provider.id,
          providerConfigVersion: provider.version,
        })),
      },
    },
    include: { providers: { orderBy: { position: "asc" }, include: { providerConfig: true } } },
  });
  const snapshot = (value: typeof config | typeof previous) =>
    value === null
      ? null
      : {
          configId: value.id,
          version: value.version,
          providers: value.providers.map(({ providerConfig }) => ({
            providerConfigId: providerConfig.id,
            providerConfigVersion: providerConfig.version,
            providerKey: providerConfig.providerKey,
            modelKey: providerConfig.modelKey,
            locality: providerConfig.locality,
          })),
        };
  await writer.append(transaction, {
    eventType: "ai.route.changed",
    actor: { kind: "human", id: administratorId },
    effectiveSubjectId: administratorId,
    scopeType: input.level,
    scopeId: input.scopeId,
    targetType: "ai_route_config",
    targetId: config.id,
    reason: input.reason,
    safeDiff: {
      routeKey: input.routeKey,
      routeLevel: input.level,
      affectedDataType: input.routeKey.split(".")[0] ?? input.routeKey,
      administratorId,
      effectiveAt: config.createdAt.toISOString(),
      previous: snapshot(previous),
      next: snapshot(config),
    },
    correlationId: input.correlationId,
    source: "api",
  });
  return { routeId: route.id, configId: config.id, configVersion: version };
}

async function authorizeSystemAdministrator(
  transaction: DatabaseTransaction,
  principal: AiGovernancePrincipal,
): Promise<string> {
  if (!principal.active) throw authorizationError("INACTIVE");
  const user = await transaction.user.findUnique({
    where: { id: principal.userId },
    select: { active: true },
  });
  if (user === null || !user.active) throw authorizationError("INACTIVE");
  const systemScope = await transaction.authorizationScope.findUnique({
    where: { key: "system" },
    select: { id: true },
  });
  if (systemScope === null) throw authorizationError("RESOURCE_STATE");
  const roles = await transaction.roleAssignment.findMany({
    where: { userId: principal.userId },
    select: { role: true, scopeType: true, scopeId: true },
  });
  const decision = decide(
    { subjectId: principal.userId, active: user.active, roles },
    "system.configure",
    { kind: "system", systemId: systemScope.id },
    { now: new Date().toISOString() },
  );
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
  return systemScope.id;
}

function authorizationError(reasonCode: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(
    `AUTHZ_${reasonCode}`,
    "errors.authorization.denied",
    reasonCode === "UNAUTHENTICATED" ? 401 : 403,
  );
}

async function serializable<T>(
  client: DatabaseClient,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await client.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt < 4 && isConcurrencyConflict(error)) continue;
      throw error;
    }
  }
  throw new Error("Unreachable AI governance retry state");
}

function isConcurrencyConflict(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  return ["P2034", "P2002"].includes(String((error as { code?: unknown }).code));
}

function policySnapshot(value: {
  id: string;
  version: number;
  allowedIps: readonly { ipAddress: string }[];
}) {
  return {
    policyId: value.id,
    version: value.version,
    allowedIps: value.allowedIps.map(({ ipAddress }) => ipAddress),
  };
}

function providerSnapshot(value: {
  id: string;
  version: number;
  providerKey: string;
  adapterKey: string;
  modelKey: string;
  locality: string;
  endpoint: string;
  localTrustPolicyId: string | null;
  localTrustPolicyVersion: number | null;
  localTrustAllowedIp: string | null;
}) {
  return {
    providerConfigId: value.id,
    version: value.version,
    providerKey: value.providerKey,
    adapterKey: value.adapterKey,
    modelKey: value.modelKey,
    locality: value.locality,
    endpoint: value.endpoint,
    localTrustPolicyId: value.localTrustPolicyId,
    localTrustPolicyVersion: value.localTrustPolicyVersion,
    localTrustAllowedIp: value.localTrustAllowedIp,
  };
}
