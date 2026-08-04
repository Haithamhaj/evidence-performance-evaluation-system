import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { FakeAiProviderAdapter } from "./adapters/fake.js";
import { outputSchemaDescriptor } from "./configuration.js";
import { AiProviderError, OpaqueReferenceSchema } from "./contracts.js";
import { validateAiOutput, validateAiOutputSchema } from "./output-validator.js";
import { AiRouter } from "./router.js";

function configuredProvider(
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

function repositoryFor(
  findActiveRoute: import("./contracts.js").RouteRepository["findActiveRoute"],
): import("./contracts.js").RouteRepository {
  return {
    validateInvocationScope: async () => undefined,
    findActiveRoute,
    findOutputSchemaArtifact: async (query) => ({
      id: "00000000-0000-4000-8000-000000000020",
      routeKey: query.routeKey,
      version: query.version,
      schemaHash: query.schemaHash,
    }),
  };
}

const resolvedRoute: import("./contracts.js").ResolvedRoute = {
  routeId: "00000000-0000-4000-8000-000000000001",
  configId: "00000000-0000-4000-8000-000000000002",
  configVersion: 7,
  level: "system",
  scopeId: "00000000-0000-4000-8000-000000000003",
  routeKey: "document.analyze",
  providers: [configuredProvider("fake", "fixture-model", "local")],
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
  const routes = repositoryFor(async () => resolvedRoute);
  const traceRepository: import("./contracts.js").RunTraceRepository = {
    appendRunTrace: async (trace) => {
      traces.push(trace);
      return { id: `run-${traces.length}` };
    },
    commitSucceededRun: async (input) => {
      const persisted = await input.persistValidatedOutput(undefined, input.output);
      const outputReference = OpaqueReferenceSchema.parse(persisted.outputReference);
      const trace = input.buildTrace(outputReference);
      traces.push(trace);
      return { id: `run-${traces.length}`, outputReference };
    },
  };
  return {
    router: new AiRouter(routes, traceRepository, [adapter]),
    traces,
  };
}

describe("AI router output safety", () => {
  it.each([
    "document:eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
    "document:employee-was-excellent-and-deserves-recognition",
  ])("rejects non-opaque reference payload %s", (value) => {
    expect(OpaqueReferenceSchema.safeParse(value).success).toBe(false);
  });

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

  it("uses the run repository as transaction owner so trace failure cannot leave feature output", async () => {
    const committedOutputs: unknown[] = [];
    const completedFailures: import("./contracts.js").AiRunTrace[] = [];
    type StagingTransaction = { stage(output: unknown): void };
    const repository: import("./contracts.js").RouteRepository &
      import("./contracts.js").RunTraceRepository<StagingTransaction> = {
      ...repositoryFor(async () => resolvedRoute),
      appendRunTrace: async (trace: import("./contracts.js").AiRunTrace) => {
        completedFailures.push(trace);
        return { id: "failed-run" };
      },
      commitSucceededRun: async (input) => {
        const staged: unknown[] = [];
        await input.persistValidatedOutput(
          { stage: (output) => staged.push(output) },
          input.output,
        );
        throw new Error("success trace unavailable");
      },
    };
    const router = new AiRouter(repository, repository, [
      new FakeAiProviderAdapter("fake", "local", { supported: true }),
    ]);

    await expect(
      router.run(
        request(z.object({ supported: z.boolean() }).strict()),
        async (transaction: StagingTransaction, output: unknown) => {
          transaction.stage(output);
          return { outputReference: "analysis:792" };
        },
      ),
    ).rejects.toMatchObject({ code: "AI_RUN_PERSISTENCE_FAILED" });
    expect(committedOutputs).toEqual([]);
    expect(completedFailures[0]).toMatchObject({ state: "failed", errorCategory: "persistence" });
  });

  it("uses configured provider fallback order only for allowed error categories", async () => {
    const route: import("./contracts.js").ResolvedRoute = {
      ...resolvedRoute,
      providers: [
        configuredProvider("first", "m1", "local"),
        configuredProvider("second", "m2", "external"),
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
      repositoryFor(async () => route),
      {
        appendRunTrace: async (trace) => {
          traces.push(trace);
          return { id: "run-1" };
        },
        commitSucceededRun: async (input) => {
          const persisted = await input.persistValidatedOutput(undefined, input.output);
          const outputReference = OpaqueReferenceSchema.parse(persisted.outputReference);
          const trace = input.buildTrace(outputReference);
          traces.push(trace);
          return { id: "run-1", outputReference };
        },
      },
      [first, second],
    );

    await expect(
      router.run(request(z.object({ supported: z.boolean() }).strict()), async () => ({
        outputReference: "analysis:790",
      })),
    ).resolves.toMatchObject({ output: { supported: true } });
    expect(calls).toEqual(["first", "second"]);
    expect(traces[0]?.fallbackChain).toEqual([
      { providerKey: "first", modelKey: "m1", outcome: "retryable" },
      { providerKey: "second", modelKey: "m2", outcome: "succeeded" },
    ]);
  });

  it("fails closed on unknown programming errors without external fallback", async () => {
    const route: import("./contracts.js").ResolvedRoute = {
      ...resolvedRoute,
      providers: [
        configuredProvider("broken", "m1", "local"),
        configuredProvider("external", "m2", "external"),
      ],
    };
    const external = new FakeAiProviderAdapter("external", "external", { supported: true });
    const broken: import("./contracts.js").AiProviderAdapter = {
      providerKey: "broken",
      adapterKey: "broken",
      locality: "local",
      matchesConfiguration: () => true,
      generate: async () => {
        throw new Error("programming defect");
      },
    };
    const traces: import("./contracts.js").AiRunTrace[] = [];
    const router = new AiRouter(
      repositoryFor(async () => route),
      {
        appendRunTrace: async (trace) => {
          traces.push(trace);
          return { id: "run-unknown-error" };
        },
        commitSucceededRun: async () => {
          throw new Error("success persistence is not expected");
        },
      },
      [broken, external],
    );

    await expect(
      router.run(request(z.object({ supported: z.boolean() }).strict()), vi.fn()),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_FAILED" });
    expect(external.requests).toHaveLength(0);
    expect(traces[0]).toMatchObject({ state: "failed", errorCategory: "non_retryable" });
  });

  it("races the entire provider operation against timeout even when it ignores AbortSignal", async () => {
    const slow: import("./contracts.js").AiProviderAdapter = {
      providerKey: "fake",
      adapterKey: "fake",
      locality: "local",
      matchesConfiguration: () => true,
      generate: async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return { output: { supported: true } };
      },
    };
    const { router, traces } = harness(slow as FakeAiProviderAdapter);
    const started = performance.now();

    await expect(
      router.run(
        { ...request(z.object({ supported: z.boolean() }).strict()), timeoutMs: 10 },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_FAILED" });
    expect(performance.now() - started).toBeLessThan(100);
    expect(traces[0]).toMatchObject({ state: "failed", errorCategory: "timeout" });
  });

  it.each(["adapter-missing", "fallback-policy", "invalid-output"] as const)(
    "bounds never-settling %s trace persistence by the whole-run deadline",
    async (scenario) => {
      const providers =
        scenario === "fallback-policy"
          ? [
              configuredProvider("fake", "fixture-model", "local"),
              configuredProvider("external", "fallback-model", "external"),
            ]
          : resolvedRoute.providers;
      const route = { ...resolvedRoute, providers };
      const fake = new FakeAiProviderAdapter(
        "fake",
        "local",
        scenario === "fallback-policy"
          ? () => {
              throw new AiProviderError("retryable");
            }
          : scenario === "invalid-output"
            ? { unsupported: true }
            : { supported: true },
      );
      const router = new AiRouter(
        repositoryFor(async () => route),
        {
          appendRunTrace: () => new Promise<never>(() => undefined),
          commitSucceededRun: async () => {
            throw new Error("success persistence is not expected");
          },
        },
        scenario === "adapter-missing" ? [] : [fake],
      );
      const run = router.run(
        {
          ...request(z.object({ supported: z.boolean() }).strict()),
          classification: scenario === "fallback-policy" ? "local_only" : "confidential",
          timeoutMs: 20,
        },
        vi.fn(),
      );
      const started = performance.now();
      const hung = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("run exceeded bounded test guard")), 120),
      );
      const expectedCode = {
        "adapter-missing": "AI_PROVIDER_FAILED",
        "fallback-policy": "AI_FALLBACK_FORBIDDEN",
        "invalid-output": "AI_OUTPUT_QUARANTINED",
      }[scenario];

      await expect(Promise.race([run, hung])).rejects.toMatchObject({ code: expectedCode });
      expect(performance.now() - started).toBeLessThan(100);
    },
  );

  it("uses one deadline across schema lookup, scope and route resolution, and all fallbacks", async () => {
    const delay = (milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
    const route: import("./contracts.js").ResolvedRoute = {
      ...resolvedRoute,
      providers: [
        configuredProvider("slow-first", "m1", "local"),
        configuredProvider("second", "m2", "local"),
      ],
    };
    const repository = {
      findOutputSchemaArtifact: async (query: {
        routeKey: string;
        version: string;
        schemaHash: string;
      }) => {
        await delay(25);
        return {
          id: "00000000-0000-4000-8000-000000000020",
          routeKey: query.routeKey,
          version: query.version,
          schemaHash: query.schemaHash,
        };
      },
      validateInvocationScope: async () => delay(25),
      findActiveRoute: async () => {
        await delay(15);
        return route;
      },
    } as import("./contracts.js").RouteRepository & {
      validateInvocationScope(scope: import("./contracts.js").RouteScope): Promise<void>;
    };
    const first: import("./contracts.js").AiProviderAdapter = {
      providerKey: "slow-first",
      adapterKey: "slow-first",
      locality: "local",
      matchesConfiguration: () => true,
      generate: async () => {
        await delay(200);
        throw new AiProviderError("retryable");
      },
    };
    const second = new FakeAiProviderAdapter("second", "local", { supported: true });
    const traces: import("./contracts.js").AiRunTrace[] = [];
    const router = new AiRouter(
      repository,
      {
        appendRunTrace: async (trace) => {
          traces.push(trace);
          return { id: "run-total-deadline" };
        },
        commitSucceededRun: async () => {
          throw new Error("deadline must prevent success persistence");
        },
      },
      [first, second],
    );
    const started = performance.now();

    await expect(
      router.run(
        { ...request(z.object({ supported: z.boolean() }).strict()), timeoutMs: 150 },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_FAILED" });
    expect(performance.now() - started).toBeLessThan(215);
    expect(second.requests).toHaveLength(0);
    expect(traces[0]).toMatchObject({ state: "failed", errorCategory: "timeout" });
  });

  it("bounds atomic persistence and prevents a late callback from committing success", async () => {
    const delay = (milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
    const adapter = new FakeAiProviderAdapter("fake", "local", { supported: true });
    const committedFeatureOutputs: string[] = [];
    const traces: import("./contracts.js").AiRunTrace[] = [];
    const router = new AiRouter(
      repositoryFor(async () => resolvedRoute),
      {
        appendRunTrace: async (trace) => {
          traces.push(trace);
          return { id: `run-${traces.length}` };
        },
        commitSucceededRun: async (input) => {
          const stagedFeatureOutputs: string[] = [];
          const persisted = await input.persistValidatedOutput(stagedFeatureOutputs, input.output);
          const signal = (input as typeof input & { signal?: AbortSignal }).signal;
          if (signal?.aborted) throw new AiProviderError("timeout");
          committedFeatureOutputs.push(...stagedFeatureOutputs);
          const outputReference = OpaqueReferenceSchema.parse(persisted.outputReference);
          const trace = input.buildTrace(outputReference);
          traces.push(trace);
          return { id: `run-${traces.length}`, outputReference };
        },
      },
      [adapter],
    );
    const started = performance.now();

    await expect(
      router.run(
        { ...request(z.object({ supported: z.boolean() }).strict()), timeoutMs: 25 },
        async (transaction) => {
          await delay(80);
          (transaction as string[]).push("feature-output");
          return { outputReference: "analysis:792" };
        },
      ),
    ).rejects.toMatchObject({ code: "AI_RUN_PERSISTENCE_FAILED" });
    expect(performance.now() - started).toBeLessThan(70);
    await delay(90);
    expect(committedFeatureOutputs).toEqual([]);
    expect(traces).not.toContainEqual(expect.objectContaining({ state: "succeeded" }));
  });

  it("validates authoritative invocation scope types before any provider side effect", async () => {
    const adapter = new FakeAiProviderAdapter("fake", "local", { supported: true });
    const repository = {
      ...repositoryFor(async () => resolvedRoute),
      validateInvocationScope: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("wrong project scope type"), { code: "AI_RUN_SCOPE_INVALID" }),
        ),
    };
    const router = new AiRouter(
      repository,
      {
        appendRunTrace: vi.fn(),
        commitSucceededRun: vi.fn(),
      },
      [adapter],
    );

    await expect(
      router.run(
        {
          ...request(z.object({ supported: z.boolean() }).strict()),
          projectId: "00000000-0000-4000-8000-000000000099",
        },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: "AI_RUN_SCOPE_INVALID" });
    expect(repository.validateInvocationScope).toHaveBeenCalledOnce();
    expect(adapter.requests).toHaveLength(0);
  });

  it("rejects a schema artifact whose authoritative route key contradicts the request", async () => {
    const adapter = new FakeAiProviderAdapter("fake", "local", { supported: true });
    const repository = {
      ...repositoryFor(async () => resolvedRoute),
      findOutputSchemaArtifact: async (query: { version: string; schemaHash: string }) => ({
        id: "00000000-0000-4000-8000-000000000020",
        routeKey: "different.route",
        version: query.version,
        schemaHash: query.schemaHash,
      }),
    };
    const router = new AiRouter(
      repository,
      { appendRunTrace: vi.fn(), commitSucceededRun: vi.fn() },
      [adapter],
    );

    await expect(
      router.run(request(z.object({ supported: z.boolean() }).strict()), vi.fn()),
    ).rejects.toMatchObject({ code: "AI_SCHEMA_ARTIFACT_ROUTE_MISMATCH" });
    expect(adapter.requests).toHaveLength(0);
  });

  it.each([
    { inputReference: "https://private.example/document?token=secret" },
    { inputReference: "Bearer abc123" },
    { sourceReferences: ["document:ok", "api_key=secret"] },
    { inputReference: `document:${"x".repeat(300)}` },
    { inputReference: "document:eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature" },
    { inputReference: "document:employee-was-excellent-and-deserves-recognition" },
  ])(
    "rejects unsafe or unbounded opaque references before provider execution",
    async (override) => {
      const adapter = new FakeAiProviderAdapter("fake", "local", { supported: true });
      const { router } = harness(adapter);

      await expect(
        router.run(
          { ...request(z.object({ supported: z.boolean() }).strict()), ...override },
          vi.fn(),
        ),
      ).rejects.toMatchObject({ code: "AI_RUN_REQUEST_INVALID" });
      expect(adapter.requests).toHaveLength(0);
    },
  );

  it("persists only approved nonnegative usage and cost metadata", async () => {
    const adapter = new FakeAiProviderAdapter("fake", "local", {
      supported: true,
      usage: { inputTokens: 5, secretMetric: 999 },
      costUsd: -1,
    });
    const { router, traces } = harness(adapter);

    await router.run(request(z.object({ supported: z.boolean() }).strict()), async () => ({
      outputReference: "analysis:791",
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

  it.each([
    "updateCount",
    "evidenceCount",
    "changedLineCount",
    "activityVolume",
    "productivityIndex",
    "productivityMeasure",
    "rankedEmployeeIds",
    "employeeRankingBand",
  ])("rejects protected compound performance field %s", (field) => {
    expect(() =>
      validateAiOutputSchema("evaluation.prepare", z.object({ [field]: z.number() })),
    ).toThrowError(expect.objectContaining({ code: "AI_OUTPUT_SCHEMA_FORBIDDEN" }));
  });

  it.each([
    "managerPerformanceScore",
    "performanceGrade",
    "rankedTeamMemberIds",
    "workerRanking",
    "personLeaderboardPosition",
    "suggestedPerformanceLevel",
    "staffRanking",
    "contributorRank",
    "personnelRanking",
    "workforceRank",
    "colleagueRanking",
    "peerLeaderboard",
    "coworkerOrder",
    "talentRanking",
    "subordinateRank",
    "candidateRanking",
    "commitTotal",
    "numberOfCommits",
    "numUpdates",
    "totalActivities",
    "evidenceAmount",
    "changedLineFrequency",
    "prVolume",
    "deliveryCount",
  ])("rejects protected morphology-pair field %s", (field) => {
    expect(() =>
      validateAiOutputSchema("evaluation.prepare", z.object({ [field]: z.number() })),
    ).toThrowError(expect.objectContaining({ code: "AI_OUTPUT_SCHEMA_FORBIDDEN" }));
  });

  it.each(["talentRanking", "candidateRank", "subordinateLeaderboard", "successionRanked"])(
    "rejects global ranking field %s outside an evaluation route",
    (field) => {
      expect(() =>
        validateAiOutputSchema("document.analyze", z.object({ [field]: z.number() })),
      ).toThrowError(expect.objectContaining({ code: "AI_OUTPUT_SCHEMA_FORBIDDEN" }));
      expect(
        validateAiOutput(
          "document.analyze",
          z.object({ details: z.record(z.string(), z.unknown()) }).strict(),
          { details: { [field]: 1 } },
        ),
      ).toMatchObject({ valid: false, issueCodes: ["forbidden_performance_field"] });
    },
  );

  it.each([
    "staffPriorityRank",
    "employeeLeaderboardTitle",
    "peopleRiskLeaderboard",
    "candidateRelevanceRank",
    "applicantOrder",
    "directReportOrder",
    "associateOrder",
  ])("rejects every non-reviewed ranking or order shape on every route: %s", (field) => {
    expect(() =>
      validateAiOutputSchema("document.analyze", z.object({ [field]: z.number() })),
    ).toThrowError(expect.objectContaining({ code: "AI_OUTPUT_SCHEMA_FORBIDDEN" }));
    expect(
      validateAiOutput(
        "document.analyze",
        z.object({ details: z.record(z.string(), z.unknown()) }).strict(),
        { details: { [field]: 1 } },
      ),
    ).toMatchObject({ valid: false, issueCodes: ["forbidden_performance_field"] });
  });

  it.each([
    "staffpriorityrank",
    "STAFFPRIORITYRANK",
    "candidateranking",
    "CANDIDATERANKING",
    "candidateRanking2",
    "staffdisplayorder",
    "employeeleaderboardtitle",
  ])(
    "rejects normalized, concatenated, cased, and suffixed ranking or order shape: %s",
    (field) => {
      const schema = z.object({ [field]: z.string() });

      expect(() => validateAiOutputSchema("document.analyze", schema)).toThrowError(
        expect.objectContaining({ code: "AI_OUTPUT_SCHEMA_FORBIDDEN" }),
      );
      expect(validateAiOutput("document.analyze", schema, { [field]: "unsafe" })).toMatchObject({
        valid: false,
        issueCodes: ["forbidden_performance_field"],
      });
    },
  );

  it.each([
    "searchRanking",
    "priorityRanking",
    "riskRanking",
    "relevanceRanking",
    "leaderboardTitle",
    "leaderboardLabel",
    "leaderboardDescription",
    "displayOrder",
    "criterionOrder",
    "sortOrder",
    "resultOrder",
  ])("allows exact reviewed neutral ranking or order shape: %s", (field) => {
    expect(() =>
      validateAiOutputSchema("document.analyze", z.object({ [field]: z.string() })),
    ).not.toThrow();
    expect(
      validateAiOutput(
        "document.analyze",
        z.object({ details: z.record(z.string(), z.unknown()) }).strict(),
        { details: { [field]: "neutral" } },
      ),
    ).toMatchObject({ valid: true });
  });

  it.each([
    "performanceContext",
    "qualityScore",
    "commitMessage",
    "totalCost",
    "numberFormat",
    "activityDescription",
    "projectStatus",
    "outputFormat",
    "leaderboardTitle",
    "performanceLevelDescription",
    "staffDirectory",
    "contributorRole",
    "searchRanking",
    "priorityRanking",
    "riskRanking",
    "relevanceRanking",
    "displayOrder",
    "criterionOrder",
    "sortOrder",
    "resultOrder",
  ])("allows neutral field that contains only one protected token family: %s", (field) => {
    expect(() =>
      validateAiOutputSchema("evaluation.prepare", z.object({ [field]: z.string() })),
    ).not.toThrow();
  });

  it.each(["displayOrder", "criterionOrder", "sortOrder", "resultOrder"])(
    "allows neutral runtime order metadata %s",
    (field) => {
      expect(
        validateAiOutput(
          "evaluation.prepare",
          z.object({ details: z.record(z.string(), z.unknown()) }).strict(),
          { details: { [field]: 1 } },
        ),
      ).toMatchObject({ valid: true });
    },
  );

  it.each([
    { details: { updateCount: 3 } },
    { details: { productivityIndex: 0.8 } },
    { details: { rankedEmployeeIds: ["employee:1"] } },
    { details: { managerPerformanceScore: 4 } },
    { details: { rankedTeamMemberIds: ["employee:1"] } },
    { details: { numberOfCommits: 12 } },
    { details: { totalActivities: 20 } },
    { details: { suggestedPerformanceLevel: "high" } },
    { details: { staffRanking: 1 } },
    { details: { contributorRank: 2 } },
    { details: { personnelRanking: 1 } },
    { details: { workforceRank: 2 } },
    { details: { colleagueRanking: 3 } },
    { details: { peerLeaderboard: 4 } },
    { details: { coworkerOrder: 5 } },
    { details: { talentRanking: 6 } },
    { details: { subordinateRank: 7 } },
    { details: { candidateRanking: 8 } },
  ])("quarantines protected compound fields inside dynamic output", async (output) => {
    const adapter = new FakeAiProviderAdapter("fake", "local", output);
    const { router } = harness(adapter);
    const persistValidatedOutput = vi.fn();

    await expect(
      router.run(
        {
          ...request(z.object({ details: z.record(z.string(), z.unknown()) }).strict()),
          routeKey: "evaluation.prepare",
        },
        persistValidatedOutput,
      ),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_QUARANTINED" });
    expect(persistValidatedOutput).not.toHaveBeenCalled();
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

  it.each([
    ["custom refinement", z.object({ summary: z.string().refine((value) => value.length > 3) })],
    ["custom super refinement", z.object({ summary: z.string().superRefine(() => undefined) })],
    ["transform", z.object({ summary: z.string().transform((value) => value.trim()) })],
    ["preprocess", z.object({ summary: z.preprocess((value) => value, z.string()) })],
    ["coercion", z.object({ summary: z.coerce.string() })],
    ["default", z.object({ summary: z.string().default("safe") })],
    ["catch", z.object({ summary: z.string().catch("safe") })],
  ] as const)(
    "rejects %s because persisted JSON Schema cannot identify its runtime semantics",
    (_, schema) => {
      expect(() =>
        outputSchemaDescriptor("document.analyze", "document-output.v1", schema),
      ).toThrowError(expect.objectContaining({ code: "AI_SCHEMA_SEMANTICS_UNREPRESENTABLE" }));
    },
  );

  it("does not allow opposing runtime refinements to share one schema identity", () => {
    const acceptsA = z.object({ value: z.string().refine((value) => value === "a") });
    const acceptsB = z.object({ value: z.string().refine((value) => value === "b") });

    expect(() =>
      outputSchemaDescriptor("document.analyze", "document-output.v1", acceptsA),
    ).toThrowError(expect.objectContaining({ code: "AI_SCHEMA_SEMANTICS_UNREPRESENTABLE" }));
    expect(() =>
      outputSchemaDescriptor("document.analyze", "document-output.v1", acceptsB),
    ).toThrowError(expect.objectContaining({ code: "AI_SCHEMA_SEMANTICS_UNREPRESENTABLE" }));
  });

  it("allows built-in constraints that are represented exactly in canonical JSON Schema", () => {
    expect(() =>
      outputSchemaDescriptor(
        "document.analyze",
        "document-output.v1",
        z.object({ summary: z.string().min(3).max(200), confidence: z.number().min(0).max(1) }),
      ),
    ).not.toThrow();
  });

  it("does not describe or hash a protected output schema", () => {
    expect(() =>
      outputSchemaDescriptor(
        "evaluation.prepare",
        "evaluation-output.v1",
        z.object({ workforceRanking: z.number() }).strict(),
      ),
    ).toThrowError(expect.objectContaining({ code: "AI_OUTPUT_SCHEMA_FORBIDDEN" }));
  });

  it("rejects an unrepresentable runtime schema before provider execution", async () => {
    const adapter = new FakeAiProviderAdapter("fake", "local", { summary: "safe" });
    const { router } = harness(adapter);

    await expect(
      router.run(
        request(z.object({ summary: z.string().refine((value) => value === "safe") })),
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: "AI_SCHEMA_SEMANTICS_UNREPRESENTABLE" });
    expect(adapter.requests).toHaveLength(0);
  });
});
