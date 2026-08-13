/* eslint-disable no-unused-vars */
// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { getCatalogSync } from "@evaluation/localization";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskContextAssistant } from "./task-context-assistant.js";

afterEach(() => cleanup());

describe("TaskContextAssistant", () => {
  it("answers from the authorized Task context without changing work or inventing progress", async () => {
    const user = userEvent.setup();
    render(
      <TaskContextAssistant
        catalog={getCatalogSync("en")}
        context={{
          updates: [
            {
              detail: "The protected Work query is implemented.",
              id: "11111111-1111-4111-8111-111111111111",
              kind: "update",
              occurredAt: "2026-08-13T08:00:00.000Z",
              reviewState: "employee_confirmed",
              sourceProvenance: "employee_text",
              title: "Work query update",
            },
          ],
          evidence: [
            {
              detail: "PR #184 remains suggested evidence.",
              id: "22222222-2222-4222-8222-222222222222",
              kind: "evidence",
              occurredAt: "2026-08-13T09:00:00.000Z",
              reviewState: "ai_draft",
              sourceProvenance: "github_automated",
              title: "GitHub suggestion",
            },
          ],
        }}
        dependencies={{
          allowedTransitions: ["blocked", "cancelled"],
          blocks: [],
          dependsOn: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              status: "in_progress",
              title: "Finish the frontend contract",
            },
          ],
          readiness: "blocked_by_dependency",
          version: 2,
          workItemId: "44444444-4444-4444-8444-444444444444",
        }}
        item={{
          acceptanceConditions: [],
          allowedActions: ["transition"],
          allowedTransitions: ["blocked", "cancelled"],
          assigneeId: "55555555-5555-4555-8555-555555555555",
          blocker: "Waiting for the frontend contract.",
          checklist: [],
          collaboratorIds: [],
          createdAt: "2026-08-12T08:00:00.000Z",
          description: "Connect the detail journey.",
          dueAt: "2026-08-14T08:00:00.000Z",
          id: "44444444-4444-4444-8444-444444444444",
          nextAction: "Review the protected frontend contract.",
          priority: "high",
          projectId: "66666666-6666-4666-8666-666666666666",
          requirements: [],
          status: "blocked",
          title: "Connect Task detail",
          updatedAt: "2026-08-13T08:00:00.000Z",
          version: 2,
          workstreamId: null,
        }}
      />,
    );

    expect(screen.getByText("Deterministic · based only on this authorized Task")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Why is this Task blocked?" }));
    expect(screen.getByText(/Finish the frontend contract/u)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Summarize linked activity" }));
    expect(screen.getByText(/1 linked update and 1 evidence item/u)).toBeVisible();
    expect(screen.getByText(/GitHub evidence is still only suggested/u)).toBeVisible();
    expect(screen.queryByText(/rating|productivity score|employee rank/iu)).not.toBeInTheDocument();
  });

  it("prepares a status change but executes it only after explicit confirmation", async () => {
    const user = userEvent.setup();
    const confirmTransition = vi.fn(async () => undefined);
    render(
      <TaskContextAssistant
        catalog={getCatalogSync("en")}
        context={null}
        dependencies={null}
        item={{
          acceptanceConditions: [],
          allowedActions: ["transition"],
          allowedTransitions: ["in_progress", "cancelled"],
          assigneeId: crypto.randomUUID(),
          blocker: null,
          checklist: [],
          collaboratorIds: [],
          createdAt: "2026-08-12T08:00:00.000Z",
          description: "Start the bounded implementation.",
          dueAt: "2026-08-14T08:00:00.000Z",
          id: crypto.randomUUID(),
          nextAction: "Implement the focused change.",
          priority: "high",
          projectId: crypto.randomUUID(),
          requirements: [],
          status: "ready",
          title: "Close the Work Agent gap",
          updatedAt: "2026-08-13T08:00:00.000Z",
          version: 2,
          workstreamId: null,
        }}
        onConfirmTransition={confirmTransition}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Prepare a status change" }));
    expect(confirmTransition).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Prepared status change" })).toBeVisible();
    expect(screen.getByText(/Ready → In progress/u)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Confirm status change" }));
    expect(confirmTransition).toHaveBeenCalledWith("in_progress");
  });

  it("asks a natural-language question and keeps an AI-prepared command behind confirmation", async () => {
    const user = userEvent.setup();
    const askTask = vi.fn(async () => ({
      schemaVersion: "task-assistant-output.v1" as const,
      answer: "The focused verification is the remaining step.",
      sourceReferences: ["work-item:82000000-0000-4000-8000-000000000001"],
      assistance: "ai_assisted" as const,
      suggestedAction: {
        kind: "status_change" as const,
        status: "in_review" as const,
        rationale: "Move to review only after the focused verification passes.",
      },
      createsCommand: false as const,
    }));
    const confirmTransition = vi.fn(async () => undefined);
    render(
      <TaskContextAssistant
        catalog={getCatalogSync("en")}
        context={null}
        dependencies={null}
        item={{
          acceptanceConditions: [],
          allowedActions: ["transition"],
          allowedTransitions: ["in_review"],
          assigneeId: crypto.randomUUID(),
          blocker: null,
          checklist: [],
          collaboratorIds: [],
          createdAt: "2026-08-12T08:00:00.000Z",
          description: "Close the agent gap.",
          dueAt: null,
          id: "82000000-0000-4000-8000-000000000001",
          nextAction: "Run the focused verification.",
          priority: "high",
          projectId: crypto.randomUUID(),
          requirements: [],
          status: "in_progress",
          title: "Close Work Agent capability gaps",
          updatedAt: "2026-08-13T08:00:00.000Z",
          version: 3,
          workstreamId: null,
        }}
        onAskTask={askTask}
        onConfirmTransition={confirmTransition}
      />,
    );

    await user.type(screen.getByLabelText("Ask a question about this Task"), "What remains?");
    await user.click(screen.getByRole("button", { name: "Ask assistant" }));
    expect(askTask).toHaveBeenCalledWith("What remains?");
    expect(
      await screen.findByText("The focused verification is the remaining step."),
    ).toBeVisible();
    expect(screen.getByText(/Authorized sources: 1/u)).toBeVisible();
    expect(confirmTransition).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Prepare In review" }));
    expect(screen.getByRole("heading", { name: "Prepared status change" })).toBeVisible();
    expect(confirmTransition).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm status change" }));
    expect(confirmTransition).toHaveBeenCalledWith("in_review");
  });
});
