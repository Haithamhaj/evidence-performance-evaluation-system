import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MyWorkClient } from "./my-work-client.js";

const item = {
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  workstreamId: null,
  title: "Confirm pilot flow",
  description: "Review the employee journey.",
  status: "ready" as const,
  priority: "high" as const,
  assigneeId: crypto.randomUUID(),
  dueAt: "2026-07-18T18:00:00.000Z",
  requirements: ["Run the product flow"],
  acceptanceConditions: ["Owner confirms the flow"],
  blocker: null,
  nextAction: "Open the runnable preview",
  version: 1,
  createdAt: "2026-07-18T08:00:00.000Z",
  updatedAt: "2026-07-18T09:00:00.000Z",
  allowedActions: ["transition" as const, "add_update" as const],
};

describe("MyWorkClient", () => {
  it("renders the three action groups first and progressively discloses the rest", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(MyWorkClient, {
        catalog,
        initialSelectedId: null,
        locale: "en",
        response: {
          groups: [
            { key: "needs_my_action", items: [item], collapsedByDefault: false },
            { key: "today", items: [], collapsedByDefault: false },
            { key: "overdue", items: [], collapsedByDefault: false },
            { key: "this_week", items: [], collapsedByDefault: true },
          ],
          nextCursor: null,
        },
      }),
    );
    expect(markup.indexOf("Needs my action")).toBeLessThan(markup.indexOf("Today"));
    expect(markup.indexOf("Today")).toBeLessThan(markup.indexOf("Overdue"));
    expect(markup).toContain("<details");
    expect(markup).toContain("Confirm pilot flow");
  });

  it("opens a visible review drawer for the selected Work Item", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(MyWorkClient, {
        catalog,
        initialSelectedId: item.id,
        locale: "en",
        response: {
          groups: [
            { key: "needs_my_action", items: [item], collapsedByDefault: false },
            { key: "today", items: [], collapsedByDefault: false },
            { key: "overdue", items: [], collapsedByDefault: false },
          ],
          nextCursor: null,
        },
      }),
    );
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Acceptance conditions");
  });
});
