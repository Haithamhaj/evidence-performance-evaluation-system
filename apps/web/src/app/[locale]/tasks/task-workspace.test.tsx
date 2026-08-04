import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildOfficialTaskCreateBody, TasksClient } from "./tasks-client.js";

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
        draftOwnerId: crypto.randomUUID(),
        initialItems: [task],
        initialLayout: "list",
        initialView: "my",
        locale: "en",
        projects: [{ id: task.projectId, name: "Atlas Delivery" }],
      }),
    );

    expect(markup).toContain(">List<");
    expect(markup).toContain(">Board<");
    expect(markup).toContain(">Calendar<");
    expect(markup).toContain("Prepare the launch");
  });

  it("opens an editable side panel for an authorized Task", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(TasksClient, {
        catalog,
        draftOwnerId: crypto.randomUUID(),
        initialItems: [task],
        initialLayout: "list",
        initialSelectedId: task.id,
        initialView: "my",
        locale: "en",
        projects: [{ id: task.projectId, name: "Atlas Delivery" }],
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('value="Prepare the launch"');
    expect(markup).toContain(">Save changes<");
  });

  it("requires a Project for official Task creation", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(TasksClient, {
        catalog,
        draftOwnerId: crypto.randomUUID(),
        initialItems: [],
        initialLayout: "list",
        initialView: "my",
        locale: "en",
        projects: [],
      }),
    );

    expect(markup).toContain("Project is required");
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Create task<\/button>/u);
  });

  it("exposes My Tasks and Team Tasks as two authorized workspace scopes", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(TasksClient, {
        catalog,
        draftOwnerId: crypto.randomUUID(),
        initialItems: [task],
        initialLayout: "list",
        initialView: "team",
        locale: "en",
        projects: [{ id: task.projectId, name: "Atlas Delivery" }],
      }),
    );

    expect(markup).toContain(">My tasks<");
    expect(markup).toContain(">Team tasks<");
    expect(markup).toMatch(/aria-current="page"[^>]*>Team tasks</u);
  });

  it("assigns a directly created official Task to its authenticated creator", () => {
    const employeeId = crypto.randomUUID();
    const projectId = crypto.randomUUID();

    expect(
      buildOfficialTaskCreateBody({
        employeeId,
        projectId,
        title: "Prepare the launch",
      }),
    ).toMatchObject({
      assigneeId: employeeId,
      projectId,
      title: "Prepare the launch",
    });
  });
});
