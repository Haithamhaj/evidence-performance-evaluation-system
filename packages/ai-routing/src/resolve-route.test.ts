import { describe, expect, it } from "vitest";

import { resolveFallback, resolveRoute } from "./resolve-route.js";
import type { ResolvedRoute } from "./contracts.js";

function provider(
  providerKey: string,
  modelKey: string,
  locality: import("./contracts.js").ProviderLocality,
): import("./contracts.js").AiProviderRoute {
  return {
    routeConfigProviderId: crypto.randomUUID(),
    providerConfigId: crypto.randomUUID(),
    providerConfigVersion: 1,
    providerKey,
    adapterKey: providerKey,
    modelKey,
    locality,
    endpoint:
      locality === "local"
        ? "http://127.0.0.1:11434/v1/chat/completions"
        : "https://provider.example.invalid/v1/chat/completions",
    localTrustPolicyId: null,
    localTrustPolicyVersion: null,
    localTrustAllowedIp: null,
  };
}

const routes = {
  project: {
    routeId: "00000000-0000-4000-8000-000000000001",
    configId: "00000000-0000-4000-8000-000000000011",
    configVersion: 3,
    level: "project",
    scopeId: "00000000-0000-4000-8000-000000000101",
    routeKey: "evaluation.summary",
    providers: [
      provider("local-primary", "local-a", "local"),
      provider("external-fallback", "external-a", "external"),
    ],
  },
  department: {
    routeId: "00000000-0000-4000-8000-000000000002",
    configId: "00000000-0000-4000-8000-000000000012",
    configVersion: 2,
    level: "department",
    scopeId: "00000000-0000-4000-8000-000000000102",
    routeKey: "evaluation.summary",
    providers: [provider("department", "department-a", "local")],
  },
  system: {
    routeId: "00000000-0000-4000-8000-000000000003",
    configId: "00000000-0000-4000-8000-000000000013",
    configVersion: 1,
    level: "system",
    scopeId: "00000000-0000-4000-8000-000000000103",
    routeKey: "evaluation.summary",
    providers: [provider("system", "system-a", "local")],
  },
} as const satisfies Record<string, ResolvedRoute>;

function repositoryWith(
  levels: ReadonlyArray<ResolvedRoute["level"]>,
): import("./contracts.js").RouteRepository {
  return {
    validateInvocationScope: async () => undefined,
    findActiveRoute: async ({ level }) =>
      levels.includes(level) ? routes[level as keyof typeof routes] : null,
    findOutputSchemaArtifact: async () => null,
  };
}

describe("AI route resolution", () => {
  it.each([
    [
      {
        projectId: routes.project.scopeId,
        departmentId: routes.department.scopeId,
        systemId: routes.system.scopeId,
      },
      ["project", "department", "system"] as const,
      "project",
    ],
    [
      { departmentId: routes.department.scopeId, systemId: routes.system.scopeId },
      ["department", "system"] as const,
      "department",
    ],
    [{ systemId: routes.system.scopeId }, ["system"] as const, "system"],
  ])("resolves project then department then system", async (scope, available, expectedLevel) => {
    await expect(
      resolveRoute(repositoryWith(available), "evaluation.summary", scope, "internal"),
    ).resolves.toMatchObject({ level: expectedLevel });
  });

  it("does not skip an applicable project override to select a lower-level route", async () => {
    const calls: string[] = [];
    const repository: import("./contracts.js").RouteRepository = {
      validateInvocationScope: async () => undefined,
      findActiveRoute: async (query) => {
        calls.push(query.level);
        return query.level === "project" ? routes.project : routes.system;
      },
      findOutputSchemaArtifact: async () => null,
    };

    await expect(
      resolveRoute(
        repository,
        "evaluation.summary",
        {
          projectId: routes.project.scopeId,
          departmentId: routes.department.scopeId,
          systemId: routes.system.scopeId,
        },
        "internal",
      ),
    ).resolves.toMatchObject({ level: "project" });
    expect(calls).toEqual(["project"]);
  });

  it("refuses external fallback for local-only data", () => {
    expect(() => resolveFallback(routes.project, 0, "local_only", "retryable")).toThrowError(
      expect.objectContaining({ code: "AI_FALLBACK_FORBIDDEN" }),
    );
  });

  it("returns allowed fallbacks in configured order", () => {
    const route: ResolvedRoute = {
      ...routes.project,
      providers: [
        provider("one", "m1", "local"),
        provider("two", "m2", "external"),
        provider("three", "m3", "external"),
      ],
    };

    expect(resolveFallback(route, 0, "internal", "retryable")?.providerKey).toBe("two");
    expect(resolveFallback(route, 1, "internal", "timeout")?.providerKey).toBe("three");
    expect(resolveFallback(route, 2, "internal", "retryable")).toBeNull();
  });

  it.each(["non_retryable", "policy", "invalid_output"] as const)(
    "does not fall back after a %s provider result",
    (category) => {
      expect(resolveFallback(routes.project, 0, "internal", category)).toBeNull();
    },
  );

  it("rejects an external primary route for local-only data before a provider is called", async () => {
    const externalRoute: ResolvedRoute = {
      ...routes.project,
      providers: [provider("external", "external-a", "external")],
    };
    const repository: import("./contracts.js").RouteRepository = {
      validateInvocationScope: async () => undefined,
      findActiveRoute: async () => externalRoute,
      findOutputSchemaArtifact: async () => null,
    };

    await expect(
      resolveRoute(
        repository,
        "evaluation.summary",
        { projectId: externalRoute.scopeId, systemId: routes.system.scopeId },
        "local_only",
      ),
    ).rejects.toMatchObject({ code: "AI_FALLBACK_FORBIDDEN" });
  });
});
