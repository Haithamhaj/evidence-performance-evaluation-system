import { describe, expect, it, vi } from "vitest";

import { OpenAiCompatibleAdapter } from "./openai-compatible.js";

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
      locality: "local",
      baseUrl: "http://127.0.0.1:11434/v1/",
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

  it("rejects credentials embedded in stored adapter URLs", () => {
    expect(
      () =>
        new OpenAiCompatibleAdapter({
          providerKey: "unsafe",
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
          locality: "external",
          baseUrl: "http://example.invalid/v1/",
          credentialProvider: async () => undefined,
        }),
    ).toThrowError(expect.objectContaining({ code: "AI_ADAPTER_URL_INVALID" }));

    expect(
      () =>
        new OpenAiCompatibleAdapter({
          providerKey: "safe-local",
          locality: "local",
          baseUrl: "http://127.0.0.1:11434/v1/",
          credentialProvider: async () => undefined,
        }),
    ).not.toThrow();
  });
});
