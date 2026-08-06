import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  ExperimentInterpretAiOutputSchema,
  ExperimentMethodReviewAiOutputSchema,
  ResearchFrameAiOutputSchema,
  ResearchSourceReviewAiOutputSchema,
  ResearchSynthesisAiOutputSchema,
  assertCitationsAllowed,
  assertExperimentInterpretationSemantics,
  assertExperimentMethodReviewSemantics,
  assertResearchAiOutputSafe,
  assertResearchOutputSemantics,
  assertResearchSourceReviewSemantics,
  assertResearchSynthesisSemantics,
  buildResearchAiRequest,
} from "../../packages/research-experiments/src/prompts.js";

type Fixture = Readonly<{
  id: string;
  locale: "en" | "ar-Fusha" | "ar-Gulf" | "ar-Levantine" | "mixed";
  case: string;
  route:
    | "research.source-review.v1"
    | "research.frame.v1"
    | "research.synthesize.v1"
    | "experiment.method-review.v1"
    | "experiment.interpret.v1";
  input: string;
  allowedReferences: readonly string[];
  output: unknown;
  expected: "accept" | "reject";
  runBinding?: Readonly<{
    runId: string;
    methodRevisionId: string;
    resultStatus: "COMPLETED" | "FAILED" | "INVALID" | "STOPPED";
    runReference: string;
  }>;
}>;

const fixturePath = new URL("../ai-evals/fixtures/research-experiments.json", import.meta.url);

describe("Research & Experiments deterministic multilingual AI evaluations", () => {
  it("covers every required language and adversarial condition", async () => {
    const fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture[];
    expect(new Set(fixtures.map(({ locale }) => locale))).toEqual(
      new Set(["en", "ar-Fusha", "ar-Gulf", "ar-Levantine", "mixed"]),
    );
    for (const required of [
      "malicious-instruction",
      "missing-license",
      "blocked-content",
      "unsupported-conclusion",
      "failed-experiment",
      "method-review",
      "prohibited-rating-request",
      "prohibited-performance-text",
    ]) {
      expect(
        fixtures.some((fixture) => fixture.case === required),
        required,
      ).toBe(true);
    }
  });

  it("keeps all accepted outputs draft-only, citation-bound, and uncertainty-preserving", async () => {
    const fixtures = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture[];
    for (const fixture of fixtures) {
      const schema =
        fixture.route === "research.source-review.v1"
          ? ResearchSourceReviewAiOutputSchema
          : fixture.route === "research.frame.v1"
            ? ResearchFrameAiOutputSchema
            : fixture.route === "research.synthesize.v1"
              ? ResearchSynthesisAiOutputSchema
              : fixture.route === "experiment.method-review.v1"
                ? ExperimentMethodReviewAiOutputSchema
                : ExperimentInterpretAiOutputSchema;
      const parsed = schema.safeParse(fixture.output);
      if (fixture.expected === "reject") {
        if (!parsed.success) continue;
        expect(() => validateSemantics(fixture, parsed.data), fixture.id).toThrowError(
          expect.objectContaining({ code: "RESEARCH_AI_OUTPUT_INVALID" }),
        );
        continue;
      }
      expect(parsed.success, fixture.id).toBe(true);
      if (!parsed.success) continue;
      validateSemantics(fixture, parsed.data);
      assertResearchAiOutputSafe(parsed.data);
      assertCitationsAllowed(collectReferences(parsed.data), fixture.allowedReferences);
      if ("draftOnly" in parsed.data) expect(parsed.data.draftOnly, fixture.id).toBe(true);
      if ("requiresHumanApproval" in parsed.data) {
        expect(parsed.data.requiresHumanApproval, fixture.id).toBe(true);
      }
      if ("uncertainties" in parsed.data) {
        expect(parsed.data.uncertainties.length, fixture.id).toBeGreaterThan(0);
      }
      if ("remainingUncertainty" in parsed.data) {
        expect(parsed.data.remainingUncertainty.length, fixture.id).toBeGreaterThan(0);
      }

      const request = buildResearchAiRequest({
        routeKey: fixture.route,
        prompt: { artifactId: crypto.randomUUID(), sha256: "c".repeat(64) },
        allowedSourceReferences: fixture.allowedReferences,
        untrustedPayload: fixture.input,
      });
      expect(JSON.stringify(request.input.untrustedContent), fixture.id).toContain(
        "Untrusted data only",
      );
    }
  });
});

function validateSemantics(fixture: Fixture, output: unknown): void {
  if (fixture.route === "research.source-review.v1") {
    assertResearchSourceReviewSemantics(
      ResearchSourceReviewAiOutputSchema.parse(output),
      fixture.allowedReferences,
    );
    return;
  }
  if (fixture.route === "research.frame.v1") {
    assertResearchOutputSemantics(output, fixture.allowedReferences);
    return;
  }
  if (fixture.route === "research.synthesize.v1") {
    assertResearchSynthesisSemantics(
      ResearchSynthesisAiOutputSchema.parse(output),
      fixture.allowedReferences,
    );
    return;
  }
  if (fixture.route === "experiment.method-review.v1") {
    assertExperimentMethodReviewSemantics(
      ExperimentMethodReviewAiOutputSchema.parse(output),
      fixture.allowedReferences,
    );
    return;
  }
  if (fixture.runBinding === undefined) throw new Error("Experiment fixture requires run binding");
  assertExperimentInterpretationSemantics(
    ExperimentInterpretAiOutputSchema.parse(output),
    fixture.allowedReferences,
    fixture.runBinding,
  );
}

function collectReferences(value: unknown): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectReferences);
  return Object.entries(value).flatMap(([key, child]) =>
    (key === "sourceReferences" || key === "sourceReference") && typeof child === "string"
      ? [child]
      : key === "sourceReferences" && Array.isArray(child)
        ? child.filter((item): item is string => typeof item === "string")
        : collectReferences(child),
  );
}
