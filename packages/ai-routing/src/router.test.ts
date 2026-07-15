import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { FakeAiProviderAdapter } from "./adapters/fake.js";
import { validateAiOutputSchema } from "./output-validator.js";
import { AiRouter } from "./router.js";

const resolvedRoute: import("./contracts.js").ResolvedRoute = {
  routeId: "00000000-0000-4000-8000-000000000001",
  configId: "00000000-0000-4000-8000-000000000002",
  configVersion: 7,
  level: "system",
  scopeId: "00000000-0000-4000-8000-000000000003",
  routeKey: "document.analyze",
  providers: [{ providerKey: "fake", modelKey: "fixture-model", locality: "local" }],
};

const forbiddenSchemas: ReadonlyArray<readonly [string, z.ZodType]> = [
  ["recommended rating", z.object({ recommendedRating: z.number() })],
  ["compound rating recommendation", z.object({ managerRatingRecommendation: z.number() })],
  ["employee ranking", z.object({ employeeRank: z.number() })],
  ["productivity score", z.object({ productivityScore: z.number() })],
  ["bare performance rating", z.object({ performanceRating: z.number() })],
];

function request<T>(outputSchema: z.ZodType<T>) {
  return {
    routeKey: "document.analyze",
    systemId: resolvedRoute.scopeId,
    input: { authorizedReference: "document-version:123" },
    inputReference: "document-version:123",
    inputSchemaVersion: "document-input.v1",
    outputSchemaVersion: "document-output.v1",
    promptTemplateVersion: "document-analyze.v1",
    outputSchema,
    sourceReferences: ["document-version:123", "template-version:456"],
    classification: "confidential" as const,
    timeoutMs: 1_000,
    requiresHumanApproval: true,
    correlationId: "00000000-0000-4000-8000-000000000004",
  };
}

function harness(adapter: FakeAiProviderAdapter) {
  const traces: import("./contracts.js").AiRunTrace[] = [];
  const routes: import("./contracts.js").RouteRepository = {
    findActiveRoute: async () => resolvedRoute,
  };
  const traceRepository: import("./contracts.js").RunTraceRepository = {
    appendRunTrace: async (trace) => {
      traces.push(trace);
      return { id: `run-${traces.length}` };
    },
  };
  return {
    router: new AiRouter(routes, traceRepository, [adapter]),
    traces,
  };
}

describe("AI router output safety", () => {
  it("quarantines invalid structured output without invoking feature persistence", async () => {
    const adapter = new FakeAiProviderAdapter("fake", "local", { unsupported: true });
    const { router, traces } = harness(adapter);
    const persistValidatedOutput = vi.fn();

    await expect(
      router.run(request(z.object({ supported: z.boolean() }).strict()), persistValidatedOutput),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_QUARANTINED" });

    expect(persistValidatedOutput).not.toHaveBeenCalled();
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      state: "quarantined",
      errorCategory: "invalid_output",
      outputReference: null,
      sourceReferences: ["document-version:123", "template-version:456"],
    });
    expect(JSON.stringify(traces[0])).not.toContain("unsupported");
  });

  it("quarantines prohibited fields hidden inside a schema-valid dynamic record", async () => {
    const adapter = new FakeAiProviderAdapter("fake", "local", {
      details: { recommendedRating: 5 },
    });
    const { router, traces } = harness(adapter);
    const persistValidatedOutput = vi.fn();

    await expect(
      router.run(
        request(z.object({ details: z.record(z.string(), z.unknown()) }).strict()),
        persistValidatedOutput,
      ),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_QUARANTINED" });

    expect(persistValidatedOutput).not.toHaveBeenCalled();
    expect(traces[0]).toMatchObject({
      state: "quarantined",
      validationIssueCodes: ["forbidden_performance_field"],
    });
    expect(JSON.stringify(traces[0])).not.toContain("recommendedRating");
  });

  it("persists validated output only after schema validation and records exact trace metadata", async () => {
    const adapter = new FakeAiProviderAdapter("fake", "local", {
      supported: true,
      summary: "safe",
    });
    const { router, traces } = harness(adapter);
    const persistValidatedOutput = vi.fn().mockResolvedValue({ outputReference: "analysis:789" });

    await expect(
      router.run(
        request(z.object({ supported: z.boolean(), summary: z.string() }).strict()),
        persistValidatedOutput,
      ),
    ).resolves.toMatchObject({
      output: { supported: true, summary: "safe" },
      outputReference: "analysis:789",
      requiresHumanApproval: true,
    });

    expect(persistValidatedOutput).toHaveBeenCalledTimes(1);
    expect(traces[0]).toMatchObject({
      routeConfigVersion: 7,
      providerKey: "fake",
      modelKey: "fixture-model",
      classification: "confidential",
      state: "succeeded",
      humanApprovalState: "pending",
      inputReference: "document-version:123",
      outputReference: "analysis:789",
      sourceReferences: ["document-version:123", "template-version:456"],
    });
  });

  it("uses configured provider fallback order only for allowed error categories", async () => {
    const route: import("./contracts.js").ResolvedRoute = {
      ...resolvedRoute,
      providers: [
        { providerKey: "first", modelKey: "m1", locality: "local" },
        { providerKey: "second", modelKey: "m2", locality: "external" },
      ],
    };
    const calls: string[] = [];
    const first = new FakeAiProviderAdapter("first", "local", () => {
      calls.push("first");
      return { errorCategory: "retryable" as const };
    });
    const second = new FakeAiProviderAdapter("second", "external", () => {
      calls.push("second");
      return { supported: true };
    });
    const traces: import("./contracts.js").AiRunTrace[] = [];
    const router = new AiRouter(
      { findActiveRoute: async () => route },
      {
        appendRunTrace: async (trace) => {
          traces.push(trace);
          return { id: "run-1" };
        },
      },
      [first, second],
    );

    await expect(
      router.run(request(z.object({ supported: z.boolean() }).strict()), async () => ({
        outputReference: "analysis:allowed-fallback",
      })),
    ).resolves.toMatchObject({ output: { supported: true } });
    expect(calls).toEqual(["first", "second"]);
    expect(traces[0]?.fallbackChain).toEqual([
      { providerKey: "first", modelKey: "m1", outcome: "retryable" },
      { providerKey: "second", modelKey: "m2", outcome: "succeeded" },
    ]);
  });

  it("persists only approved nonnegative usage and cost metadata", async () => {
    const adapter = new FakeAiProviderAdapter("fake", "local", {
      supported: true,
      usage: { inputTokens: 5, secretMetric: 999 },
      costUsd: -1,
    });
    const { router, traces } = harness(adapter);

    await router.run(request(z.object({ supported: z.boolean() }).strict()), async () => ({
      outputReference: "analysis:sanitized-metadata",
    }));

    expect(traces[0]?.usage).toEqual({ inputTokens: 5 });
    expect(traces[0]?.costUsd).toBeNull();
  });

  it.each(forbiddenSchemas)(
    "rejects a prohibited %s output schema before provider execution",
    async (_, schema) => {
      const adapter = new FakeAiProviderAdapter("fake", "local", {});
      const { router } = harness(adapter);

      await expect(router.run(request(schema), vi.fn())).rejects.toMatchObject({
        code: "AI_OUTPUT_SCHEMA_FORBIDDEN",
      });
      expect(adapter.requests).toHaveLength(0);
    },
  );

  it("rejects raw activity-count and readiness-as-performance fields in evaluation output", () => {
    expect(() =>
      validateAiOutputSchema(
        "evaluation.prepare",
        z.object({ githubCommitCount: z.number(), documentationReadinessPercentage: z.number() }),
      ),
    ).toThrowError(expect.objectContaining({ code: "AI_OUTPUT_SCHEMA_FORBIDDEN" }));
  });

  it("does not mistake ordinary words ending in 'rating' for a rating field", () => {
    expect(() =>
      validateAiOutputSchema("document.analyze", z.object({ operatingModel: z.string() })),
    ).not.toThrow();
  });

  it("allows a non-scoring documentation readiness schema outside performance routes", () => {
    expect(() =>
      validateAiOutputSchema(
        "document.readiness",
        z.object({ documentationReadinessPercentage: z.number().min(0).max(100) }),
      ),
    ).not.toThrow();
  });
});
