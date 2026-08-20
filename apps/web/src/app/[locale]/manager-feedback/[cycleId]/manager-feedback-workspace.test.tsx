/* eslint-disable no-unused-vars */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getCatalogSync } from "@evaluation/localization";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManagerFeedbackWorkspace } from "./manager-feedback-workspace.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe("ManagerFeedbackWorkspace", () => {
  it("keeps the identified employee journey compact and requires explicit confirmation", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "submitted", submittedAt: "2026-08-15T10:00:00Z" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    render(
      <ManagerFeedbackWorkspace
        catalog={getCatalogSync("en")}
        experience={{ kind: "participant", journey: participantJourney() }}
        locale="en"
        rubric={rubric()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Feedback for Pilot Manager" })).toBeVisible();
    expect(screen.getByText(/your name, ratings, comments, and submission time/i)).toBeVisible();
    expect(screen.getByText("Criterion 1 of 5")).toBeVisible();
    expect(screen.queryByText("Support, Barrier Removal, and Team Protection")).toBeNull();

    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByRole("radio", { name: /3 Approved anchor 3/ }));
      fireEvent.change(screen.getByLabelText("Work-related comment"), {
        target: { value: `Specific observation ${index + 1}` },
      });
      if (index < 4) fireEvent.click(screen.getByRole("button", { name: "Next criterion" }));
    }

    const submit = screen.getByRole("button", { name: "Submit identified feedback" });
    expect(submit).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I understand this feedback is identified and visible to Pilot Manager/i,
      }),
    );
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Feedback submitted"));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.responses).toHaveLength(5);
    expect(body.identifiedNoticeConfirmed).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/anonymous|aiRating|suggestedRating/i);
  });

  it("shows identified originals to the authorized manager without an anonymity claim", () => {
    render(
      <ManagerFeedbackWorkspace
        catalog={getCatalogSync("en")}
        experience={{ kind: "manager", view: managerView() }}
        locale="en"
        rubric={rubric()}
      />,
    );

    expect(screen.getByText("Codex Employee")).toBeVisible();
    expect(screen.getByText("Specific identified feedback")).toBeVisible();
    expect(document.body).not.toHaveTextContent(/anonymous|confidential/i);
  });
});

function participantJourney() {
  return {
    schemaVersion: 1 as const,
    cycle: {
      id: "10000000-0000-4000-8000-000000009001",
      state: "OPEN" as const,
      visibilityMode: "IDENTIFIED" as const,
      startsAt: "2026-07-01T00:00:00Z",
      endsAt: "2026-10-01T00:00:00Z",
    },
    manager: { id: "10000000-0000-4000-8000-000000009002", displayName: "Pilot Manager" },
    eligibility: {
      id: "10000000-0000-4000-8000-000000009003",
      state: "ELIGIBLE_PENDING" as const,
      version: 1,
    },
    criteria: rubric().map((criterion, index) => ({
      criterionId: `10000000-0000-4000-8000-${String(9100 + index).padStart(12, "0")}`,
      stableCriterionId: criterion.id,
      commentRequired: false,
      anchors: criterion.anchors,
    })),
    submittedResponse: null,
  };
}

function rubric() {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `MGR-0${index + 1}` as "MGR-01" | "MGR-02" | "MGR-03" | "MGR-04" | "MGR-05",
    title:
      index === 0
        ? "Direction and Priority Clarity"
        : index === 1
          ? "Support, Barrier Removal, and Team Protection"
          : `Manager criterion ${index + 1}`,
    definition: `Approved definition ${index + 1}`,
    commentPrompt: `Approved prompt ${index + 1}`,
    anchors: Array.from({ length: 5 }, (_, rating) => ({
      rating: (rating + 1) as 1 | 2 | 3 | 4 | 5,
      text: `Approved anchor ${rating + 1}`,
    })),
  }));
}

function managerView() {
  return {
    schemaVersion: 1 as const,
    cycleId: "10000000-0000-4000-8000-000000009001",
    managerId: "10000000-0000-4000-8000-000000009002",
    visibilityMode: "IDENTIFIED" as const,
    period: { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" },
    completion: {
      submitted: 1,
      pending: 0,
      approvedLeave: 0,
      postponed: 0,
      excluded: 0,
      entries: [],
    },
    responses: [
      {
        responseId: "10000000-0000-4000-8000-000000009099",
        submitterId: "10000000-0000-4000-8000-000000009004",
        submitterDisplayName: "Codex Employee",
        submittedAt: "2026-08-15T10:00:00Z",
        responses: [
          {
            criterionId: "10000000-0000-4000-8000-000000009100",
            rating: 3,
            comment: "Specific identified feedback",
          },
        ],
      },
    ],
    summaryRevision: null,
  };
}
