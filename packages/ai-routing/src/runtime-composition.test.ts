import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { AiRouter } from "./router.js";
import { createRuntimeAiRouter } from "./runtime-composition.js";

describe("createRuntimeAiRouter", () => {
  it("composes only providers selected by latest governed route configurations without resolving secrets", async () => {
    const selected = provider("selected-provider", 2);
    const database = {
      aiRoute: {
        findMany: vi.fn(async () => [
          {
            routeKey: "document.analyze",
            configs: [
              { providers: [{ providerConfig: selected }] },
              { providers: [{ providerConfig: provider("retired-provider", 1) }] },
            ],
          },
        ]),
      },
      ...artifactsForRoutes(),
    };
    const secretResolver = { get: vi.fn(async () => "secret") };

    const router = await createRuntimeAiRouter({
      database: database as never,
      secretResolver,
    });

    expect(router).toBeInstanceOf(AiRouter);
    expect(database.aiRoute.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          configs: expect.objectContaining({ orderBy: { version: "desc" }, take: 1 }),
        }),
      }),
    );
    expect(secretResolver.get).not.toHaveBeenCalled();
  });

  it("rejects conflicting active configurations for one provider key", async () => {
    const database = {
      aiRoute: {
        findMany: vi.fn(async () => [
          {
            routeKey: "document.analyze",
            configs: [{ providers: [{ providerConfig: provider("provider-a", 1) }] }],
          },
          {
            routeKey: "document.compare",
            configs: [
              {
                providers: [
                  {
                    providerConfig: provider(
                      "provider-a",
                      2,
                      "model-b",
                      "https://other.example/v1",
                    ),
                  },
                ],
              },
            ],
          },
        ]),
      },
      ...artifacts(),
    };
    await expect(
      createRuntimeAiRouter({
        database: database as never,
        secretResolver: { get: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_CONFIGURATION_CONFLICT" });
  });

  it("shares one governed transport across route-specific models for the same provider key", async () => {
    const database = {
      aiRoute: {
        findMany: vi.fn(async () => [
          {
            routeKey: "update.structure",
            configs: [
              { providers: [{ providerConfig: provider("openai", 1, "gpt-5.5-2026-04-23") }] },
            ],
          },
          {
            routeKey: "update.transcribe",
            configs: [
              { providers: [{ providerConfig: provider("openai", 2, "gpt-4o-transcribe") }] },
            ],
          },
        ]),
      },
      ...artifactsForRoutes(),
    };

    await expect(
      createRuntimeAiRouter({
        database: database as never,
        secretResolver: { get: vi.fn() },
      }),
    ).resolves.toBeInstanceOf(AiRouter);
  });

  it.each([
    ["missing prompt", { prompt: null }, "AI_PROMPT_ARTIFACT_NOT_FOUND"],
    [
      "wrong prompt route",
      { prompt: { ...promptArtifact(), routeKey: "document.compare" } },
      "AI_PROMPT_ARTIFACT_MISMATCH",
    ],
    [
      "bad prompt hash",
      { prompt: { ...promptArtifact(), bodyHash: "0".repeat(64) } },
      "AI_PROMPT_ARTIFACT_MISMATCH",
    ],
    ["missing schema", { schema: null }, "AI_SCHEMA_ARTIFACT_NOT_FOUND"],
    [
      "wrong schema route",
      { schema: { ...schemaArtifact(), routeKey: "document.compare" } },
      "AI_SCHEMA_ARTIFACT_MISMATCH",
    ],
    [
      "bad schema hash",
      { schema: { ...schemaArtifact(), schemaHash: "0".repeat(64) } },
      "AI_SCHEMA_ARTIFACT_MISMATCH",
    ],
  ])("fails closed for %s", async (_label, overrides, code) => {
    const database = {
      aiRoute: {
        findMany: vi.fn(async () => [
          {
            routeKey: "document.analyze",
            configs: [{ providers: [{ providerConfig: provider("provider-a", 1) }] }],
          },
        ]),
      },
      ...artifacts(overrides),
    };
    await expect(
      createRuntimeAiRouter({
        database: database as never,
        secretResolver: { get: vi.fn() },
      }),
    ).rejects.toMatchObject({ code });
  });
});

function provider(
  providerKey: string,
  version: number,
  modelKey = "model-a",
  endpoint = "https://provider.example/v1",
) {
  return {
    id: `00000000-0000-4000-8000-00000000000${version}`,
    providerKey,
    version,
    adapterKey: "openai-compatible",
    modelKey,
    locality: "external",
    endpoint,
    localTrustPolicyId: null,
    localTrustPolicyVersion: null,
    localTrustAllowedIp: null,
  } as const;
}

function promptArtifact() {
  const trustedBody = "Trusted route-bound instruction";
  return {
    id: "00000000-0000-4000-8000-000000000020",
    routeKey: "document.analyze",
    version: "document-readiness.v2",
    trustedBody,
    bodyHash: createHash("sha256").update(trustedBody).digest("hex"),
  };
}

function schemaArtifact() {
  const schemaArtifact = { properties: { state: { type: "string" } }, type: "object" };
  return {
    id: "00000000-0000-4000-8000-000000000021",
    routeKey: "document.analyze",
    version: "document-readiness-output.v2",
    schemaArtifact,
    schemaHash: createHash("sha256").update(JSON.stringify(schemaArtifact)).digest("hex"),
  };
}

function artifacts(
  overrides: Partial<{
    prompt: ReturnType<typeof promptArtifact> | null;
    schema: ReturnType<typeof schemaArtifact> | null;
  }> = {},
) {
  return {
    analysisPromptArtifact: {
      findFirst: vi.fn(async () =>
        Object.prototype.hasOwnProperty.call(overrides, "prompt")
          ? (overrides.prompt ?? null)
          : promptArtifact(),
      ),
    },
    aiOutputSchemaArtifact: {
      findFirst: vi.fn(async () =>
        Object.prototype.hasOwnProperty.call(overrides, "schema")
          ? (overrides.schema ?? null)
          : schemaArtifact(),
      ),
    },
  };
}

function artifactsForRoutes() {
  return {
    analysisPromptArtifact: {
      findFirst: vi.fn(async (query: { where: { routeKey: string } }) => ({
        ...promptArtifact(),
        routeKey: query.where.routeKey,
      })),
    },
    aiOutputSchemaArtifact: {
      findFirst: vi.fn(async (query: { where: { routeKey: string } }) => ({
        ...schemaArtifact(),
        routeKey: query.where.routeKey,
      })),
    },
  };
}
