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
            configs: [
              { providers: [{ providerConfig: selected }] },
              { providers: [{ providerConfig: provider("retired-provider", 1) }] },
            ],
          },
        ]),
      },
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
          { configs: [{ providers: [{ providerConfig: provider("provider-a", 1) }] }] },
          { configs: [{ providers: [{ providerConfig: provider("provider-a", 2) }] }] },
        ]),
      },
    };
    await expect(
      createRuntimeAiRouter({
        database: database as never,
        secretResolver: { get: vi.fn() },
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_CONFIGURATION_CONFLICT" });
  });
});

function provider(providerKey: string, version: number) {
  return {
    id: `00000000-0000-4000-8000-00000000000${version}`,
    providerKey,
    version,
    adapterKey: "openai-compatible",
    modelKey: "model-a",
    locality: "external",
    endpoint: "https://provider.example/v1",
    localTrustPolicyId: null,
    localTrustPolicyVersion: null,
    localTrustAllowedIp: null,
  } as const;
}
