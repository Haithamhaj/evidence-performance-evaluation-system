import { describe, expect, it } from "vitest";

import {
  assertExperimentTransition,
  assertMethodReady,
  assertNoSecretConfiguration,
} from "./experiment-invariants.js";

const completeMethod = {
  baseline: { description: "Current retrieval path", value: "120", sourceReference: null },
  measures: [
    {
      stableId: "p95_latency_ms",
      name: "p95 latency",
      kind: "NUMERIC" as const,
      unit: "ms",
      direction: "LOWER" as const,
      baselineValue: "120",
      baselineReference: null,
      interpretationRule: "A lower value than the baseline is favorable.",
    },
  ],
  testCases: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      inputIdentity: "retrieval-benchmark-v1",
      expectedObservation: "Record p95 latency.",
      category: "benchmark",
      inclusionReason: "Represents the bounded sample.",
    },
  ],
  controls: [],
  conditions: ["Use the same runtime and sample."],
  reproducibilityInstructions: "Run the versioned benchmark with the recorded configuration.",
};

describe("Experiment invariants", () => {
  it("accepts a complete reproducible method without declaring it scientifically valid", () => {
    expect(() => assertMethodReady(completeMethod)).not.toThrow();
  });

  it.each([
    ["baseline", { ...completeMethod, baseline: { ...completeMethod.baseline, description: "" } }],
    ["measure", { ...completeMethod, measures: [] }],
    ["sample", { ...completeMethod, testCases: [] }],
    ["conditions", { ...completeMethod, conditions: [] }],
    ["instructions", { ...completeMethod, reproducibilityInstructions: "" }],
    [
      "interpretation",
      {
        ...completeMethod,
        measures: [{ ...completeMethod.measures[0], interpretationRule: "" }],
      },
    ],
  ])("rejects a method missing %s before READY", (_name, method) => {
    expect(() => assertMethodReady(method as Parameters<typeof assertMethodReady>[0])).toThrow();
  });

  it("requires a structured qualitative measure and interpretation rule", () => {
    expect(() =>
      assertMethodReady({
        ...completeMethod,
        measures: [
          {
            kind: "QUALITATIVE",
            interpretationRule: "Describe recurring grounded failure categories.",
          },
        ],
      }),
    ).not.toThrow();
  });

  it("permits only governed lifecycle transitions", () => {
    expect(() => assertExperimentTransition("DRAFT", "READY")).not.toThrow();
    expect(() => assertExperimentTransition("READY", "RUNNING")).not.toThrow();
    expect(() => assertExperimentTransition("RESULT_RECORDED", "CONCLUDED")).not.toThrow();
    expect(() => assertExperimentTransition("CONCLUDED", "RUNNING")).toThrow();
  });

  it("rejects secret-shaped environment and model configuration keys", () => {
    expect(() =>
      assertNoSecretConfiguration([{ name: "runtime", value: "node-24" }]),
    ).not.toThrow();
    expect(() => assertNoSecretConfiguration([{ name: "api_key", value: "not-stored" }])).toThrow();
    expect(() =>
      assertNoSecretConfiguration([{ name: "clientSecret", value: "not-stored" }]),
    ).toThrow();
  });

  it.each([
    ["runtime", `Bearer ${"x".repeat(32)}`],
    ["endpoint", `https://employee:${"p".repeat(24)}@provider.example.invalid/v1`],
    ["certificate", `${["-----BEGIN", "PRIVATE KEY-----"].join(" ")}\n${"A".repeat(64)}`],
    ["provider", `sk-proj-${"x".repeat(32)}`],
    ["header", `api_key=${"x".repeat(32)}`],
  ])("rejects obvious credential material stored under an innocent %s key", (name, value) => {
    expect(() => assertNoSecretConfiguration([{ name, value }])).toThrow(
      expect.objectContaining({ code: "EXPERIMENT_SECRET_CONFIGURATION" }),
    );
  });

  it("allows ordinary reproducibility values that are not credentials", () => {
    expect(() =>
      assertNoSecretConfiguration([
        { name: "runtime", value: "node-24" },
        { name: "model", value: "gpt-5.5" },
        { name: "dataset", value: "retrieval-benchmark-v1" },
      ]),
    ).not.toThrow();
  });
});
