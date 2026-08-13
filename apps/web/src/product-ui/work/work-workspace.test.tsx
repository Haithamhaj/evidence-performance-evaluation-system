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

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(window.location.search).not.toContain("item=");
    expect(row).toHaveFocus();
  });

  it("creates through the existing protected command and opens the authoritative item", async () => {
    const user = userEvent.setup();
    const created = { ...item, id: crypto.randomUUID(), title: "Ship the release" };
    const gateway = service({ create: vi.fn().mockResolvedValue(created) });
    renderWork(gateway);

    await user.type(screen.getByLabelText("Task title"), created.title);
    await user.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(gateway.create).toHaveBeenCalledOnce());
    expect(await screen.findByText(created.title)).toBeInTheDocument();
    expect(window.location.search).toContain(`item=${created.id}`);
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
        initialView="my"
        locale="en"
        projects={[{ id: projectId, name: "Atlas Delivery" }]}
      />,
    );

    expect(screen.getByText("Delivery task 12")).toBeInTheDocument();
    expect(screen.queryByText("Prepare the launch")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work list 1" })).toBeInTheDocument();
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
    transition: vi.fn().mockImplementation(async (_id, input) => ({
      ...item,
      status: input.status,
      version: 2,
    })),
    ...overrides,
  } as WorkWorkspaceGateway & {
    create: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
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
