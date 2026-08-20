import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ResearchWorkspaceView } from "./research-workspace.js";

describe("ResearchWorkspaceView", () => {
  it("renders the compact English link-to-decision journey without technical or scoring details", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(ResearchWorkspaceView, {
        catalog,
        locale: "en",
        project: { name: "Atlas Delivery" },
        researchRecords: [researchFixture()],
        review: reviewFixture(),
        experiments: experimentFixtures(),
      }),
    );

    expect(markup).toContain('dir="ltr"');
    expect(markup).toContain("What should the assistant investigate?");
    expect(markup).toContain("Why it may help");
    expect(markup).toContain("Mismatch");
    expect(markup).toContain("Risks");
    expect(markup).toContain("Uncertainty");
    expect(markup).toContain("Next actions");
    expect(markup).toContain("Edit proposals");
    expect(markup).toContain("Research question");
    expect(markup).toContain("Should Atlas adopt retrieval for grounded answers?");
    expect(markup).toContain("Assumptions");
    expect(markup).toContain("The approved Project document remains the source of truth.");
    expect(markup).toContain("Constraints");
    expect(markup).toContain("No provider-specific calls outside the AI Router.");
    expect(markup).toContain("Why this matters to the Project");
    expect(markup).toContain("Source review");
    expect(markup).toContain("Licensing and privacy");
    expect(markup).toContain("Synthesis");
    expect(markup).toContain("Confidence boundaries");
    expect(markup).toContain("Unanswered questions");
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Benchmark p95 latency");
    expect(markup).toContain("Hypothesis");
    expect(markup).toContain("Baseline");
    expect(markup).toContain("Measures");
    expect(markup).toContain("Test cases");
    expect(markup).toContain("Controls");
    expect(markup).toContain("Pinned versions and conditions");
    expect(markup).toContain("Reproducibility");
    expect(markup).toContain("Failed — retained for learning");
    expect(markup).toContain("Human conclusion");
    expect(markup).toContain("Employee decision");
    expect(markup).toContain("Adopt retrieval only for the tested flow.");
    expect(markup).toContain("Applied learning");
    expect(markup).toContain("The next experiment now uses the bounded retrieval path.");
    expect(markup).toContain("Confirmed by the employee");
    expect(markup).toContain("Research assistant");
    expect(markup).toContain("Suggested next step");
    expect(markup).toContain("Meaningful research trail");
    expect(markup).toContain("Closure check");
    expect(markup).toContain('dir="ltr">GPT-5.5');
    expect(markup).not.toMatch(
      /routeTrace|schemaVersion|suggestedRating|productivityScore|readinessPercent/i,
    );
    expect(markup).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu,
    );
  });

  it("renders complete Arabic RTL copy at the mobile verification boundary", async () => {
    const catalog = await getCatalog("ar");
    const markup = renderToStaticMarkup(
      createElement(ResearchWorkspaceView, {
        catalog,
        locale: "ar",
        project: { name: "مشروع أطلس" },
        researchRecords: [researchFixture()],
        review: reviewFixture(),
        experiments: experimentFixtures(),
      }),
    );

    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain("ما الذي تريد من المساعد أن يبحثه؟");
    expect(markup).toContain("لماذا قد يفيد؟");
    expect(markup).toContain("تعديل المقترحات");
    expect(markup).toContain('dir="ltr">github.com/acme/atlas');
    expect(markup).toContain("researchWorkspaceMobileBoundary");
  });

  it("shows an explicit confirmed result and safe recovery without exposing an official Task", async () => {
    const catalog = await getCatalog("en");
    const confirmed = renderToStaticMarkup(
      createElement(ResearchWorkspaceView, {
        catalog,
        locale: "en",
        project: { name: "Atlas Delivery" },
        researchRecords: [],
        review: reviewFixture(),
        experiments: [],
        confirmationState: "confirmed",
      }),
    );
    const failed = renderToStaticMarkup(
      createElement(ResearchWorkspaceView, {
        catalog,
        locale: "en",
        project: { name: "Atlas Delivery" },
        researchRecords: [],
        review: reviewFixture(),
        experiments: [],
        confirmationState: "failed",
      }),
    );

    expect(confirmed).toContain("Proposals confirmed");
    expect(confirmed).toContain("No official Task was created");
    expect(confirmed).not.toContain('role="dialog"');
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Your draft is still here");
  });

  it("keeps the assistant-prepared decision editable until explicit employee confirmation", async () => {
    const catalog = await getCatalog("en");
    const draft = { ...researchFixture(), decision: null, appliedLearning: [] };
    const markup = renderToStaticMarkup(
      createElement(ResearchWorkspaceView, {
        catalog,
        locale: "en",
        project: { name: "Atlas Delivery" },
        researchRecords: [draft],
        review: reviewFixture(),
        experiments: experimentFixtures(),
      }),
    );

    expect(markup).toContain("Review and record decision");
    expect(markup).toContain("The assistant prepares the context");
    expect(markup).toContain("Confirm decision and applied learning");
    expect(markup).toContain("Nothing is recorded until you confirm");
  });
});

function researchFixture() {
  return {
    handle: `opaque-research-${"x".repeat(40)}`,
    state: "ACTIVE" as const,
    version: 2,
    question: "Should Atlas adopt retrieval for grounded answers?",
    objective: "Decide whether retrieval improves source-grounded answers for Atlas.",
    assumptions: ["The approved Project document remains the source of truth."],
    constraints: ["No provider-specific calls outside the AI Router."],
    knownUncertainty: ["Production retrieval latency is not measured yet."],
    decisionQuestion: "Adopt, refine, or reject retrieval for Atlas?",
    sources: [
      {
        title: "Atlas retrieval benchmark",
        url: "https://github.com/acme/atlas",
        relevance: "Provides a repeatable benchmark candidate.",
        credibility: "Repository source; conditions still require verification.",
      },
    ],
    decision: {
      synthesis: "The bounded comparison supports a narrow adoption.",
      answer: "Adopt retrieval only for the tested flow.",
      remainingUncertainty: ["Production scale remains unverified."],
      decision: "ADOPT" as const,
      rationale: "The employee reviewed the source and retained result.",
      nextAction: "Apply the finding to the next experiment.",
      confirmedAt: "2026-08-15T11:00:00Z",
    },
    appliedLearning: [
      {
        targetKind: "EXPERIMENT" as const,
        whatChanged: "The next experiment now uses the bounded retrieval path.",
        causalRationale: "The confirmed conclusion narrowed the test scope.",
        confirmedAt: "2026-08-15T11:05:00Z",
      },
    ],
  };
}

function reviewFixture() {
  return {
    handle: `opaque-source_review-${"x".repeat(40)}`,
    state: "READY_FOR_REVIEW" as const,
    version: 1,
    displayUrl: "https://github.com/acme/atlas",
    retrievalState: "RETRIEVED" as const,
    retrievalReason: null,
    output: {
      summary: "The repository contains a repeatable benchmark.",
      relevance: "It may answer the current delivery question.",
      citations: [{ label: "Source 1", locator: "README", url: "https://github.com/acme/atlas" }],
      benefits: ["Reusable benchmark"],
      risks: ["Different runtime"],
      mismatches: ["Different database"],
      uncertainties: ["Production load is unknown"],
      proposals: [
        {
          handle: `opaque-proposal-${"x".repeat(40)}`,
          kind: "EXPERIMENT" as const,
          title: "Benchmark p95 latency",
          rationale: "Measure before adoption.",
          question: "Does it reduce p95 latency?",
          baseline: "420 ms",
          measureNames: ["p95 latency"],
        },
      ],
    },
    recoveryOptions: [],
  };
}

function experimentFixtures() {
  return [
    {
      handle: `opaque-experiment-${"a".repeat(40)}`,
      title: "Benchmark p95 latency",
      state: "CONCLUDED" as const,
      version: 4,
      question: "Does retrieval reduce p95 latency under the fixed sample?",
      baseline: "420 ms",
      measures: ["p95 latency"],
      testCases: ["fixed-50-requests"],
      controls: ["same prompts and runtime"],
      versions: ["Node 24 / model snapshot v1"],
      reproducibility: "Compare the same 50 requests with fixed inputs.",
      result: "p95 improved to 310 ms",
      resultStatus: "COMPLETED" as const,
      humanConclusion: "Useful under the tested conditions.",
      limitations: ["One bounded fixture"],
    },
    {
      handle: `opaque-experiment-${"b".repeat(40)}`,
      title: "Failure recovery check",
      state: "RESULT_RECORDED" as const,
      version: 3,
      question: "Does recovery preserve the failed observation?",
      baseline: "No retained failure record",
      measures: ["retained outcome"],
      testCases: ["dependency-timeout"],
      controls: ["same dependency"],
      versions: ["recovery fixture v1"],
      reproducibility: "Interrupt one dependency and preserve the observation.",
      result: "Dependency timeout prevented a valid comparison.",
      resultStatus: "FAILED" as const,
      humanConclusion: null,
      limitations: [],
    },
  ];
}
