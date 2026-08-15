import { describe, expect, it, vi } from "vitest";

import {
  resolveDepartmentAiScopeId,
  resolveContextIntelligenceSystemAiScopes,
  resolveSystemAiScopeId,
} from "./system-ai-scope.js";

describe("resolveDepartmentAiScopeId", () => {
  it("maps a department domain id to its authoritative AI authorization scope", async () => {
    const findScope = vi.fn().mockResolvedValue({ id: "department-ai-scope" });

    await expect(
      resolveDepartmentAiScopeId(
        { authorizationScope: { findFirst: findScope } },
        "department-domain-id",
      ),
    ).resolves.toBe("department-ai-scope");
    expect(findScope).toHaveBeenCalledWith({
      where: { departmentId: "department-domain-id", scopeType: "department" },
      select: { id: true },
    });
  });

  it("fails closed when the department has no authorization scope", async () => {
    await expect(
      resolveDepartmentAiScopeId(
        { authorizationScope: { findFirst: vi.fn().mockResolvedValue(null) } },
        "department-domain-id",
      ),
    ).rejects.toThrow("The department authorization scope is not configured");
  });
});

describe("resolveSystemAiScopeId", () => {
  it("uses the configured system route scope when the route exists", async () => {
    const findRoute = vi.fn().mockResolvedValue({ scopeId: "route-scope" });
    const findScope = vi.fn();

    await expect(
      resolveSystemAiScopeId(
        {
          aiRoute: { findFirst: findRoute },
          authorizationScope: { findUnique: findScope },
        },
        "project.progress-contract.draft",
      ),
    ).resolves.toBe("route-scope");
    expect(findScope).not.toHaveBeenCalled();
  });

  it("falls back to the canonical system scope when an optional route is not registered", async () => {
    const findRoute = vi.fn().mockResolvedValue(null);
    const findScope = vi.fn().mockResolvedValue({ id: "canonical-system-scope" });

    await expect(
      resolveSystemAiScopeId(
        {
          aiRoute: { findFirst: findRoute },
          authorizationScope: { findUnique: findScope },
        },
        "project.progress-contract.draft",
      ),
    ).resolves.toBe("canonical-system-scope");
  });

  it("still rejects startup when the canonical system scope itself is missing", async () => {
    await expect(
      resolveSystemAiScopeId(
        {
          aiRoute: { findFirst: vi.fn().mockResolvedValue(null) },
          authorizationScope: { findUnique: vi.fn().mockResolvedValue(null) },
        },
        "project.progress-contract.draft",
      ),
    ).rejects.toThrow("The canonical system authorization scope is not configured");
  });

  it("resolves only the three governed Context Intelligence routes at system scope", async () => {
    const seen: string[] = [];
    const scopes = await resolveContextIntelligenceSystemAiScopes({
      aiRoute: {
        findFirst: vi.fn(async (input: any) => {
          seen.push(input.where.routeKey);
          return { scopeId: "canonical-system-scope" };
        }),
      },
      authorizationScope: { findUnique: vi.fn() },
    });

    expect(seen).toEqual(["context.summarize.v1", "context.project-match.v1", "task.draft.v1"]);
    expect(scopes).toEqual({
      "context.summarize.v1": "canonical-system-scope",
      "context.project-match.v1": "canonical-system-scope",
      "task.draft.v1": "canonical-system-scope",
    });
  });
});
