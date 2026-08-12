// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptureDialog } from "./capture-dialog.js";

afterEach(() => cleanup());

describe("CaptureDialog", () => {
  it("labels the private review flow without creating official work", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(CaptureDialog, { catalog, locale: "en", onSaved: vi.fn(), save: vi.fn() }),
    );
    expect(markup).toContain("Capture");
    expect(markup).not.toContain("official Task");
  });

  it("does not render a Capture trigger for a manager-only shell", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(CaptureDialog, {
        catalog,
        disabled: true,
        locale: "en",
        onSaved: vi.fn(),
        save: vi.fn(),
      }),
    );
    expect(markup).toBe("");
  });

  it("opens the capture form and returns focus after Escape", async () => {
    const catalog = await getCatalog("en");
    const user = userEvent.setup();
    render(
      createElement(CaptureDialog, {
        catalog,
        locale: "en",
        onSaved: vi.fn(),
        save: vi.fn(),
      }),
    );
    const trigger = screen.getByRole("button", { name: "Capture" });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Capture privately" });
    expect(dialog.contains(screen.getByRole("textbox", { name: "Capture note" }))).toBe(true);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
