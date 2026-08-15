// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { getCatalogSync } from "@evaluation/localization";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewConfirmation } from "./review-confirmation.js";

// JSX-only references are removed before the repository's base unused-variable rule runs.
// eslint-disable-next-line no-unused-vars
const ReviewConfirmationView = ReviewConfirmation;

afterEach(cleanup);

describe("ReviewConfirmation", () => {
  it("shows editable Update, separate Evidence, and non-mutating progress proposal", async () => {
    const user = userEvent.setup();
    render(
      <ReviewConfirmationView catalog={getCatalogSync("en")} draft={draft()} onBack={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "Review before confirming" })).toBeInTheDocument();
    expect(screen.getByText("GitHub · PR #184")).toBeInTheDocument();
    expect(screen.getByText("Fresh source")).toBeInTheDocument();
    expect(screen.getByText("Private draft until confirmation")).toBeInTheDocument();
    expect(screen.getByText("Provider source available")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm and publish project update")).toBeChecked();
    expect(screen.getByLabelText("Confirm evidence contribution")).not.toBeChecked();
    expect(screen.getByText("No official progress change yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Project progress remains unchanged until owner confirmation."),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("I understand and acknowledge"));
    expect(screen.getByRole("button", { name: "Confirm selected actions" })).toBeEnabled();
  });

  it("requires editing GitHub evidence before selection", async () => {
    const user = userEvent.setup();
    render(
      <ReviewConfirmationView catalog={getCatalogSync("en")} draft={draft()} onBack={vi.fn()} />,
    );
    await user.click(screen.getByLabelText("Confirm evidence contribution"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Edit the suggested evidence first");

    await user.clear(screen.getByLabelText("Contribution context"));
    await user.type(
      screen.getByLabelText("Contribution context"),
      "I verified the staging fallback.",
    );
    await user.click(screen.getByLabelText("Confirm evidence contribution"));
    expect(screen.getByLabelText("Confirm evidence contribution")).toBeChecked();
  });

  it("shows partial recovery when Update succeeds and Evidence does not", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(200, { revision: 2 }))
      .mockResolvedValueOnce(response(200, { id: "10000000-0000-4000-8000-000000000011" }));
    const value = draft();
    value.evidence[0]!.employeeEdited = true;
    value.evidence[0]!.selected = true;
    fetchMock.mockResolvedValueOnce(response(503, { messageKey: "errors.unavailable" }));

    render(
      <ReviewConfirmationView catalog={getCatalogSync("en")} draft={value} onBack={vi.fn()} />,
    );
    await user.click(screen.getByLabelText("I understand and acknowledge"));
    await user.click(screen.getByRole("button", { name: "Confirm selected actions" }));

    expect(await screen.findByText("Update confirmed.")).toBeInTheDocument();
    expect(
      screen.getByText("Evidence was not confirmed. Your edits remain available to retry."),
    ).toBeInTheDocument();
  });

  it("dismisses an Evidence suggestion only after the employee chooses that action", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response(200, { revision: 2, state: "rejected" }),
    );
    render(
      <ReviewConfirmationView catalog={getCatalogSync("en")} draft={draft()} onBack={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss evidence suggestion" }));

    expect(await screen.findByText("Evidence suggestion dismissed.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Suggested Evidence draft" })).toBeNull();
  });
});

function draft(): import("../../features/review-confirmation/review-confirmation-model").ReviewConfirmationDraft {
  return {
    schemaVersion: "review-confirmation-draft.v1" as const,
    captureId: "10000000-0000-4000-8000-000000000004",
    project: { id: "10000000-0000-4000-8000-000000000001", name: "Atlas Delivery" },
    workItem: { id: "10000000-0000-4000-8000-000000000002", title: "Validate streaming fallback" },
    update: {
      sessionId: "10000000-0000-4000-8000-000000000005",
      expectedVersion: 1,
      editable: true as const,
      selected: true,
      summary: "Authentication fallback validated in staging",
      result: "The fallback path works as intended.",
      nextAction: "Verify the API error-rate source.",
      sourceRefs: [
        {
          kind: "github",
          label: "PR #184",
          observedAt: "2026-08-13T08:00:00Z",
          freshness: "fresh" as const,
        },
      ],
    },
    evidence: [
      {
        draftId: "10000000-0000-4000-8000-000000000006",
        expectedRevision: 1,
        selected: false,
        employeeEditRequired: true,
        employeeEdited: false,
        supportedClaim: "Authentication fallback works in staging",
        contributionContext: "AI draft",
        sourceRefs: [
          {
            kind: "github",
            label: "PR #184",
            observedAt: "2026-08-13T08:00:00Z",
            freshness: "fresh" as const,
          },
        ],
      },
    ],
    progressProposal: {
      componentId: "10000000-0000-4000-8000-000000000003",
      selected: false,
      proposedValue: "1.8%",
      rationale: "Requires a verified measurement source and owner confirmation.",
      mutatesOfficialProgress: false as const,
      requiresOwnerConfirmation: true,
      sourceRefs: [
        {
          kind: "manual_capture",
          label: "API metrics",
          observedAt: "2026-08-13T08:00:00Z",
          freshness: "fresh" as const,
        },
      ],
    },
    uncertainty: "Awaiting a verified KPI source.",
    afterConfirmation: ["Append the Update to the Timeline.", "Create selected Evidence only."],
  };
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}
