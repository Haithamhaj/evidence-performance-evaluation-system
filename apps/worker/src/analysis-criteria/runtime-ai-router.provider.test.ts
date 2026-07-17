import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  createWorkerRuntimeAiRouter,
  WorkerEnvironmentAiCredentialSecretResolver,
} from "./runtime-ai-router.provider.js";

describe("worker runtime AI Router provider", () => {
  it("composes from governed database state without resolving a credential early", async () => {
    const trustedBody = "Trusted worker route instruction";
    const schemaArtifact = { properties: { state: { type: "string" } }, type: "object" };
    const database = {
      aiRoute: {
        findMany: vi.fn(async () => [
          {
            routeKey: "document.analyze",
            configs: [
              {
                providers: [
                  {
                    providerConfig: {
                      id: "20000000-0000-4000-8000-000000000001",
                      providerKey: "governed-provider",
                      adapterKey: "openai-compatible",
                      locality: "external",
                      endpoint: "https://provider.example/v1",
                      localTrustPolicyId: null,
                      localTrustPolicyVersion: null,
                      localTrustAllowedIp: null,
                    },
                  },
                ],
              },
            ],
          },
        ]),
      },
      analysisPromptArtifact: {
        findFirst: vi.fn(async () => ({
          id: "20000000-0000-4000-8000-000000000002",
          routeKey: "document.analyze",
          version: "document-readiness.v2",
          trustedBody,
          bodyHash: createHash("sha256").update(trustedBody).digest("hex"),
        })),
      },
      aiOutputSchemaArtifact: {
        findFirst: vi.fn(async () => ({
          id: "20000000-0000-4000-8000-000000000003",
          routeKey: "document.analyze",
          version: "document-readiness-output.v2",
          schemaArtifact,
          schemaHash: createHash("sha256")
            .update(JSON.stringify(schemaArtifact))
            .digest("hex"),
        })),
      },
    };
    const resolver = { get: vi.fn(async () => "private-secret") };
    await expect(
      createWorkerRuntimeAiRouter(database as never, resolver),
    ).resolves.toBeDefined();
    expect(resolver.get).not.toHaveBeenCalled();
  });

  it("fails closed when the selected route is missing its governed prompt", async () => {
    const database = {
      aiRoute: {
        findMany: vi.fn(async () => [
          {
            routeKey: "document.analyze",
            configs: [{ providers: [] }],
          },
        ]),
      },
      analysisPromptArtifact: { findFirst: vi.fn(async () => null) },
      aiOutputSchemaArtifact: { findFirst: vi.fn(async () => null) },
    };
    await expect(
      createWorkerRuntimeAiRouter(database as never, { get: vi.fn() }),
    ).rejects.toMatchObject({ code: "AI_PROMPT_ARTIFACT_NOT_FOUND" });
  });

  it("resolves only the provider-specific worker environment key", async () => {
    const resolver = new WorkerEnvironmentAiCredentialSecretResolver({
      AI_PROVIDER_GOVERNED_PROVIDER_API_KEY: " worker-secret ",
      OPENAI_API_KEY: "must-not-be-used",
    });
    await expect(resolver.get("governed-provider")).resolves.toBe("worker-secret");
    await expect(resolver.get("other-provider")).resolves.toBeUndefined();
  });
});
