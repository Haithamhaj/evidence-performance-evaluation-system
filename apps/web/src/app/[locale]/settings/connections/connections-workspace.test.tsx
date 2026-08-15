// @vitest-environment jsdom
/* eslint-disable no-unused-vars */
import { getCatalogSync } from "@evaluation/localization";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConnectionsWorkspace } from "./connections-workspace.js";

afterEach(() => cleanup());

describe("ConnectionsWorkspace", () => {
  it("shows Google private context and a truthful GitHub Administrator gate", () => {
    render(
      <ConnectionsWorkspace catalog={getCatalogSync("en")} githubAvailable={false} locale="en" />,
    );

    expect(screen.getByRole("heading", { name: "Connections" })).toBeTruthy();
    expect(screen.getByText("Google Workspace")).toBeTruthy();
    expect(screen.getByText("Administrator setup required")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect GitHub" })).toBeNull();
  });
});
