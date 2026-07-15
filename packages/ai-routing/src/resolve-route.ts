import { AppError } from "@evaluation/contracts";

export async function resolveRoute(
  repository: import("./contracts.js").RouteRepository,
  routeKey: string,
  scope: import("./contracts.js").RouteScope,
  classification: import("./contracts.js").DataClassification,
): Promise<import("./contracts.js").ResolvedRoute> {
  const candidates = [
    ...(scope.projectId === undefined
      ? []
      : [{ level: "project" as const, scopeId: scope.projectId }]),
    ...(scope.departmentId === undefined
      ? []
      : [{ level: "department" as const, scopeId: scope.departmentId }]),
    { level: "system" as const, scopeId: scope.systemId },
  ];

  for (const candidate of candidates) {
    const route = await repository.findActiveRoute({ routeKey, ...candidate });
    if (route === null) continue;
    if (route.providers.length === 0) {
      throw new AppError("AI_ROUTE_INVALID", "errors.ai.routeInvalid", 500);
    }
    if (classification === "local_only" && route.providers[0]?.locality !== "local") {
      throw new AppError("AI_FALLBACK_FORBIDDEN", "errors.ai.fallbackForbidden", 403);
    }
    return route;
  }

  throw new AppError("AI_ROUTE_NOT_FOUND", "errors.ai.routeNotFound", 503);
}

export function resolveFallback(
  route: import("./contracts.js").ResolvedRoute,
  currentIndex: number,
  classification: import("./contracts.js").DataClassification,
  errorCategory: import("./contracts.js").ProviderErrorCategory,
): import("./contracts.js").ResolvedRoute["providers"][number] | null {
  if (errorCategory !== "retryable" && errorCategory !== "timeout") return null;
  const fallback = route.providers[currentIndex + 1];
  if (fallback === undefined) return null;
  if (classification === "local_only" && fallback.locality !== "local") {
    throw new AppError("AI_FALLBACK_FORBIDDEN", "errors.ai.fallbackForbidden", 403);
  }
  return fallback;
}
