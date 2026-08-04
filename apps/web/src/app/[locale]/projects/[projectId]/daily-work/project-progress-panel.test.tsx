import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProjectProgressPanel } from "./project-progress-panel.js";

const base: import("./project-progress-panel.js").ProjectProgressView = {
  project: {
    id: crypto.randomUUID(),
    name: "Evaluation Pilot",
    description: "Deliver the approved employee journey.",
    status: "active",
  },
  contract: {
    id: crypto.randomUUID(),
    contractVersion: 1,
    version: 3,
    state: "active",
    calculationKind: "weighted",
    effectiveAt: "2026-07-18T12:00:00.000Z",
    components: [
      {
        id: crypto.randomUUID(),
        kind: "kpi",
        name: "Accepted scenarios",
        description: "Product-owner accepted scenarios.",
        weight: 100,
        baseline: 0,
        target: 12,
        unit: "scenarios",
        direction: "increase",
        requiredEvidence: ["Acceptance record"],
      },
    ],
  },
  progress: {
    state: "accepted",
    snapshotId: crypto.randomUUID(),
    percent: 62.5,
    reason: "Five of eight measurable outcomes are accepted.",
    updatedAt: "2026-07-18T12:00:00.000Z",
  },
};

describe("ProjectProgressPanel", () => {
  it("labels operational progress and keeps it separate from employee performance", async () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectProgressPanel, {
        catalog: await getCatalog("en"),
        locale: "en",
        view: base,
      }),
    );
    expect(markup).toContain("62.5%");
    expect(markup).toContain("not employee performance");
    expect(markup).toContain("Accepted scenarios");
    expect(markup).not.toContain("rating");
  });

  it("does not display a provisional percentage when information is missing", async () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectProgressPanel, {
        catalog: await getCatalog("en"),
        locale: "en",
        view: { ...base, progress: { state: "awaiting_information" } },
      }),
    );
    expect(markup).toContain("Waiting for information");
    expect(markup).not.toContain("62.5%");
    expect(markup).not.toContain("<progress");
  });

  it("integrates the AI proposal review into the existing Project progress screen", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(ProjectProgressPanel, {
        catalog,
        locale: "en",
        view: {
          ...base,
          contractDraftSourceRequest: {
            documentVersionId: crypto.randomUUID(),
            sourceChecksum: "a".repeat(64),
            sourceVersion: 3,
          },
        },
      }),
    );
    expect(markup).toContain(catalog["progressSetup.open"]);
    expect(markup).toContain(catalog["progressSetup.notPerformance"]);
  });
});
