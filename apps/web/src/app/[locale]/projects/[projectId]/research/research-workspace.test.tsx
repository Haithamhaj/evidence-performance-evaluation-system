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
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Benchmark p95 latency");
    expect(markup).toContain("Failed — retained for learning");
    expect(markup).toContain("Human conclusion");
    expect(markup).toContain("Evidence linked after confirmation");
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
});

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
      title: "Benchmark p95 latency",
      state: "CONCLUDED" as const,
      methodSummary: "Compare the same 50 requests with fixed inputs.",
      result: "p95 improved to 310 ms",
      resultStatus: "COMPLETED" as const,
      humanConclusion: "Useful under the tested conditions.",
      evidenceLinked: true,
    },
    {
      title: "Failure recovery check",
      state: "RESULT_RECORDED" as const,
      methodSummary: "Interrupt one dependency and preserve the observation.",
      result: "Dependency timeout prevented a valid comparison.",
      resultStatus: "FAILED" as const,
      humanConclusion: null,
      evidenceLinked: false,
    },
  ];
}
