type SystemAiScopeDatabase = Readonly<{
  aiRoute: {
    findFirst(input: unknown): Promise<{ readonly scopeId: string } | null>;
  };
  authorizationScope: {
    findUnique(input: unknown): Promise<{ readonly id: string } | null>;
  };
}>;

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
