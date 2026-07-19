import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UpdateResultCard } from "./update-result-card.js";

describe("UpdateResultCard", () => {
  it("renders a readable confirmed result without technical identifiers or ratings", async () => {
    const catalog = await getCatalog("en");
    const internalId = "11111111-1111-4111-8111-111111111111";
    const markup = renderToStaticMarkup(
      createElement(UpdateResultCard, {
        catalog,
        locale: "en",
        result: {
          acceptedEventId: internalId,
          project: { id: crypto.randomUUID(), name: "Atlas Delivery" },
          workstream: { id: crypto.randomUUID(), name: "API readiness" },
          workItem: null,
          summary: "Acceptance path completed",
          result: "All 12 approved scenarios passed",
          sourceReferences: ["update-source:22222222-2222-4222-8222-222222222222"],
          comparison: {
            previousAcceptedEventId: null,
            explanation: "This is the first confirmed update.",
          },
          blocker: null,
          nextAction: "Attach the client acceptance record",
          documentationNeeds: ["Client acceptance record"],
          progressImpact: {
            state: "insufficient_information",
            missing: ["Client acceptance record"],
          },
          confirmedAt: "2026-07-19T08:00:00.000Z",
        },
      }),
    );

    expect(markup).toContain("Atlas Delivery");
    expect(markup).toContain("All 12 approved scenarios passed");
    expect(markup).toContain("Client acceptance record");
    expect(markup).not.toContain(internalId);
    expect(markup).not.toContain("rating");
    expect(markup).not.toContain("productivity");
  });
});
