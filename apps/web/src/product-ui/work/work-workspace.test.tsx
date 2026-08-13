/* eslint-disable no-unused-vars */
// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { getCatalogSync } from "@evaluation/localization";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkItemGatewayError } from "../../platform/work-items-api.js";
import { WorkWorkspace, type WorkWorkspaceGateway } from "./work-workspace.js";

const employeeId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";
const item = workItem();

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/en/tasks?view=my&layout=list");
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
});
afterEach(() => cleanup());

describe("WorkWorkspace", () => {
  it("shows Needs my action, Today, and Overdue before collapsed secondary groups", () => {
    renderWork(service(), null, "en", [item], {
      ...snapshot(),
      needsMyAction: [item],
    });
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map(({ textContent }) => textContent);
    expect(headings).toEqual([
      expect.stringContaining("Needs my action"),
      expect.stringContaining("Today"),
      expect.stringContaining("Overdue"),
      expect.stringContaining("Waiting or blocked"),
      expect.stringContaining("Upcoming"),
    ]);
    expect(screen.getAllByText(item.title)).toHaveLength(1);
    expect(screen.queryAllByText("Show tasks")).toHaveLength(0);
  });

  it("keeps compact List, Board, and Calendar destinations and opens detail from URL", async () => {
    const user = userEvent.setup();
    const gateway = service();
    renderWork(gateway);

    expect(screen.getByRole("link", { name: "Board" })).toHaveAttribute(
      "href",
      "/en/tasks?view=my&layout=board",
    );
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "href",
      "/en/tasks?view=my&layout=calendar",
    );

    const row = screen.getByRole("button", { name: /Prepare the launch/u });
    await user.click(row);
    expect(window.location.search).toContain(`item=${itemId}`);
    expect(await screen.findByRole("dialog", { name: "Task details" })).toBeInTheDocument();
    expect(gateway.load).toHaveBeenCalledWith(itemId);
    expect(gateway.loadContext).toHaveBeenCalledWith({ itemId, projectId });
    expect(gateway.loadDependencies).toHaveBeenCalledWith(itemId);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(window.location.search).not.toContain("item=");
    expect(row).toHaveFocus();
  });

  it("shows dependency readiness and uses the protected replacement command", async () => {
    const prerequisite = {
      ...item,
      id: "44444444-4444-4444-8444-444444444444",
      title: "Finish the source contract",
      status: "in_progress" as const,
    };
    const gateway = service({
      loadDependencies: vi.fn().mockResolvedValue({
        workItemId: item.id,
        version: 1,
        readiness: "blocked_by_dependency",
        allowedTransitions: ["blocked", "cancelled"],
        dependsOn: [
          { id: prerequisite.id, title: prerequisite.title, status: prerequisite.status },
        ],
        blocks: [],
      }),
      replaceDependencies: vi.fn().mockResolvedValue({
        workItemId: item.id,
        version: 2,
        readiness: "ready",
        allowedTransitions: ["in_progress", "blocked", "cancelled"],
        dependsOn: [],
        blocks: [],
      }),
    });
    const user = userEvent.setup();
    renderWork(gateway, item.id, "en", [item, prerequisite]);

    expect(await screen.findByText("Blocked by an unfinished Task.")).toBeVisible();
    expect(screen.getAllByText(prerequisite.title).length).toBeGreaterThan(0);
    expect(screen.queryByRole("option", { name: "In progress" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit dependencies" }));
    await user.click(screen.getByRole("checkbox", { name: prerequisite.title }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(gateway.replaceDependencies).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({ dependsOnWorkItemIds: [] }),
    );
    expect(await screen.findByText(/no unresolved dependency/u)).toBeVisible();
  });

  it("shows linked updates and suggested GitHub evidence as context, not progress or scoring", async () => {
    const gateway = service({
      loadContext: vi.fn().mockResolvedValue({
        updates: [
          {
            id: crypto.randomUUID(),
            kind: "update",
            title: "Work query implemented",
            detail: "Codex completed the bounded query bundle.",
            occurredAt: "2026-08-13T09:15:00.000Z",
            sourceProvenance: "employee_code",
            reviewState: "employee_confirmed",
          },
        ],
        evidence: [
          {
            id: crypto.randomUUID(),
            kind: "evidence",
            title: "Commit e4fefae",
            detail: "Filtered results use the authoritative response.",
            occurredAt: "2026-08-13T09:20:00.000Z",
            sourceProvenance: "github_automated",
            reviewState: "automated_project_fact",
          },
        ],
      }),
    });
    renderWork(gateway, itemId);

    expect(await screen.findByRole("heading", { name: "Activity and evidence" })).toBeVisible();
    expect(screen.getByText("Work query implemented")).toBeVisible();
    expect(screen.getByText("Commit e4fefae")).toBeVisible();
    expect(
      screen.getByText("GitHub suggested evidence · employee confirmation required"),
    ).toBeVisible();
    expect(screen.getByText(/does not score Codex or change Project progress/u)).toBeVisible();
    expect(screen.queryByText(/performance score/iu)).not.toBeInTheDocument();
  });

  it("creates through the existing protected command and opens the authoritative item", async () => {
    const user = userEvent.setup();
    const created = { ...item, id: crypto.randomUUID(), title: "Ship the release" };
    const gateway = service({ create: vi.fn().mockResolvedValue(created) });
    renderWork(gateway);

    await user.type(screen.getByLabelText("Task title"), created.title);
    expect(await screen.findByText(/Private draft saved on this device/u)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(gateway.create).toHaveBeenCalledOnce());
    expect(await screen.findByText(created.title)).toBeInTheDocument();
    expect(window.location.search).toContain(`item=${created.id}`);
    expect(window.localStorage.getItem(`command-brief.quick-task.v1:${employeeId}`)).toBeNull();
  });

  it("restores the employee-owned Quick Task draft without creating activity or progress", async () => {
    window.localStorage.setItem(
      `command-brief.quick-task.v1:${employeeId}`,
      JSON.stringify({ projectId, title: "Continue the Codex Work bundle", version: 1 }),
    );
    const gateway = service();
    renderWork(gateway);

    expect(await screen.findByDisplayValue("Continue the Codex Work bundle")).toBeVisible();
    expect(screen.getByLabelText("Project is required")).toHaveValue(projectId);
    expect(gateway.create).not.toHaveBeenCalled();
    expect(screen.queryByText(/evidence created|progress changed/iu)).not.toBeInTheDocument();
  });

  it("transitions through the existing protected command and recovers stale detail", async () => {
    const user = userEvent.setup();
    const transitioned = { ...item, status: "in_progress" as const, version: 2 };
    const gateway = service({
      transition: vi
        .fn()
        .mockRejectedValueOnce(new WorkItemGatewayError(409))
        .mockResolvedValueOnce(transitioned),
    });
    renderWork(gateway, itemId);

    await screen.findByRole("dialog", { name: "Task details" });
    await user.selectOptions(screen.getByLabelText("New status"), "in_progress");
    await user.click(screen.getByRole("button", { name: "Change status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(gateway.load).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Change status" }));
    expect((await screen.findAllByText("In progress")).length).toBeGreaterThan(0);
  });

  it("offers only authoritative planned transitions and applies a valid transition", async () => {
    const planned = {
      ...item,
      status: "planned" as const,
      allowedTransitions: ["ready", "cancelled"] as ("ready" | "cancelled")[],
    };
    const transitioned = {
      ...planned,
      status: "ready" as const,
      version: 2,
      allowedTransitions: ["in_progress", "blocked", "cancelled"] as (
        "in_progress" | "blocked" | "cancelled"
      )[],
    };
    const gateway = service({
      load: vi.fn().mockResolvedValue(planned),
      loadDependencies: vi.fn().mockResolvedValue({
        workItemId: planned.id,
        version: planned.version,
        readiness: "ready",
        allowedTransitions: planned.allowedTransitions,
        dependsOn: [],
        blocks: [],
      }),
      transition: vi.fn().mockResolvedValue(transitioned),
    });
    const user = userEvent.setup();
    renderWork(gateway, planned.id, "en", [planned]);

    await screen.findByRole("dialog", { name: "Task details" });
    expect(
      within(screen.getByLabelText("New status"))
        .getAllByRole("option")
        .map(({ textContent }) => textContent),
    ).toEqual(["Ready", "Cancelled"]);
    expect(screen.queryByRole("option", { name: "In progress" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("New status"), "ready");
    await user.click(screen.getByRole("button", { name: "Change status" }));

    expect(gateway.transition).toHaveBeenCalledWith(
      planned.id,
      expect.objectContaining({ expectedVersion: 1, status: "ready" }),
    );
    expect((await screen.findAllByText("Ready")).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("New status")).toHaveValue("in_progress");
  });

  it("shows the server authorization denial instead of widening transition authority", async () => {
    const user = userEvent.setup();
    const gateway = service({
      transition: vi.fn().mockRejectedValue(new WorkItemGatewayError(403)),
    });
    renderWork(gateway, itemId);

    await screen.findByRole("dialog", { name: "Task details" });
    await user.click(screen.getByRole("button", { name: "Change status" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("no longer have access");
  });

  it("keeps the newest URL-selected task when an older detail request resolves late", async () => {
    const stale = deferred<ReturnType<typeof workItem>>();
    const second = {
      ...item,
      id: "44444444-4444-4444-8444-444444444444",
      title: "Confirm customer handoff",
    };
    const gateway = service({
      load: vi
        .fn()
        .mockImplementation((id: string) =>
          id === item.id ? stale.promise : Promise.resolve(second),
        ),
    });
    const user = userEvent.setup();
    renderWork(gateway, item.id, "en", [item, second]);
    await waitFor(() => expect(gateway.load).toHaveBeenCalledWith(item.id));

    window.history.pushState(null, "", `/en/tasks?view=my&layout=list&item=${second.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(await screen.findByRole("heading", { name: second.title })).toBeInTheDocument();

    await act(async () => stale.resolve(item));
    expect(screen.getByRole("heading", { name: second.title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: item.title })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("New status"), "in_progress");
    await user.click(screen.getByRole("button", { name: "Change status" }));
    expect(gateway.transition).toHaveBeenCalledWith(
      second.id,
      expect.objectContaining({ status: "in_progress" }),
    );
  });

  it("renders the Arabic mobile-ready boundary in RTL without changing Task identity", async () => {
    renderWork(service(), null, "ar");
    const region = screen.getByRole("region", { name: "العمل" });

    expect(region).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("Prepare the launch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "لوحة" })).toBeInTheDocument();
  });

  it("provides keyboard row navigation and server-backed filter controls", async () => {
    const user = userEvent.setup();
    const second = {
      ...item,
      id: "44444444-4444-4444-8444-444444444444",
      title: "Confirm customer handoff",
    };
    renderWork(service(), null, "en", [item, second]);

    const search = screen.getByRole("searchbox", { name: "Search work" });
    await user.type(search, "handoff");
    expect(window.location.search).toContain("q=handoff");
    await user.selectOptions(screen.getByLabelText("Status", { selector: "select" }), "blocked");
    expect(window.location.search).toContain("status=blocked");

    const first = screen.getByRole("button", { name: /Prepare the launch/u });
    const next = screen.getByRole("button", { name: /Confirm customer handoff/u });
    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(next).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(window.location.search).toContain(`item=${second.id}`);
  });

  it("edits safe Task fields inline through the authoritative update command", async () => {
    const user = userEvent.setup();
    const updated = {
      ...item,
      title: "Prepare the production launch",
      priority: "urgent" as const,
      dueAt: "2026-08-14T10:30:00.000Z",
      version: 2,
    };
    const gateway = service({ update: vi.fn().mockResolvedValue(updated) });
    renderWork(gateway);

    await user.click(screen.getByRole("button", { name: "Edit task" }));
    const editor = screen.getByRole("form", { name: "Edit task" });
    await user.clear(within(editor).getByLabelText("Task title"));
    await user.type(within(editor).getByLabelText("Task title"), updated.title);
    await user.selectOptions(within(editor).getByLabelText("Priority"), "urgent");
    await user.clear(within(editor).getByLabelText("Due date and time"));
    await user.type(within(editor).getByLabelText("Due date and time"), "2026-08-14T13:30");
    await user.click(within(editor).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(gateway.update).toHaveBeenCalledWith(
        item.id,
        expect.objectContaining({
          dueAt: "2026-08-14T10:30:00.000Z",
          expectedVersion: 1,
          priority: "urgent",
          title: updated.title,
        }),
      ),
    );
    expect(await screen.findByText(updated.title)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Edit task" })).not.toBeInTheDocument();
  });

  it("keeps inline edits visible when the authoritative version is stale", async () => {
    const user = userEvent.setup();
    const gateway = service({ update: vi.fn().mockRejectedValue(new WorkItemGatewayError(409)) });
    renderWork(gateway);

    await user.click(screen.getByRole("button", { name: "Edit task" }));
    const editor = screen.getByRole("form", { name: "Edit task" });
    const title = within(editor).getByLabelText("Task title");
    await user.clear(title);
    await user.type(title, "My unsaved title");
    await user.click(within(editor).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(title).toHaveValue("My unsaved title");
    expect(gateway.load).toHaveBeenCalledWith(item.id);
  });

  it("shows only the authoritative filtered result instead of stale daily groups", () => {
    const filtered = { ...item, title: "Delivery task 12", status: "blocked" as const };
    render(
      <WorkWorkspace
        catalog={getCatalogSync("en")}
        currentUserId={employeeId}
        gateway={service()}
        initialCounts={{
          all: 1,
          planned: 0,
          ready: 0,
          in_progress: 0,
          blocked: 1,
          in_review: 0,
          done: 0,
          cancelled: 0,
        }}
        initialFilters={{
          projectId: null,
          search: "Delivery task 12",
          sort: "due_asc",
          status: null,
        }}
        initialItems={[filtered]}
        initialLayout="list"
        initialView="my"
        locale="en"
        projects={[{ id: projectId, name: "Atlas Delivery" }]}
      />,
    );

    expect(screen.getByText("Delivery task 12")).toBeInTheDocument();
    expect(screen.queryByText("Prepare the launch")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work list 1" })).toBeInTheDocument();
  });

  it("shows the same authoritative Tasks on Board and moves through the protected command", async () => {
    const planned = {
      ...item,
      status: "planned" as const,
      allowedTransitions: ["ready", "cancelled"] as ("ready" | "cancelled")[],
    };
    const ready = {
      ...item,
      id: "44444444-4444-4444-8444-444444444444",
      title: "Verify the source",
    };
    const gateway = service({
      transition: vi.fn().mockResolvedValue({
        ...planned,
        status: "ready",
        version: 2,
        allowedTransitions: ["in_progress", "blocked", "cancelled"],
      }),
    });
    const user = userEvent.setup();
    render(
      <WorkWorkspace
        catalog={getCatalogSync("en")}
        currentUserId={employeeId}
        gateway={gateway}
        initialItems={[planned, ready]}
        initialLayout="board"
        initialView="my"
        locale="en"
        projects={[{ id: projectId, name: "Atlas Delivery" }]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Planned 1" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ready 1" })).toBeVisible();
    expect(screen.getAllByText(planned.title)).toHaveLength(1);
    await user.selectOptions(screen.getByLabelText(`Move ${planned.title} to`), "ready");
    await user.click(screen.getByRole("button", { name: `Move ${planned.title}` }));

    expect(gateway.transition).toHaveBeenCalledWith(
      planned.id,
      expect.objectContaining({ expectedVersion: 1, status: "ready" }),
    );
    expect(await screen.findByRole("heading", { name: "Planned 0" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ready 2" })).toBeVisible();
  });
});

function renderWork(
  gateway: WorkWorkspaceGateway,
  selectedId: string | null = null,
  locale: "ar" | "en" = "en",
  items: import("../../platform/work-items-api").WebWorkItem[] = [item],
  initialSnapshot?: import("@evaluation/contracts").DailyWorkspaceSnapshot,
) {
  return render(
    <WorkWorkspace
      catalog={getCatalogSync(locale)}
      currentUserId={employeeId}
      gateway={gateway}
      initialItems={items}
      initialLayout="list"
      initialSelectedId={selectedId}
      {...(initialSnapshot === undefined ? {} : { initialSnapshot })}
      initialView="my"
      locale={locale}
      projects={[{ id: projectId, name: "Atlas Delivery" }]}
    />,
  );
}

function snapshot(): import("@evaluation/contracts").DailyWorkspaceSnapshot {
  return {
    needsMyAction: [],
    today: [],
    overdue: [],
    reviewQueue: [],
    inbox: [],
    projectPulse: [],
    upcoming: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function service(overrides: Partial<WorkWorkspaceGateway> = {}) {
  return {
    create: vi.fn().mockImplementation(async ({ title }) => ({ ...item, title })),
    load: vi.fn().mockResolvedValue(item),
    loadContext: vi.fn().mockResolvedValue({ evidence: [], updates: [] }),
    loadDependencies: vi.fn().mockResolvedValue({
      workItemId: item.id,
      version: item.version,
      readiness: "ready",
      allowedTransitions: item.allowedTransitions,
      dependsOn: [],
      blocks: [],
    }),
    replaceDependencies: vi.fn(),
    update: vi.fn().mockImplementation(async (_id, input) => ({
      ...item,
      ...input,
      version: 2,
    })),
    transition: vi.fn().mockImplementation(async (_id, input) => ({
      ...item,
      status: input.status,
      version: 2,
    })),
    ...overrides,
  } as WorkWorkspaceGateway & {
    create: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    loadContext: ReturnType<typeof vi.fn>;
    loadDependencies: ReturnType<typeof vi.fn>;
    replaceDependencies: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    transition: ReturnType<typeof vi.fn>;
  };
}

function workItem() {
  return {
    id: itemId,
    projectId,
    workstreamId: null,
    title: "Prepare the launch",
    description: "Confirm the rollout checklist.",
    status: "ready" as const,
    priority: "high" as const,
    assigneeId: employeeId,
    dueAt: "2026-08-13T12:00:00.000Z",
    requirements: ["Deployment checklist"],
    acceptanceConditions: ["Checks are green"],
    blocker: null,
    nextAction: "Run the final check",
    version: 1,
    createdAt: "2026-08-12T08:00:00.000Z",
    updatedAt: "2026-08-12T08:00:00.000Z",
    checklist: [],
    collaboratorIds: [],
    allowedActions: ["edit", "transition", "assign", "add_update"] as (
      "edit" | "transition" | "assign" | "add_update"
    )[],
    allowedTransitions: ["in_progress", "blocked", "cancelled"] as (
      "in_progress" | "blocked" | "cancelled"
    )[],
  };
}
