/* eslint-disable no-unused-vars */
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getCatalogSync } from "@evaluation/localization";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectAssistant } from "./project-assistant.js";

const projectId = "95000000-0000-4000-8000-000000000001";

describe("ProjectAssistant", () => {
  afterEach(cleanup);

  it("asks one bounded Project question and renders source-backed AI assistance", async () => {
    const ask = vi.fn(async () => ({
      schemaVersion: "project-assistant-output.v1" as const,
      answer: "The latest confirmed change is the Capture-to-Evidence bridge.",
      sourceReferences: [`project:${projectId}`, "timeline:confirmed-update"],
      assistance: "ai_assisted" as const,
      createsCommand: false as const,
    }));
    render(
      <ProjectAssistant
        ask={ask}
        catalog={getCatalogSync("en")}
        locale="en"
        projectId={projectId}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "What changed?" }));
    await act(async () => undefined);

    expect(ask).toHaveBeenCalledWith({ projectId, locale: "en", question: "what_changed" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "The latest confirmed change is the Capture-to-Evidence bridge.",
    );
    expect(screen.getByText("AI-assisted · 2 authorized sources")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /confirm|approve|execute/i }),
    ).not.toBeInTheDocument();
  });

  it("offers the three approved questions and a truthful recovery state", async () => {
    const ask = vi.fn(async () => {
      throw new Error("offline");
    });
    render(
      <ProjectAssistant
        ask={ask}
        catalog={getCatalogSync("en")}
        locale="en"
        projectId={projectId}
      />,
    );

    expect(screen.getByRole("button", { name: "What changed?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Why are we blocked?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What evidence is missing?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Why are we blocked?" }));
    await act(async () => undefined);
    expect(screen.getByRole("alert")).toHaveTextContent("Project assistance is unavailable");
  });
});
