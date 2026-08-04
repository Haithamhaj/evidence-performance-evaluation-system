import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { outputSchemaDescriptor } from "@evaluation/ai-routing";

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
          schemaHash: createHash("sha256").update(JSON.stringify(schemaArtifact)).digest("hex"),
        })),
      },
    };
    const resolver = { get: vi.fn(async () => "private-secret") };
    await expect(createWorkerRuntimeAiRouter(database as never, resolver)).resolves.toBeDefined();
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
    await expect(resolver.get("openai")).resolves.toBe("must-not-be-used");
    await expect(resolver.get("other-provider")).resolves.toBeUndefined();
  });

  it("fails closed on run when the selected provider credential is missing without network access", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const trustedBody = "Trusted worker route instruction";
    const promptHash = createHash("sha256").update(trustedBody).digest("hex");
    const outputSchema = z.object({ state: z.string() }).strict();
    const schema = outputSchemaDescriptor(
      "document.analyze",
      "document-readiness-output.v2",
      outputSchema,
    );
    const providerConfig = {
      id: "21000000-0000-4000-8000-000000000001",
      version: 1,
      providerKey: "missing-provider",
      adapterKey: "openai-compatible",
      modelKey: "model-a",
      locality: "external",
      endpoint: "https://provider.example/v1/chat/completions",
      localTrustPolicyId: null,
      localTrustPolicyVersion: null,
      localTrustAllowedIp: null,
    };
    const route = {
      id: "21000000-0000-4000-8000-000000000002",
      routeKey: "document.analyze",
      level: "system",
      scopeId: "21000000-0000-4000-8000-000000000003",
      configs: [
        {
          id: "21000000-0000-4000-8000-000000000004",
          version: 1,
          providers: [
            {
              id: "21000000-0000-4000-8000-000000000005",
              position: 1,
              providerConfig,
            },
          ],
        },
      ],
    };
    const prompt = {
      id: "21000000-0000-4000-8000-000000000006",
      routeKey: "document.analyze",
      version: "document-readiness.v2",
      trustedBody,
      bodyHash: promptHash,
    };
    const schemaArtifact = {
      id: "21000000-0000-4000-8000-000000000007",
      routeKey: "document.analyze",
      version: "document-readiness-output.v2",
      schemaArtifact: schema.schemaArtifact,
      schemaHash: schema.schemaHash,
    };
    const database = {
      aiRoute: {
        findMany: vi.fn(async () => [route]),
        findUnique: vi.fn(async () => route),
      },
      analysisPromptArtifact: {
        findFirst: vi.fn(async () => prompt),
        findUnique: vi.fn(async () => prompt),
      },
      aiOutputSchemaArtifact: {
        findFirst: vi.fn(async () => schemaArtifact),
        findUnique: vi.fn(async () => schemaArtifact),
      },
      authorizationScope: {
        findUnique: vi.fn(async () => ({ id: route.scopeId })),
      },
      aiRun: {
        create: vi.fn(async () => ({
          id: "21000000-0000-4000-8000-000000000008",
        })),
      },
    };
    const router = await createWorkerRuntimeAiRouter(database as never, {
      get: vi.fn(async () => undefined),
    });
    await expect(
      router.run(
        {
          routeKey: "document.analyze",
          systemId: route.scopeId,
          input: {
            trustedInstruction: {
              routeKey: "document.analyze",
              artifactId: prompt.id,
              version: prompt.version,
              sha256: promptHash,
            },
            untrustedContent: { document: "untrusted" },
          },
          inputReference: "document-version:21000000-0000-4000-8000-000000000009",
          inputSchemaVersion: "document-readiness-input.v2",
          outputSchemaVersion: schemaArtifact.version,
          promptTemplateVersion: prompt.version,
          outputSchema,
          sourceReferences: ["document-source:21000000-0000-4000-8000-000000000010"],
          classification: "confidential",
          timeoutMs: 1_000,
          requiresHumanApproval: false,
          correlationId: "21000000-0000-4000-8000-000000000011",
        },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_FAILED" });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
