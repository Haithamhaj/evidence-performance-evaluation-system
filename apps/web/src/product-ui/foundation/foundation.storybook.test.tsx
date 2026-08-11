import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import axe from "axe-core";
import { createElement } from "react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";

import "../../app/globals.css";

import { Foundation } from "./foundation.stories.tsx";

afterEach(async () => {
  cleanup();
  await page.viewport(1280, 900);
});

describe("Command Brief Storybook browser foundation", () => {
  it("renders the English decision-first desktop state without accessibility violations", async () => {
    await page.viewport(1280, 900);
    render(createElement(Foundation, { locale: "en", state: "ready" }));

    expect(screen.getByRole("heading", { level: 1, name: "Good morning, Codex" })).toBeVisible();
    expect(screen.getByText("Needs Your Decision")).toBeVisible();
    expect((await axe.run(document.body)).violations).toEqual([]);
  });

  it("supports Arabic RTL dialog focus, Escape, and focus return", async () => {
    render(createElement(Foundation, { locale: "ar", state: "ready" }));
    const user = userEvent.setup();
    const review = screen.getByRole("button", { name: "مراجعة المسودة" });

    await user.click(review);
    const dialog = screen.getByRole("dialog", { name: "مراجعة تحديث المشروع" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.querySelector('[dir="rtl"]')).not.toBeNull();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(document.activeElement).toBe(review));
  });

  it("fits the 390px mobile viewport and preserves the primary action", async () => {
    await page.viewport(390, 844);
    render(createElement(Foundation, { locale: "en", state: "ready" }));

    expect(screen.getByRole("button", { name: "Confirm" })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });

  it("shows loading, empty, and recoverable error states", async () => {
    const { rerender } = render(createElement(Foundation, { locale: "en", state: "loading" }));
    expect(screen.getByLabelText("Loading").getAttribute("aria-busy")).toBe("true");

    rerender(createElement(Foundation, { key: "empty", locale: "en", state: "empty" }));
    expect(screen.getByText("Nothing needs your action")).toBeVisible();

    rerender(createElement(Foundation, { key: "error", locale: "en", state: "error" }));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Needs Your Decision")).toBeVisible();
  });

  it("ships high-contrast and reduced-motion browser policies", () => {
    render(createElement(Foundation, { locale: "en", state: "ready" }));
    const css = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .map((rule) => rule.cssText)
      .join(" ");

    expect(css).toContain("prefers-reduced-motion");
    expect(css).toMatch(/prefers-contrast|forced-colors/u);
  });
});
