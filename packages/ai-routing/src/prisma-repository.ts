import { AppError } from "@evaluation/contracts";
import { z } from "zod";

import { OpaqueReferenceSchema, RouteKeySchema, VersionReferenceSchema } from "./contracts.js";

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];

export class PrismaAiRoutingRepository {
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async findActiveRoute(
    query: Readonly<{
      routeKey: string;
      level: import("./contracts.js").ResolvedRoute["level"];
      scopeId: string;
    }>,
  ): Promise<import("./contracts.js").ResolvedRoute | null> {
    const route = await this.client.aiRoute.findUnique({
      where: {
        routeKey_level_scopeId: {
          routeKey: query.routeKey,
          level: query.level,
          scopeId: query.scopeId,
        },
      },
      include: {
        configs: {
          orderBy: { version: "desc" },
          take: 1,
          include: {
            providers: { orderBy: { position: "asc" }, include: { providerConfig: true } },
          },
        },
      },
    });
    if (route === null) return null;
    const config = route.configs[0];
    if (config === undefined) {
      throw new AppError("AI_ROUTE_INVALID", "errors.ai.routeInvalid", 500);
    }
    return {
      routeId: route.id,
      configId: config.id,
      configVersion: config.version,
      level: query.level,
      scopeId: route.scopeId,
      routeKey: route.routeKey,
      providers: config.providers.map(({ id, providerConfig }) => ({
        routeConfigProviderId: id,
        providerConfigId: providerConfig.id,
        providerConfigVersion: providerConfig.version,
        providerKey: providerConfig.providerKey,
        adapterKey: providerConfig.adapterKey,
        modelKey: providerConfig.modelKey,
        locality: providerConfig.locality,
        endpoint: providerConfig.endpoint,
      })),
    };
  }

  async findOutputSchemaArtifact(
    query: Readonly<{
      routeKey: string;
      version: string;
      schemaHash: string;
    }>,
  ) {
    return this.client.aiOutputSchemaArtifact
      .findUnique({
        where: { routeKey_version: { routeKey: query.routeKey, version: query.version } },
        select: { id: true, version: true, schemaHash: true },
      })
      .then((artifact) => (artifact?.schemaHash === query.schemaHash ? artifact : null));
  }

  async appendRunTrace(
    trace: import("./contracts.js").AiRunTrace,
  ): Promise<Readonly<{ id: string }>> {
    return appendRunTrace(this.client, trace);
  }

  async commitSucceededRun<T>(
    input: Readonly<{
      output: T;
      persistValidatedOutput: import("./contracts.js").PersistValidatedOutput<
        T,
        DatabaseTransaction
      >;
      buildTrace(
        outputReference: import("./contracts.js").OpaqueReference,
      ): import("./contracts.js").AiRunTrace;
    }>,
  ): Promise<Readonly<{ id: string; outputReference: import("./contracts.js").OpaqueReference }>> {
    return this.client.$transaction(async (transaction) => {
      const persisted = await input.persistValidatedOutput(transaction, input.output);
      const outputReference = OpaqueReferenceSchema.parse(persisted.outputReference);
      const run = await appendRunTrace(transaction, input.buildTrace(outputReference));
      return { id: run.id, outputReference };
    });
  }
}

interface RunPersistence {
  readonly aiRun: {
    create(args: unknown): Promise<Readonly<{ id: string }>>;
  };
}

function appendRunTrace(
  persistence: RunPersistence,
  trace: import("./contracts.js").AiRunTrace,
): Promise<Readonly<{ id: string }>> {
  validateTrace(trace);
  return persistence.aiRun.create({
    data: {
      routeKey: trace.routeKey,
      routeId: trace.routeId,
      routeConfigId: trace.routeConfigId,
      routeConfigVersion: trace.routeConfigVersion,
      routeLevel: trace.routeLevel,
      scopeId: trace.scopeId,
      routeConfigProviderId: trace.routeConfigProviderId,
      providerConfigId: trace.providerConfigId,
      providerConfigVersion: trace.providerConfigVersion,
      projectScopeId: trace.projectScopeId,
      projectScopeType: trace.projectScopeId === null ? null : "project",
      departmentScopeId: trace.departmentScopeId,
      departmentScopeType: trace.departmentScopeId === null ? null : "department",
      classification: trace.classification,
      inputReference: trace.inputReference,
      inputSchemaVersion: trace.inputSchemaVersion,
      outputSchemaVersion: trace.outputSchemaVersion,
      outputSchemaArtifactId: trace.outputSchemaArtifactId,
      outputSchemaHash: trace.outputSchemaHash,
      promptTemplateVersion: trace.promptTemplateVersion,
      sourceReferences: [...trace.sourceReferences],
      outputReference: trace.outputReference,
      startedAt: trace.startedAt,
      completedAt: trace.completedAt,
      latencyMs: trace.latencyMs,
      ...(trace.usage === null ? {} : { usage: { ...trace.usage } }),
      costUsd: trace.costUsd,
      state: trace.state,
      errorCategory: trace.errorCategory,
      fallbackChain: trace.fallbackChain.map((hop) => ({ ...hop })),
      humanApprovalState: trace.humanApprovalState,
      correlationId: trace.correlationId,
      validationIssueCodes: [...trace.validationIssueCodes],
    },
    select: { id: true },
  });
}

function validateTrace(trace: import("./contracts.js").AiRunTrace): void {
  const uuid = z.string().uuid();
  const valid =
    RouteKeySchema.safeParse(trace.routeKey).success &&
    [
      trace.routeId,
      trace.routeConfigId,
      trace.routeConfigProviderId,
      trace.providerConfigId,
      trace.outputSchemaArtifactId,
      trace.correlationId,
      ...(trace.projectScopeId === null ? [] : [trace.projectScopeId]),
      ...(trace.departmentScopeId === null ? [] : [trace.departmentScopeId]),
    ].every((value) => uuid.safeParse(value).success) &&
    [trace.inputSchemaVersion, trace.outputSchemaVersion, trace.promptTemplateVersion].every(
      (value) => VersionReferenceSchema.safeParse(value).success,
    ) &&
    OpaqueReferenceSchema.safeParse(trace.inputReference).success &&
    trace.sourceReferences.length > 0 &&
    trace.sourceReferences.length <= 50 &&
    trace.sourceReferences.every((value) => OpaqueReferenceSchema.safeParse(value).success) &&
    (trace.outputReference === null ||
      OpaqueReferenceSchema.safeParse(trace.outputReference).success) &&
    /^[a-f0-9]{64}$/u.test(trace.outputSchemaHash) &&
    trace.validationIssueCodes.length <= 50 &&
    trace.validationIssueCodes.every(
      (code) => code.length > 0 && code.length <= 100 && /^[a-z0-9_.-]+$/u.test(code),
    );
  if (!valid) throw new AppError("AI_RUN_TRACE_INVALID", "errors.ai.runTraceInvalid", 500);
}
