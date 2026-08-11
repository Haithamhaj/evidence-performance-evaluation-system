// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useReducedMotionConfig } from "motion/react";
import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ActionButton } from "./actions/action-button.tsx";
import { ProductDisclosure } from "./disclosure/product-disclosure.tsx";
import { FocusedDialog } from "./overlays/focused-dialog.tsx";
import { SemanticMotionProvider } from "./motion/semantic-motion.tsx";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      matches: query === "(prefers-reduced-motion)",
      media: query,
      removeEventListener: vi.fn(),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => cleanup());

function ReducedMotionProbe() {
  const reducedMotion = useReducedMotionConfig();
  return createElement("output", null, String(reducedMotion));
}

describe("accessible primitive browser compatibility", () => {
  it("hydrates React 19 server output without a warning", async () => {
    const element = createElement(ActionButton, { children: "تأكيد", variant: "primary" });
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.append(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const root = hydrateRoot(container, element);
    await act(async () => undefined);

    expect(consoleError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("تأكيد");
    await act(async () => root.unmount());
    container.remove();
    consoleError.mockRestore();
  });

  it("supports keyboard activation and blocks disabled actions", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      createElement(
        "div",
        null,
        createElement(ActionButton, { children: "تنفيذ", onPress }),
        createElement(ActionButton, { children: "غير متاح", isDisabled: true, onPress }),
      ),
    );

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "تنفيذ" }));
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "غير متاح" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("traps dialog focus, closes with Escape, and returns focus in RTL", async () => {
    const user = userEvent.setup();
    render(
      createElement(
        "main",
        { dir: "rtl" },
        createElement(FocusedDialog, {
          closeLabel: "إغلاق",
          title: createElement("span", { dir: "auto" }, "مراجعة API v1"),
          trigger: createElement(ActionButton, { children: "فتح المراجعة" }),
          children: createElement(ActionButton, { children: "تأكيد القرار" }),
        }),
      ),
    );
    const trigger = screen.getByRole("button", { name: "فتح المراجعة" });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "مراجعة API v1" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.body.querySelector('[dir="rtl"]')).not.toBeNull();

    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("exposes Arabic disclosure semantics and propagates reduced motion", async () => {
    const user = userEvent.setup();
    render(
      createElement(
        SemanticMotionProvider,
        null,
        createElement(
          "div",
          { dir: "rtl" },
          createElement(ProductDisclosure, {
            title: "تفاصيل المشروع",
            children: createElement("span", { dir: "auto" }, "Repository API v1"),
          }),
          createElement(ReducedMotionProbe),
        ),
      ),
    );

    const disclosure = screen.getByRole("button", { name: /تفاصيل المشروع/u });
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    await user.click(disclosure);
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Repository API v1").getAttribute("dir")).toBe("auto");
    expect(screen.getByText("true")).not.toBeNull();
  });
});
