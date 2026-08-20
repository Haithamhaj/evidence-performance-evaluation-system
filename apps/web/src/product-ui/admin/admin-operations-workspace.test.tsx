// @vitest-environment jsdom
/* eslint-disable no-unused-vars */
import { getCatalogSync } from "@evaluation/localization";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminOperationsWorkspace } from "./admin-operations-workspace.js";

afterEach(() => cleanup());

describe("AdminOperationsWorkspace", () => {
  it("shows safe dependency health and recovery without raw diagnostics", () => {
    render(
      <AdminOperationsWorkspace
        catalog={getCatalogSync("en")}
        initialHealth={{
          schemaVersion: 1,
          state: "ACTION_REQUIRED",
          checkedAt: "2026-08-15T08:00:00.000Z",
          dependencies: [
            {
              dependency: "QUEUE",
              state: "ACTION_REQUIRED",
              checkedAt: "2026-08-15T08:00:00.000Z",
              nextActionKey: "admin.health.configureQueue",
              correlationId: "safe-reference-1",
            },
          ],
        }}
        initialCapabilities={[
          { capability: "AI_ROUTES_MANAGE", available: true },
          { capability: "USERS_MANAGE", available: false },
        ]}
        locale="en"
      />,
    );

    expect(screen.getByRole("heading", { name: "System operations" })).toBeTruthy();
    expect(screen.getAllByText("Action required")).toHaveLength(2);
    expect(screen.getAllByText("Administrator setup required")).toHaveLength(2);
    expect(screen.getByText("AI routes")).toBeTruthy();
    expect(screen.getByText("Available through governed commands")).toBeTruthy();
    expect(screen.getByText("User accounts")).toBeTruthy();
    expect(screen.getByText("Not available in this build")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/password|raw log|access token/iu);
    expect(screen.queryByRole("button", { name: /delete|reset|clear/iu })).toBeNull();
  });
});
