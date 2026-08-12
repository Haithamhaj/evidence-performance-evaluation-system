/* eslint-disable no-unused-vars */
// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { getCatalogSync } from "@evaluation/localization";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { createElement } from "react";

import { ContextDecisionError } from "../../platform/context-intelligence-api.js";
import type { WebPreparedExperienceComposition } from "../../platform/experience-orchestration-contracts.js";
import { IntelligentToday, type IntelligentTodayGateway } from "./intelligent-today.js";

const suggestionHandle = `opaque-project_suggestion-${"x".repeat(40)}`;
const correctedProjectHandle = `opaque-project-${"y".repeat(40)}`;
const projectId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";

const snapshot: import("@evaluation/contracts").DailyWorkspaceSnapshot = {
  needsMyAction: [],
  today: [
    {
      id: itemId,
      projectId,
      workstreamId: null,
      title: "Validate streaming fallback",
      description: "",
      status: "ready",
      priority: "high",
      assigneeId: "33333333-3333-4333-8333-333333333333",
      dueAt: "2026-08-12T12:00:00.000Z",
      requirements: [],
      acceptanceConditions: [],
      blocker: null,
      nextAction: "Retry the protected stream",
      version: 1,
      createdAt: "2026-08-12T07:00:00.000Z",
      updatedAt: "2026-08-12T08:00:00.000Z",
      checklist: [],
      collaboratorIds: [],
      allowedActions: ["edit"],
    },
  ],
  overdue: [],
  reviewQueue: [],
  inbox: [],
  projectPulse: [
    {
      id: projectId,
      name: "Atlas Voice Intelligence",
      status: "active",
      progress: { state: "awaiting_contract" },
    },
  ],
  upcoming: [],
};

const queue = {
  items: [
    {
      kind: "project_match" as const,
      handle: suggestionHandle,
      projectName: "Atlas Voice Intelligence",
      explanation: "The source describes the approved authentication scope.",
      source: {
        provider: "GOOGLE_GMAIL" as const,
        observedAt: "2026-08-12T08:00:00.000Z",
        title: "API authentication follow-up",
        summary: "The client confirmed the endpoint scope.",
        sourceUrl: "https://mail.google.com/example",
      },
    },
  ],
  projects: [
    {
      handle: suggestionHandle.replace("project_suggestion", "project"),
      name: "Atlas Voice Intelligence",
    },
    { handle: correctedProjectHandle, name: "Customer rollout" },
  ],
};

const prepared: WebPreparedExperienceComposition = {
  state: "prepared",
  items: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      schemaVersion: "experience-prepared-output.v1",
      state: "prepared",
      kind: "next_action",
      sourceReferences: [`work-item:${itemId}`],
      why: "This authorized Task needs your attention today.",
      freshness: {
        status: "fresh",
        sourceObservedAt: "2026-08-12T08:00:00.000Z",
        preparedAt: "2026-08-12T08:05:00.000Z",
      },
      consequence: "Nothing changes until you act.",
      editableDraft: {
        title: "Validate streaming fallback",
        body: "Retry the protected stream",
      },
      assistance: {
        mode: "deterministic",
        label: "Selected from your authorized Today data without an AI result.",
        routeTrace: null,
      },
      correlationId: "55555555-5555-4555-8555-555555555555",
    },
  ],
};

afterEach(() => cleanup());

describe("IntelligentToday", () => {
  it("shows one explained decision, one editable prepared item, and the deterministic Today row", async () => {
    renderToday(gateway());

    expect(await screen.findByText("API authentication follow-up")).toBeInTheDocument();
    expect(
      screen.getByText("The source describes the approved authentication scope."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Reviewing this link will connect the private source context to the selected Project only after your confirmation.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This authorized Task needs your attention today."),
    ).toBeInTheDocument();
    expect(screen.getByText("Work item")).toBeInTheDocument();
    expect(screen.queryByText(`work-item:${itemId}`)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Prepared draft details")).toHaveValue(
      "Retry the protected stream",
    );
    expect(
      screen.getByText("Validate streaming fallback", { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("confirms through the protected decision gateway and removes the decided candidate", async () => {
    let decided = false;
    const service = gateway({
      confirm: async ({ handle }) => {
        if (handle !== suggestionHandle) throw new Error("wrong suggestion");
        decided = true;
      },
      loadDecisionQueue: async () => (decided ? { items: [], projects: queue.projects } : queue),
    });
    const user = userEvent.setup();
    renderToday(service);

    await user.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.getByText("Decision saved.")).toBeInTheDocument());
    expect(screen.queryByText("API authentication follow-up")).not.toBeInTheDocument();
  });

  it("keeps a correction editable and recovers from a stale protected command", async () => {
    let attempts = 0;
    let refreshed = false;
    const service = gateway({
      correct: async () => {
        attempts += 1;
        if (attempts === 1) throw new ContextDecisionError(409);
      },
      loadDecisionQueue: async () => {
        if (refreshed) {
          return {
            ...queue,
            items: [{ ...queue.items[0]!, explanation: "The refreshed source is current." }],
          };
        }
        return queue;
      },
    });
    const user = userEvent.setup();
    renderToday(service);

    await user.click(await screen.findByRole("button", { name: "Correct" }));
    await user.selectOptions(
      screen.getByLabelText("Choose another Project"),
      correctedProjectHandle,
    );
    expect(screen.getByLabelText("Choose another Project")).toHaveValue(correctedProjectHandle);

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This decision is out of date");
    expect(screen.getByLabelText("Choose another Project")).toHaveValue(correctedProjectHandle);

    refreshed = true;
    await user.click(screen.getByRole("button", { name: "Reload current item" }));
    expect(await screen.findByText("The refreshed source is current.")).toBeInTheDocument();
  });

  it("allows the employee to correct an unmatched suggestion before confirming", async () => {
    let correctedProject = "";
    let decided = false;
    const unmatched = {
      ...queue,
      items: [{ ...queue.items[0]!, projectName: null }],
    };
    const service = gateway({
      correct: async ({ projectHandle }) => {
        correctedProject = projectHandle;
        decided = true;
      },
      loadDecisionQueue: async () =>
        decided ? { items: [], projects: queue.projects } : unmatched,
    });
    const user = userEvent.setup();
    renderToday(service);

    expect(await screen.findByRole("button", { name: "Confirm" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Correct" }));
    await user.selectOptions(
      screen.getByLabelText("Choose another Project"),
      correctedProjectHandle,
    );
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(correctedProject).toBe(correctedProjectHandle));
  });

  it("dismisses without presenting evidence or Project progress as changed", async () => {
    let dismissed = false;
    const service = gateway({
      dismiss: async ({ handle }) => {
        if (handle !== suggestionHandle) throw new Error("wrong suggestion");
        dismissed = true;
      },
      loadDecisionQueue: async () => (dismissed ? { items: [], projects: queue.projects } : queue),
    });
    const user = userEvent.setup();
    renderToday(service);

    await user.click(await screen.findByRole("button", { name: "Dismiss" }));

    expect(
      await screen.findByText("Suggestion dismissed. The source remains unchanged."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Evidence created")).not.toBeInTheDocument();
    expect(screen.queryByText("Project progress updated")).not.toBeInTheDocument();
  });
});

function gateway(overrides: Partial<IntelligentTodayGateway> = {}): IntelligentTodayGateway {
  return {
    confirm: async () => undefined,
    correct: async () => undefined,
    dismiss: async () => undefined,
    loadDecisionQueue: async () => queue,
    loadPrepared: async () => prepared,
    ...overrides,
  };
}

function renderToday(service: IntelligentTodayGateway) {
  return render(
    createElement(IntelligentToday, {
      catalog: getCatalogSync("en"),
      gateway: service,
      locale: "en",
      onTaskSelect: () => undefined,
      snapshot,
    }),
  );
}
