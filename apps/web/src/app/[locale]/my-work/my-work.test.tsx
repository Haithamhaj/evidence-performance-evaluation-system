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
  dueAt: "2026-07-20T18:00:00.000Z",
  requirements: [],
  acceptanceConditions: [],
  blocker: null,
  nextAction: "Open the runnable preview",
  version: 1,
  createdAt: "2026-07-20T08:00:00.000Z",
  updatedAt: "2026-07-20T09:00:00.000Z",
  checklist: [],
  collaboratorIds: [],
  allowedActions: ["edit" as const, "add_update" as const],
};

const snapshot: import("@evaluation/contracts").DailyWorkspaceSnapshot = {
  needsMyAction: [item],
  today: [],
  overdue: [],
  reviewQueue: [],
  inbox: [],
  projectPulse: [
    {
      id: item.projectId,
      name: "Atlas Delivery",
      status: "active",
      progress: { state: "awaiting_contract" },
    },
  ],
  upcoming: [],
};

describe("MyWorkClient", () => {
  it("renders value before input in the approved daily-home order", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(MyWorkClient, {
        catalog,
        initialSelectedId: null,
        locale: "en",
        response: snapshot,
        updateContext: {
          projects: [
            { id: item.projectId, name: "Atlas Delivery", workstreams: [], workItems: [] },
          ],
        },
      }),
    );

    expect(markup.indexOf("Review queue")).toBeLessThan(markup.indexOf("Needs my action"));
    expect(markup.indexOf("Needs my action")).toBeLessThan(markup.indexOf("Project pulse"));
    expect(markup.indexOf("Project pulse")).toBeLessThan(markup.indexOf("Quick capture"));
    expect(markup).toContain("Confirm pilot flow");
    expect(markup).toContain("Add update");
    expect(markup).toContain(`/en/projects/${item.projectId}/daily-work`);
    expect(markup).toContain(catalog["progress.notPerformance"]);
  });

  it("opens a focused Task review panel", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(MyWorkClient, {
        catalog,
        initialSelectedId: item.id,
        locale: "en",
        response: snapshot,
        updateContext: {
          projects: [
            {
              id: item.projectId,
              name: "Atlas Delivery",
              workstreams: [],
              workItems: [{ id: item.id, title: item.title, workstreamId: null }],
            },
          ],
        },
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Confirm pilot flow");
    expect(markup).toContain("Add update");
  });
});
