import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TasksClient } from "./tasks-client.js";

const task = {
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  workstreamId: null,
  title: "Prepare the launch",
  description: "",
  status: "planned" as const,
  priority: "normal" as const,
  assigneeId: null,
  dueAt: null,
  requirements: [],
  acceptanceConditions: [],
  blocker: null,
  nextAction: null,
  version: 1,
  createdAt: "2026-07-20T08:00:00.000Z",
  updatedAt: "2026-07-20T08:00:00.000Z",
  checklist: [],
  collaboratorIds: [],
  allowedActions: ["edit" as const],
};

describe("TasksClient", () => {
  it("offers List, Board, and Calendar without changing Task identity", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(TasksClient, {
        catalog,
        initialItems: [task],
        initialLayout: "list",
        locale: "en",
        projects: [{ id: task.projectId, name: "Atlas Delivery" }],
      }),
    );

    expect(markup).toContain(">List<");
    expect(markup).toContain(">Board<");
    expect(markup).toContain(">Calendar<");
    expect(markup).toContain("Prepare the launch");
  });

  it("requires a Project for official Task creation", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(TasksClient, {
        catalog,
        initialItems: [],
        initialLayout: "list",
        locale: "en",
        projects: [],
      }),
    );

    expect(markup).toContain("Project is required");
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Create task<\/button>/u);
  });
});
