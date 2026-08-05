import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComponentsStep } from "./components-step.js";
import { ReviewStep } from "./review-step.js";
import { RulesStep } from "./rules-step.js";
import { SourceStep } from "./source-step.js";

const draft = {
  requestId: "22222222-2222-4222-8222-222222222222",
  state: "ready" as const,
  revision: 1,
  origin: "ai" as const,
  source: { label: "Approved Project document", version: 3 },
  draft: {
    components: [
      {
        position: 1,
        kind: "operational_kpi" as const,
        name: "Accepted quality scenarios",
        description: "Accepted scenarios from the approved plan.",
        weight: 100,
        baseline: null,
        target: 12,
        unit: null,
        direction: null,
        acceptanceConditions: ["Product Owner accepts the result"],
        requiredEvidence: ["Acceptance record"],
        confirmationMode: "human_confirmed" as const,
        sourceLabels: ["Approved Project document · version 3"],
        automationHints: [],
      },
    ],
    ambiguities: [],
    clarificationQuestions: [],
  },
  contract: null,
};

describe("guided Progress Contract setup", () => {
  it("shows four simple stages without exposing internal identifiers", async () => {
    const catalog = await getCatalog("en");
    const source = renderToStaticMarkup(
      createElement(SourceStep, {
        catalog,
        locale: "en",
        sourceVersion: 3,
        busy: false,
        onContinue: () => undefined,
      }),
    );
    const components = renderToStaticMarkup(
      createElement(ComponentsStep, {
        catalog,
        locale: "en",
        content: draft.draft,
        onBack: () => undefined,
        onContinue: () => undefined,
      }),
    );
    const rules = renderToStaticMarkup(
      createElement(RulesStep, {
        catalog,
        locale: "en",
        content: draft.draft,
        busy: false,
        onBack: () => undefined,
        onSave: () => undefined,
      }),
    );
    const review = renderToStaticMarkup(
      createElement(ReviewStep, {
        catalog,
        locale: "en",
        contract: null,
        draft,
        busy: false,
        onApply: () => undefined,
        onBack: () => undefined,
        onDecision: () => undefined,
      }),
    );

    expect(source).toContain(catalog["progressSetup.step.source"]);
    expect(source).toContain(catalog["progressSetup.notPerformance"]);
    expect(components).toContain(catalog["progressSetup.step.components"]);
    expect(components).toContain("Accepted quality scenarios");
    expect(rules).toContain(catalog["progressSetup.missingFields"]);
    expect(rules).toContain(catalog["progressContract.baseline"]);
    expect(rules).toContain(catalog["progressContract.unit"]);
    expect(rules).toContain(catalog["progressContract.direction"]);
    expect(review).toContain(catalog["progressSetup.step.review"]);
    expect(review).toContain(catalog["progressContract.applyAsDraft"]);
    expect(`${source}${components}${rules}${review}`).not.toContain(draft.requestId);
  });

  it("preserves Arabic RTL and mixed technical units", async () => {
    const catalog = await getCatalog("ar");
    const markup = renderToStaticMarkup(
      createElement(RulesStep, {
        catalog,
        locale: "ar",
        content: {
          ...draft.draft,
          components: [{ ...draft.draft.components[0]!, unit: "API requests/sec" }],
        },
        busy: false,
        onBack: () => undefined,
        onSave: () => undefined,
      }),
    );
    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain("API requests/sec");
    expect(markup).toContain(catalog["progressSetup.notPerformance"]);
  });
});
