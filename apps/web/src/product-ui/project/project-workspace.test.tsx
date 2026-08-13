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
    expect(screen.getByLabelText("62% confirmed Project progress")).toBeInTheDocument();
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
