import { AppError } from "@evaluation/contracts";

import { parseProviderChain } from "./route-config.js";

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;

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
      include: { configs: { orderBy: { version: "desc" }, take: 1 } },
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
      providers: parseProviderChain(config.providerChain),
    };
  }

  async appendRunTrace(
    trace: import("./contracts.js").AiRunTrace,
  ): Promise<Readonly<{ id: string }>> {
    return this.client.aiRun.create({
      data: {
        routeKey: trace.routeKey,
        routeId: trace.routeId,
        routeConfigId: trace.routeConfigId,
        routeConfigVersion: trace.routeConfigVersion,
        routeLevel: trace.routeLevel,
        scopeId: trace.scopeId,
        providerKey: trace.providerKey,
        modelKey: trace.modelKey,
        classification: trace.classification,
        inputReference: trace.inputReference,
        inputSchemaVersion: trace.inputSchemaVersion,
        outputSchemaVersion: trace.outputSchemaVersion,
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
}
