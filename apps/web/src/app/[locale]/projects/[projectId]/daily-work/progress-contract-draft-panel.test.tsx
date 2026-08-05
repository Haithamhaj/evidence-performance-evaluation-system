import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProgressContractDraftPanel } from "./progress-contract-draft-panel.js";

describe("ProgressContractDraftPanel", () => {
  it("links an authorized owner to the focused setup route", async () => {
    const catalog = await getCatalog("en");
    const projectId = crypto.randomUUID();
    const markup = renderToStaticMarkup(
      createElement(ProgressContractDraftPanel, {
        catalog,
        enabled: true,
        locale: "en",
        projectId,
      }),
    );
    expect(markup).toContain(`/${"en"}/projects/${projectId}/settings/progress-contract`);
    expect(markup).toContain(catalog["progressSetup.notPerformance"]);
    expect(markup).not.toContain('role="dialog"');
  });

  it("does not show setup when the authorized owner source is unavailable", async () => {
    const markup = renderToStaticMarkup(
      createElement(ProgressContractDraftPanel, {
        catalog: await getCatalog("ar"),
        enabled: false,
        locale: "ar",
        projectId: crypto.randomUUID(),
      }),
    );
    expect(markup).toBe("");
  });
});
