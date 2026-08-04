import { CONTEXT_INTELLIGENCE_AI_ROUTES } from "@evaluation/context-intelligence";

type SystemAiScopeDatabase = Readonly<{
  aiRoute: {
    findFirst(input: unknown): Promise<{ readonly scopeId: string } | null>;
  };
  authorizationScope: {
    findUnique(input: unknown): Promise<{ readonly id: string } | null>;
  };
}>;

export async function resolveContextIntelligenceSystemAiScopes(
  database: SystemAiScopeDatabase,
): Promise<Record<(typeof CONTEXT_INTELLIGENCE_AI_ROUTES)[number]["routeKey"], string>> {
  const entries = await Promise.all(
    CONTEXT_INTELLIGENCE_AI_ROUTES.map(
      async ({ routeKey }) => [routeKey, await resolveSystemAiScopeId(database, routeKey)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<
    (typeof CONTEXT_INTELLIGENCE_AI_ROUTES)[number]["routeKey"],
    string
  >;
}

export async function resolveSystemAiScopeId(
  database: SystemAiScopeDatabase,
  routeKey: string,
): Promise<string> {
  const route = await database.aiRoute.findFirst({
    where: { routeKey, level: "system" },
    orderBy: { createdAt: "desc" },
    select: { scopeId: true },
  });
  if (route !== null) return route.scopeId;

  const scope = await database.authorizationScope.findUnique({
    where: { key: "system" },
    select: { id: true },
  });
  if (scope === null) {
    throw new Error("The canonical system authorization scope is not configured");
  }
  return scope.id;
}
