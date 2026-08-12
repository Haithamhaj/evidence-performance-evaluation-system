// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { getCatalogSync } from "@evaluation/localization";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createElement } from "react";

import * as whatChanged from "./what-changed-dialog.js";

afterEach(() => cleanup());

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
});
