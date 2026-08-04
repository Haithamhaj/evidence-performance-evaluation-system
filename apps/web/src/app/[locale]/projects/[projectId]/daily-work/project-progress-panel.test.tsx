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
  pulse: {
    officialProgress: 62.5,
    previousOfficialProgress: 50,
    sourceCoverage: "SUFFICIENT",
    milestoneStates: [
      {
        componentId: crypto.randomUUID(),
        name: "Accepted scenarios",
        kind: "kpi",
        percent: 62.5,
        state: "in_progress",
      },
    ],
    nextRequiredEvidence: [
      {
        componentId: crypto.randomUUID(),
        componentName: "Owner acceptance",
        label: "Acceptance record",
      },
    ],
    explanation: [
      {
        kind: "increase",
        delta: 12.5,
        text: "Five of eight measurable outcomes are accepted.",
        snapshotId: crypto.randomUUID(),
        observedAt: "2026-07-18T12:00:00.000Z",
      },
    ],
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
    expect(markup).toContain("What changed");
    expect(markup).toContain("Evidence needed");
    expect(markup).toContain("Next milestone");
    expect(markup.indexOf("What changed")).toBeLessThan(markup.indexOf("<progress"));
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

  it("retains the official value and explains incomplete source coverage", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(ProjectProgressPanel, {
        catalog,
        locale: "en",
        view: {
          ...base,
          progress: {
            state: "accepted",
            snapshotId: crypto.randomUUID(),
            percent: 62.5,
            reason: "The last source-supported value remains official.",
            updatedAt: "2026-07-18T12:00:00.000Z",
          },
          pulse: { ...base.pulse, sourceCoverage: "INSUFFICIENT" },
        },
      }),
    );
    expect(markup).toContain("62.5%");
    expect(markup).toContain(catalog["projectPulse.coverage.insufficient"]);
    expect(markup).toContain(catalog["projectPulse.retainedOfficial"]);
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
