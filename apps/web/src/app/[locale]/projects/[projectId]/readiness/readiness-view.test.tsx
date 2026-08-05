import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReadinessView } from "./readiness-view.js";

describe("ReadinessView", () => {
  it("shows corrective gaps without scoring, quotas, or employee comparison", async () => {
    const markup = renderToStaticMarkup(
      createElement(ReadinessView, {
        catalog: await getCatalog("en"),
        locale: "en",
        view: {
          project: { id: crypto.randomUUID(), name: "Customer workspace" },
          month: "2026-08",
          state: "attention",
          messageKey: "readiness.recordMayBeInsufficient",
          gaps: [
            {
              kind: "silent_active_scope",
              scopeId: crypto.randomUUID(),
              scopeKind: "workstream",
              scopeName: "Daily operations",
              correctiveAction: "add_substantive_update",
            },
          ],
        },
      }),
    );

    expect(markup).toContain("Daily operations");
    expect(markup).toContain("The current record may not be sufficient");
    expect(markup).not.toMatch(/\d+%|productivity|ranking|leaderboard/iu);
  });
});
