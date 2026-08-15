// @vitest-environment jsdom
/* eslint-disable no-unused-vars */
import { getCatalogSync } from "@evaluation/localization";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationInbox } from "./notification-inbox.js";

afterEach(() => cleanup());

describe("NotificationInbox", () => {
  it("groups duplicate actions, distinguishes unread state, and opens through the protected action", async () => {
    const open = vi.fn(async () => ({ href: "" }));
    render(
      <NotificationInbox
        catalog={getCatalogSync("en")}
        initialItems={[
          notification("22222222-2222-4222-8222-222222222221", null),
          notification("22222222-2222-4222-8222-222222222222", "2026-08-15T07:30:00.000Z"),
        ]}
        locale="en"
        onOpen={open}
        onResolve={vi.fn(async () => true)}
      />,
    );

    expect(screen.getByText("2 related notifications")).toBeTruthy();
    expect(screen.getByText("Unread")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review connection" }));
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
  });

  it("resolves an action without affecting another group", async () => {
    const resolve = vi.fn(async () => true);
    render(
      <NotificationInbox
        catalog={getCatalogSync("en")}
        initialItems={[
          notification("22222222-2222-4222-8222-222222222221", null),
          {
            ...notification("22222222-2222-4222-8222-222222222223", null),
            category: "EXPORT_READY",
            actionKind: "DOWNLOAD_EXPORT",
            actionResourceId: "report-1",
            dedupeKey: "export-1",
          },
        ]}
        locale="en"
        onOpen={vi.fn()}
        onResolve={resolve}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Mark resolved" })[0]!);
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Export ready")).toBeTruthy();
  });
});

function notification(id: string, readAt: string | null) {
  return {
    id,
    category: "CONNECTOR_STATE" as const,
    urgency: "ACTION" as const,
    actionKind: "RECONNECT" as const,
    actionResourceId: "google-workspace",
    dedupeKey: "google-reconnect",
    readAt,
    resolvedAt: null,
    createdAt: "2026-08-15T07:00:00.000Z",
  };
}
