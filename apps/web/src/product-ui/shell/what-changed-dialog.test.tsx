// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { getCatalogSync } from "@evaluation/localization";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createElement } from "react";

import * as whatChanged from "./what-changed-dialog.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("WhatChangedDialog", () => {
  it("opens the owner-filtered product projection and explains a confirmed private capture", async () => {
    const fetchProjection = vi.fn(async () => ({
      items: [
        {
          receiptId: "80000000-0000-4000-8000-000000000001",
          cursor: "1",
          type: "user.capture_submitted",
          source: "work_items",
          entityRefs: [],
          occurredAt: "2026-08-12T09:00:00.000Z",
          freshness: {},
          state: "delivered" as const,
        },
      ],
      nextCursor: "1",
    }));
    const user = userEvent.setup();
    render(
      createElement(whatChanged.WhatChangedDialog, {
        catalog: getCatalogSync("en"),
        fetchProjection,
      }),
    );

    await user.click(screen.getByRole("button", { name: "What Changed" }));

    await waitFor(() =>
      expect(screen.getByText("Saved to your private Inbox")).toBeInTheDocument(),
    );
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("shows an honest empty state when this user has no delivered changes", async () => {
    const user = userEvent.setup();
    render(
      createElement(whatChanged.WhatChangedDialog, {
        catalog: getCatalogSync("en"),
        fetchProjection: async () => ({ items: [], nextCursor: null }),
      }),
    );
    await user.click(screen.getByRole("button", { name: "What Changed" }));
    await waitFor(() => expect(screen.getByText("No new changes yet.")).toBeInTheDocument());
  });

  it("replays missed receipts once after browser offline and online recovery", async () => {
    const projections = [
      { items: [receipt("1")], nextCursor: "1" },
      { items: [receipt("2")], nextCursor: "2" },
    ];
    let handlers: import("./what-changed-dialog.js").ExperienceStreamHandlers | undefined;
    const user = userEvent.setup();
    render(
      createElement(whatChanged.WhatChangedDialog, {
        catalog: getCatalogSync("en"),
        connectStream: (input) => {
          handlers = input.handlers;
          input.handlers.onReady();
          return { close: () => undefined };
        },
        fetchProjection: async () => projections.shift() ?? { items: [], nextCursor: "2" },
        probeSession: async () => "active" as const,
        streamEnabled: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "What Changed" }));
    await waitFor(() =>
      expect(screen.getByText("Saved to your private Inbox")).toBeInTheDocument(),
    );

    window.dispatchEvent(new Event("offline"));
    expect(
      await screen.findByText("Connection paused. Your receipts are safe."),
    ).toBeInTheDocument();
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(screen.getAllByText("Saved to your private Inbox")).toHaveLength(2));

    await handlers?.onChange("2");
    expect(screen.getAllByText("Saved to your private Inbox")).toHaveLength(2);
  });

  it("stops reconnecting and offers sign-in when the session expires", async () => {
    let handlers: import("./what-changed-dialog.js").ExperienceStreamHandlers | undefined;
    const user = userEvent.setup();
    render(
      createElement(whatChanged.WhatChangedDialog, {
        catalog: getCatalogSync("en"),
        connectStream: (input) => {
          handlers = input.handlers;
          return { close: () => undefined };
        },
        fetchProjection: async () => ({ items: [], nextCursor: null }),
        probeSession: async () => "unauthorized" as const,
        streamEnabled: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "What Changed" }));
    await waitFor(() => expect(handlers).toBeDefined());
    await handlers?.onError();

    expect(
      await screen.findByText("Your session ended. Sign in to reconnect."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/api/auth/login",
    );
  });

  it("stops live recovery when the current user was deactivated", async () => {
    let handlers: import("./what-changed-dialog.js").ExperienceStreamHandlers | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          active: false,
          userId: "80000000-0000-4000-8000-000000000009",
        }),
      ),
    );
    const user = userEvent.setup();
    render(
      createElement(whatChanged.WhatChangedDialog, {
        catalog: getCatalogSync("en"),
        connectStream: (input) => {
          handlers = input.handlers;
          return { close: () => undefined };
        },
        fetchProjection: async () => ({ items: [], nextCursor: null }),
        streamEnabled: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "What Changed" }));
    await waitFor(() => expect(handlers).toBeDefined());
    await handlers?.onError();

    expect(
      await screen.findByText("Your session ended. Sign in to reconnect."),
    ).toBeInTheDocument();
  });

  it("discloses live delivery without motion when reduced motion is requested", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        removeEventListener: vi.fn(),
      })),
    );
    const user = userEvent.setup();
    render(
      createElement(whatChanged.WhatChangedDialog, {
        catalog: getCatalogSync("en"),
        connectStream: () => ({ close: () => undefined }),
        fetchProjection: async () => ({ items: [], nextCursor: null }),
        streamEnabled: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "What Changed" }));

    expect(await screen.findByText("Live updates appear without motion.")).toBeInTheDocument();
  });

  it("retries one failed replay and shows the recovered receipt exactly once", async () => {
    const fetchProjection = vi
      .fn()
      .mockResolvedValueOnce({ items: [receipt("1")], nextCursor: "1" })
      .mockRejectedValueOnce(new Error("transient reader outage"))
      .mockResolvedValueOnce({ items: [receipt("2")], nextCursor: "2" });
    const handlers: import("./what-changed-dialog.js").ExperienceStreamHandlers[] = [];
    const connectStream = vi.fn((input) => {
      handlers.push(input.handlers);
      input.handlers.onReady();
      return { close: () => undefined };
    });
    const user = userEvent.setup();
    render(
      createElement(whatChanged.WhatChangedDialog, {
        catalog: getCatalogSync("en"),
        connectStream,
        fetchProjection,
        probeSession: async () => "active" as const,
        streamEnabled: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "What Changed" }));
    await waitFor(() => expect(handlers).toHaveLength(1));
    vi.useFakeTimers();
    await act(async () => handlers[0]!.onChange("2"));
    expect(screen.getByText("Reconnecting. Your receipts are safe.")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(1_500));
    expect(screen.getAllByText("Saved to your private Inbox")).toHaveLength(2);
    await act(async () => handlers.at(-1)!.onChange("2"));
    expect(screen.getAllByText("Saved to your private Inbox")).toHaveLength(2);
    expect(connectStream).toHaveBeenCalledTimes(2);
  });

  it("reopens live delivery after an explicit refresh recovers", async () => {
    const fetchProjection = vi
      .fn()
      .mockRejectedValueOnce(new Error("reader unavailable"))
      .mockResolvedValueOnce({ items: [receipt("1")], nextCursor: "1" });
    const connectStream = vi.fn(() => ({ close: () => undefined }));
    const user = userEvent.setup();
    render(
      createElement(whatChanged.WhatChangedDialog, {
        catalog: getCatalogSync("en"),
        connectStream,
        fetchProjection,
        streamEnabled: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "What Changed" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Refresh changes" }));

    expect(await screen.findByText("Saved to your private Inbox")).toBeInTheDocument();
    expect(connectStream).toHaveBeenCalledOnce();
  });
});

function receipt(cursor: string) {
  return {
    receiptId: `80000000-0000-4000-8000-${cursor.padStart(12, "0")}`,
    cursor,
    type: "user.capture_submitted",
    source: "work_items",
    entityRefs: [],
    occurredAt: "2026-08-12T09:00:00.000Z",
    freshness: {},
    state: "delivered" as const,
  };
}
