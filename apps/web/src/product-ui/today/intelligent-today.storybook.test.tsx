import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import axe from "axe-core";
import { createElement } from "react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";

import "../../app/globals.css";

import { TodayStory } from "./intelligent-today.stories.tsx";

afterEach(async () => {
  cleanup();
  await page.viewport(1280, 900);
});

describe("Intelligent Today Storybook journey", () => {
  it("keeps the Arabic decision journey RTL, keyboard-operable, and accessible", async () => {
    render(createElement(TodayStory, { locale: "ar" }));
    const user = userEvent.setup();
    const correct = await screen.findByRole("button", { name: "تصحيح" });

    correct.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByLabelText("اختر مشروعًا آخر")).toBeVisible();
    expect(document.querySelector('[dir="rtl"]')).not.toBeNull();
    expect((await axe.run(document.body)).violations).toEqual([]);
  });

  it("fits the 390px Command Brief viewport with the primary decision visible", async () => {
    await page.viewport(390, 844);
    render(createElement(TodayStory, { locale: "en" }));

    expect(await screen.findByRole("button", { name: "Confirm" })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });
});
