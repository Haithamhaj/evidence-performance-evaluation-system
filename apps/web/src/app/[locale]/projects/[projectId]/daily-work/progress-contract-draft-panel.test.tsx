import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  hasUnsavedDraftChanges,
  ProgressContractDraftPanel,
} from "./progress-contract-draft-panel.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

const initialDraft = {
  requestId,
  state: "ready" as const,
  revision: 1,
  origin: "ai" as const,
  source: { label: "Approved Project document", version: 3 },
  draft: {
    components: [
      {
        position: 1,
        kind: "operational_kpi" as const,
        name: "Required quality gate",
        description: "Run pnpm test and confirm the approved scenarios.",
        weight: 100,
        baseline: 0,
        target: 12,
        unit: "scenarios",
        direction: "increase" as const,
        acceptanceConditions: ["The Product Owner accepts the quality gate"],
        requiredEvidence: ["CI test summary"],
        confirmationMode: "human_confirmed" as const,
        sourceLabels: ["Approved Project document · version 3"],
        automationHints: [],
      },
    ],
    ambiguities: ["The approved document does not define the retry threshold."],
    clarificationQuestions: ["Which retry threshold is approved?"],
  },
  contract: null,
};

describe("ProgressContractDraftPanel", () => {
  it("labels the proposal as an AI draft and requires the separate human activation journey", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(ProgressContractDraftPanel, {
        catalog,
        initialDraft,
        initialOpen: true,
        locale: "en",
        projectId,
        sourceRequest: null,
      }),
    );

    expect(markup).toContain(catalog["progressContract.aiDraftLabel"]);
    expect(markup).toContain(catalog["progressContract.applyAsDraft"]);
    expect(markup).toContain(catalog["progressContract.saveBeforeApply"]);
    expect(markup).toMatch(
      new RegExp(
        `<button[^>]*disabled[^>]*>${catalog["progressContract.applyAsDraft"]}</button>`,
        "u",
      ),
    );
    expect(markup).toContain(catalog["progressContract.activationRequired"]);
    expect(markup).not.toContain(catalog["progressContract.active"]);
    expect(markup).not.toMatch(/rating|productivity|overall progress override/iu);
  });

  it("detects unsaved editable content before applying a human revision", () => {
    const form = new FormData();
    form.set("component.1.kind", "operational_kpi");
    form.set("component.1.name", "Changed quality gate");
    form.set("component.1.description", "Run pnpm test and confirm the approved scenarios.");
    form.set("component.1.weight", "100");
    form.set("component.1.baseline", "0");
    form.set("component.1.target", "12");
    form.set("component.1.unit", "scenarios");
    form.set("component.1.direction", "increase");
    form.set(
      "component.1.acceptanceConditions",
      "The Product Owner accepts the quality gate",
    );
    form.set("component.1.requiredEvidence", "CI test summary");
    form.set("component.1.confirmationMode", "human_confirmed");
    form.set("ambiguities", "The approved document does not define the retry threshold.");
    form.set("clarificationQuestions", "Which retry threshold is approved?");

    expect(hasUnsavedDraftChanges(form, initialDraft.draft)).toBe(true);
  });

  it("shows every review field with the approved source version in an accessible drawer", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(ProgressContractDraftPanel, {
        catalog,
        initialDraft,
        initialOpen: true,
        locale: "en",
        projectId,
        sourceRequest: null,
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Approved Project document");
    expect(markup).toContain("version 3");
    expect(markup).toContain("Required quality gate");
    expect(markup).toContain("Run pnpm test");
    expect(markup).toContain("12");
    expect(markup).toContain("scenarios");
    expect(markup).toContain("The Product Owner accepts the quality gate");
    expect(markup).toContain("CI test summary");
    expect(markup).toContain(catalog["progressContract.confirmation.human_confirmed"]);
    expect(markup).toContain("Which retry threshold is approved?");
    expect(markup).toMatch(/<textarea[^>]*name="reason"[^>]*required/iu);
  });

  it("keeps Arabic RTL foundations and mixed technical text intact", async () => {
    const catalog = await getCatalog("ar");
    const markup = renderToStaticMarkup(
      createElement(ProgressContractDraftPanel, {
        catalog,
        initialDraft: {
          ...initialDraft,
          draft: {
            ...initialDraft.draft,
            components: [
              {
                ...initialDraft.draft.components[0]!,
                description: "شغّل pnpm test ثم راجع PR #142 قبل القبول.",
              },
            ],
          },
        },
        initialOpen: true,
        locale: "ar",
        projectId,
        sourceRequest: null,
      }),
    );

    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain("pnpm test");
    expect(markup).toContain("PR #142");
    expect(markup).toContain(catalog["progressContract.aiDraftLabel"]);
  });

  it("defaults to stage gate when any proposed component has no approved weight", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(ProgressContractDraftPanel, {
        catalog,
        initialDraft: {
          ...initialDraft,
          draft: {
            ...initialDraft.draft,
            components: [{ ...initialDraft.draft.components[0]!, weight: null }],
          },
        },
        initialOpen: true,
        locale: "en",
        projectId,
        sourceRequest: null,
      }),
    );

    expect(markup).toMatch(
      /<select[^>]*name="calculationKind"[^>]*>.*<option value="stage_gate" selected/isu,
    );
  });
});
