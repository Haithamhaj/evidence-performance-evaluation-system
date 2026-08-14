/* eslint-disable no-unused-vars */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getCatalogSync } from "@evaluation/localization";
import { afterEach, describe, expect, it } from "vitest";
import { fixture } from "../../features/project-experience/project-experience-model.test.js";
import { ProjectWorkspace } from "./project-workspace.js";

describe("ProjectWorkspace", () => {
  afterEach(cleanup);
  it("renders the approved Project hierarchy", () => {
    render(<ProjectWorkspace catalog={getCatalogSync("en")} experience={fixture()} locale="en" />);
    expect(screen.getByRole("heading", { name: "Atlas Delivery" })).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "Project workspace" });
    expect(navigation).toHaveTextContent("Overview");
    expect(navigation).toHaveTextContent("Plan");
    expect(navigation).toHaveTextContent("Work");
    expect(navigation).toHaveTextContent("Progress");
    expect(navigation).toHaveTextContent("Timeline");
    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
      "href",
      "/en/tasks?view=my&layout=list&project=40000000-0000-4000-8000-000000000001",
    );
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project at a glance")).toHaveTextContent(
      "Current stageAPI authentication",
    );
    expect(screen.getByLabelText("Project at a glance")).toHaveTextContent(
      "Next stagePilot readiness",
    );
    expect(screen.getByLabelText("Project at a glance")).toHaveTextContent(
      "Active blockerOwner decision on PR #184",
    );
    expect(screen.getByRole("link", { name: "API readiness" })).toHaveAttribute(
      "href",
      "/en/projects/40000000-0000-4000-8000-000000000001/workstreams/40000000-0000-4000-8000-000000000002",
    );
    expect(screen.getByRole("heading", { name: "Milestone plan" })).toBeInTheDocument();
    expect(screen.getByText("API readiness")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review progress contract" })).toHaveAttribute(
      "href",
      "/en/projects/40000000-0000-4000-8000-000000000001/settings/progress-contract",
    );
    expect(screen.getByLabelText("62% confirmed Project progress")).toBeInTheDocument();
    const review = screen.getByLabelText("Project progress review");
    expect(review).toHaveTextContent("Contract v2");
    expect(review).toHaveTextContent("Latest approved snapshot62%Previous 50%");
    expect(review).toHaveTextContent("Pending changePending review");
    expect(review).toHaveTextContent("Owner confirmation");
    expect(review).toHaveTextContent("API error rate");
    expect(review).toHaveTextContent("This does not change official progress until approved");
    expect(screen.getByText("Needs attention now")).toBeInTheDocument();
    expect(screen.getByText("Work and evidence")).toBeInTheDocument();
    expect(screen.getByText("Project timeline")).toBeInTheDocument();
    expect(screen.getByText("SMART BRIEF")).toBeInTheDocument();
  });
  it("keeps the Arabic surface RTL", () => {
    render(<ProjectWorkspace catalog={getCatalogSync("ar")} experience={fixture()} locale="ar" />);
    expect(screen.getByTestId("project-workspace")).toHaveAttribute("dir", "rtl");
  });
});
