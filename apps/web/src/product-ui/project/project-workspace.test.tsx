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
    const ownership = screen.getByLabelText("Ownership and access");
    expect(ownership).toHaveTextContent("Current ownerCodex");
    expect(ownership).toHaveTextContent("Your roleOwner");
    expect(ownership).toHaveTextContent("Coordination only — this is not manager authority");
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
    expect(screen.getByLabelText("Ownership and access")).toHaveTextContent("Current ownerCodex");
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
    const criteria = screen.getByLabelText("Criteria and Progress Contract");
    expect(criteria).toHaveTextContent("Project Document v2");
    expect(criteria).toHaveTextContent("Ready for your review");
    expect(criteria).toHaveTextContent("4 proposed components");
    expect(criteria).toHaveTextContent("1 question to resolve");
    expect(criteria).toHaveTextContent(
      "Only an authorized human can edit, approve, and activate it",
    );
    const documents = screen.getByLabelText("Project documents and sources");
    expect(documents).toHaveTextContent("Current versionv2");
    expect(documents).toHaveTextContent("Source availabilityAvailable");
    expect(documents).toHaveTextContent("Approved delivery revision");
    expect(documents).toHaveTextContent("github.com/atlas/project");
    expect(documents).toHaveTextContent("requirements.pdf");
    expect(screen.getByText("Needs attention now")).toBeInTheDocument();
    expect(screen.getByText("Work and evidence")).toBeInTheDocument();
    expect(screen.getByText("Project timeline")).toBeInTheDocument();
    const timeline = screen.getByLabelText("Meaningful Project timeline");
    expect(timeline).toHaveTextContent("Confirmed update");
    expect(timeline).toHaveTextContent("API readiness · Validate streaming fallback");
    expect(timeline).toHaveTextContent("Employee-confirmed update");
    const agent = screen.getByLabelText("Project Agent signals");
    expect(agent).toHaveTextContent("Evidence needed for API authentication");
    expect(agent).toHaveTextContent("Owner confirmation");
    const prepared = screen.getByLabelText("Prepared Project actions");
    expect(prepared).toHaveTextContent("Prepare the next milestone context");
    expect(prepared).toHaveTextContent("Review before anything changes");
    expect(screen.getByText("SMART BRIEF")).toBeInTheDocument();
  });
  it("keeps the Arabic surface RTL", () => {
    render(<ProjectWorkspace catalog={getCatalogSync("ar")} experience={fixture()} locale="ar" />);
    expect(screen.getByTestId("project-workspace")).toHaveAttribute("dir", "rtl");
  });
});
