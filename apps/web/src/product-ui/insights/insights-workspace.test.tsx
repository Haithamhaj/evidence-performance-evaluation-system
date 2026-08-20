// @vitest-environment jsdom
/* eslint-disable no-unused-vars */
import { getCatalogSync } from "@evaluation/localization";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InsightsWorkspace } from "./insights-workspace.js";

afterEach(() => cleanup());

describe("InsightsWorkspace", () => {
  it("renders an accessible Project progress summary and equivalent table", () => {
    render(<InsightsWorkspace catalog={getCatalogSync("en")} insights={fixture()} locale="en" />);

    expect(screen.getByRole("heading", { name: "Insights" })).toBeTruthy();
    expect(
      screen.getByLabelText("Atlas confirmed Project progress: 62%").getAttribute("value"),
    ).toBe("62");
    const table = screen.getByRole("table", { name: "Project progress details" });
    expect(within(table).getByText("API authentication")).toBeTruthy();
    expect(screen.getByText("Confirmed contributions")).toBeTruthy();
    expect(screen.getByText("Finalized evaluation history")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /rating\s*:\s*\d|productivity score\s*:\s*\d|rank\s*:\s*\d/iu,
    );
  });

  it("renders Arabic in RTL without changing stored insight meaning", () => {
    const { container } = render(
      <InsightsWorkspace catalog={getCatalogSync("ar")} insights={fixture()} locale="ar" />,
    );

    expect(container.firstElementChild?.getAttribute("dir")).toBe("rtl");
    expect(screen.getByText("62%")).toBeTruthy();
  });
});

function fixture(): import("@evaluation/contracts/insights").EmployeeInsightsV1 {
  return {
    schemaVersion: "employee-insights.v1",
    generatedAt: "2026-08-15T08:00:00.000Z",
    personal: {
      confirmedContributions: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          project: { id: "22222222-2222-4222-8222-222222222222", name: "Atlas" },
          workItem: null,
          sourceKind: "github",
          verificationState: "supported",
          confirmedAt: "2026-08-14T08:00:00.000Z",
        },
      ],
      finalizedEvaluations: [
        {
          assignmentId: "33333333-3333-4333-8333-333333333333",
          cycle: {
            id: "44444444-4444-4444-8444-444444444444",
            type: "CALIBRATION_NON_BASELINE",
            startsAt: "2026-01-01T00:00:00.000Z",
            endsAt: "2026-03-31T23:59:59.000Z",
          },
          finalizedAt: "2026-04-07T08:00:00.000Z",
          acknowledgment: null,
        },
      ],
    },
    projects: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Atlas",
        status: "active",
        progress: {
          state: "accepted",
          percent: 62,
          updatedAt: "2026-08-14T08:00:00.000Z",
        },
        sourceHealth: "sufficient",
        milestones: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            name: "API authentication",
            kind: "milestone",
            state: "in_progress",
            percent: 60,
          },
        ],
        kpi: {
          id: "66666666-6666-4666-8666-666666666666",
          name: "API error rate",
          current: 1.8,
          target: 1,
          unit: "%",
          direction: "decrease",
          observedAt: "2026-08-14T08:00:00.000Z",
        },
      },
    ],
  };
}
