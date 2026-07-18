import { describe, expect, it, vi } from "vitest";

import { OpenAiCompatibleAdapter } from "./openai-compatible.js";

const loopbackPolicy = {
  id: "00000000-0000-4000-8000-000000000090",
  version: 1,
  allowedIp: "127.0.0.1",
} as const;

describe("OpenAI-compatible neutral adapter", () => {
  it("aborts timed-out requests and reports only the normalized timeout category", async () => {
    const fetchImplementation = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit): Promise<Response> =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const adapter = new OpenAiCompatibleAdapter({
      providerKey: "local-openai-compatible",
      adapterKey: "openai-compatible",
      locality: "local",
      baseUrl: "http://127.0.0.1:11434/v1/",
      localTrustPolicy: loopbackPolicy,
      credentialProvider: async () => undefined,
      fetchImplementation,
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), 5);

    await expect(
      adapter.generate(
        { routeKey: "document.analyze", modelKey: "local-model", input: { protected: true } },
        controller.signal,
      ),
    ).rejects.toMatchObject({ category: "timeout" });
  });

  it("does not let credential lookup outlive an aborted provider operation", async () => {
    const adapter = new OpenAiCompatibleAdapter({
      providerKey: "slow-credential",
      adapterKey: "openai-compatible",
      locality: "local",
      baseUrl: "http://127.0.0.1:11434/v1/",
      localTrustPolicy: loopbackPolicy,
      credentialProvider: async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return undefined;
      },
      fetchImplementation: async () => new Response("{}", { status: 200 }),
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), 5);
    const started = performance.now();

    await expect(
      adapter.generate(
        { routeKey: "document.analyze", modelKey: "local-model", input: { protected: true } },
        controller.signal,
      ),
    ).rejects.toMatchObject({ category: "timeout" });
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("normalizes credential lookup failure as fail-closed policy rather than retryable", async () => {
    const adapter = new OpenAiCompatibleAdapter({
      providerKey: "credential-failure",
      adapterKey: "openai-compatible",
      locality: "external",
      baseUrl: "https://provider.example.invalid/v1/",
      credentialProvider: async () => {
        throw new Error("credential store unavailable");
      },
      fetchImplementation: vi.fn(),
    });

    await expect(
      adapter.generate(
        { routeKey: "document.analyze", modelKey: "external-model", input: {} },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "policy" });
  });

  it("normalizes request serialization failure as non-retryable", async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const adapter = new OpenAiCompatibleAdapter({
      providerKey: "serialization-failure",
      adapterKey: "openai-compatible",
      locality: "external",
      baseUrl: "https://provider.example.invalid/v1/",
      credentialProvider: async () => undefined,
      fetchImplementation: vi.fn(),
    });

    await expect(
      adapter.generate(
        { routeKey: "document.analyze", modelKey: "external-model", input: cyclic },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "non_retryable" });
  });

  it("rejects credentials embedded in stored adapter URLs", () => {
    expect(
      () =>
        new OpenAiCompatibleAdapter({
          providerKey: "unsafe",
          adapterKey: "openai-compatible",
          locality: "external",
          baseUrl: "https://user:password@example.invalid/v1/",
          credentialProvider: async () => "external-secret",
        }),
    ).toThrowError(expect.objectContaining({ code: "AI_ADAPTER_URL_INVALID" }));
  });

  it("requires HTTPS for external endpoints while allowing loopback HTTP for local endpoints", () => {
    expect(
      () =>
        new OpenAiCompatibleAdapter({
          providerKey: "unsafe-external",
          adapterKey: "openai-compatible",
          locality: "external",
          baseUrl: "http://example.invalid/v1/",
          credentialProvider: async () => undefined,
        }),
    ).toThrowError(expect.objectContaining({ code: "AI_ADAPTER_URL_INVALID" }));

    expect(
      () =>
        new OpenAiCompatibleAdapter({
          providerKey: "safe-local",
          adapterKey: "openai-compatible",
          locality: "local",
          baseUrl: "http://127.0.0.1:11434/v1/",
          localTrustPolicy: loopbackPolicy,
          credentialProvider: async () => undefined,
        }),
    ).not.toThrow();
  });

  it.each([
    "http://198.51.100.20:11434/v1/",
    "https://remote-model.example.invalid/v1/",
    "http://localhost.example.invalid:11434/v1/",
  ])("rejects arbitrary remote or DNS endpoints labeled local: %s", (baseUrl) => {
    expect(
      () =>
        new OpenAiCompatibleAdapter({
          providerKey: "false-local",
          adapterKey: "openai-compatible",
          locality: "local",
          baseUrl,
          localTrustPolicy: { ...loopbackPolicy, allowedIp: "198.51.100.20" },
          credentialProvider: async () => undefined,
        }),
    ).toThrowError(expect.objectContaining({ code: "AI_ADAPTER_URL_INVALID" }));
  });

  it("allows only explicitly trusted on-prem IP literals in addition to loopback", () => {
    expect(
      () =>
        new OpenAiCompatibleAdapter({
          providerKey: "trusted-on-prem",
          adapterKey: "openai-compatible",
          locality: "local",
          baseUrl: "https://10.20.30.40:8443/v1/",
          localTrustPolicy: { ...loopbackPolicy, allowedIp: "10.20.30.40" },
          credentialProvider: async () => undefined,
        }),
    ).not.toThrow();
    expect(
      () =>
        new OpenAiCompatibleAdapter({
          providerKey: "dns-even-if-listed",
          adapterKey: "openai-compatible",
          locality: "local",
          baseUrl: "https://model.internal.example/v1/",
          localTrustPolicy: { ...loopbackPolicy, allowedIp: "10.20.30.40" },
          credentialProvider: async () => undefined,
        }),
    ).toThrowError(expect.objectContaining({ code: "AI_ADAPTER_URL_INVALID" }));
  });

  it("rejects plaintext HTTP for a non-loopback on-prem endpoint", () => {
    expect(
      () =>
        new OpenAiCompatibleAdapter({
          providerKey: "plaintext-on-prem",
          adapterKey: "openai-compatible",
          locality: "local",
          baseUrl: "http://10.20.30.40:8080/v1/",
          localTrustPolicy: { ...loopbackPolicy, allowedIp: "10.20.30.40" },
          credentialProvider: async () => undefined,
        }),
    ).toThrowError(expect.objectContaining({ code: "AI_ADAPTER_URL_INVALID" }));
  });

  it("matches the registered adapter and exact immutable local-trust policy identity", () => {
    const policyId = "00000000-0000-4000-8000-000000000091";
    const options = {
      providerKey: "trusted-on-prem",
      adapterKey: "openai-compatible",
      locality: "local" as const,
      baseUrl: "https://10.20.30.40:8443/v1/",
      localTrustPolicy: { id: policyId, version: 3, allowedIp: "10.20.30.40" },
      credentialProvider: async () => undefined,
    };
    const adapter = new OpenAiCompatibleAdapter(options);
    const provider = {
      routeConfigProviderId: crypto.randomUUID(),
      providerConfigId: crypto.randomUUID(),
      providerConfigVersion: 1,
      providerKey: "trusted-on-prem",
      adapterKey: "openai-compatible",
      modelKey: "model-a",
      locality: "local" as const,
      endpoint: "https://10.20.30.40:8443/v1/chat/completions",
      localTrustPolicyId: policyId,
      localTrustPolicyVersion: 3,
      localTrustAllowedIp: "10.20.30.40",
    };

    expect(adapter.matchesConfiguration(provider)).toBe(true);
    expect(adapter.matchesConfiguration({ ...provider, adapterKey: "different-adapter" })).toBe(
      false,
    );
    expect(adapter.matchesConfiguration({ ...provider, localTrustPolicyVersion: 4 })).toBe(false);
  });

  it("keeps an already normalized persisted endpoint unchanged at runtime", () => {
    const endpoint = "https://api.openai.com/v1/chat/completions";
    const adapter = new OpenAiCompatibleAdapter({
      providerKey: "openai",
      adapterKey: "openai-compatible",
      locality: "external",
      baseUrl: endpoint,
      credentialProvider: async () => undefined,
    });

    expect(
      adapter.matchesConfiguration({
        routeConfigProviderId: crypto.randomUUID(),
        providerConfigId: crypto.randomUUID(),
        providerConfigVersion: 1,
        providerKey: "openai",
        adapterKey: "openai-compatible",
        modelKey: "gpt-5.5-2026-04-23",
        locality: "external",
        endpoint,
        localTrustPolicyId: null,
        localTrustPolicyVersion: null,
        localTrustAllowedIp: null,
      }),
    ).toBe(true);
  });
});
