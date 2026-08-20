/* eslint-disable no-unused-vars */
// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { getCatalogSync } from "@evaluation/localization";
import { afterEach, describe, expect, it } from "vitest";

import { HomeOverview } from "./home-overview.js";

describe("HomeOverview", () => {
  afterEach(cleanup);

  it("shows the approved hierarchy and explains Project progress provenance", () => {
    render(<HomeOverview catalog={getCatalogSync("en")} home={fixture()} locale="en" />);

    expect(screen.getByRole("heading", { name: "Good morning, Codex" })).toBeInTheDocument();
    expect(screen.getByText("Your project journey")).toBeInTheDocument();
    const project = screen.getByRole("article", { name: "Atlas Delivery" });
    expect(within(project).getByLabelText("62% confirmed Project progress")).toBeInTheDocument();
    expect(within(project).getByText(/Approved Project contract/u)).toBeInTheDocument();
    expect(within(project).getByText("API authentication")).toBeInTheDocument();
    expect(within(project).getByText("API error rate")).toBeInTheDocument();
    expect(screen.getByText("SMART BRIEF")).toBeInTheDocument();
    expect(screen.getByText("How calculated")).toBeInTheDocument();
  });

  it("keeps Arabic layout RTL without changing Project meaning", () => {
    render(<HomeOverview catalog={getCatalogSync("ar")} home={fixture()} locale="ar" />);

    expect(screen.getByTestId("home-overview")).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("heading", { name: "صباح الخير، Codex" })).toBeInTheDocument();
    expect(screen.getByText("Atlas Delivery")).toBeInTheDocument();
  });
});

function fixture(): import("@evaluation/contracts/employee-experience").EmployeeHomeV1 {
  const source = {
    kind: "progress_contract" as const,
    label: "Approved Project contract",
    observedAt: "2026-08-13T07:00:00.000Z",
    freshness: "fresh" as const,
  };
  const projectId = "40000000-0000-4000-8000-000000000001";
  return {
    schemaVersion: "employee-home.v1",
    generatedAt: "2026-08-13T07:05:00.000Z",
    greetingName: "Codex",
    signals: { decisions: 1, dueToday: 3, verifiedChanges: 2 },
    projects: [
      {
        id: projectId,
        name: "Atlas Delivery",
        description: "Deliver secure API access.",
        status: "active",
        progress: { state: "accepted", percent: 62, source, explanation: "Approved rule" },
        milestones: [
          {
            componentId: "40000000-0000-4000-8000-000000000002",
            name: "Discovery",
            kind: "milestone",
            state: "complete",
            percent: 100,
          },
          {
            componentId: "40000000-0000-4000-8000-000000000003",
            name: "API authentication",
            kind: "milestone",
            state: "current",
            percent: 62,
          },
          {
            componentId: "40000000-0000-4000-8000-000000000004",
            name: "Pilot readiness",
            kind: "milestone",
            state: "next",
            percent: null,
          },
        ],
        kpi: {
          componentId: "40000000-0000-4000-8000-000000000005",
          name: "API error rate",
          baseline: 4.1,
          current: 1.8,
          target: 1,
          unit: "%",
          direction: "decrease",
          source,
        },
        nextAction: { label: "Review PR #184", href: `/en/projects/${projectId}` },
      },
    ],
    smartBrief: {
      title: "Why Atlas Delivery needs attention",
      body: "API error rate is above the contract target.",
      source,
      why: "Owner confirmation is pending.",
      consequence: "Reviewing opens the protected decision.",
      action: { label: "Review decision", href: `/en/projects/${projectId}` },
    },
    now: [],
  };
}
