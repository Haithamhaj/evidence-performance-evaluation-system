import { expect, test } from "@playwright/test";

import { installWorkspaceSession, managerAccessToken } from "./fixtures/workspace.js";

test("stable shell keeps the employee's English daily workspace simple", async ({
  context,
  page,
}) => {
  await installWorkspaceSession(context);
  await page.goto("/en/my-work");

  await expect(page.getByRole("link", { name: "Command Brief" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask, search, or capture…" })).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Capture" })).toBeVisible();
  await page.getByRole("button", { name: "Research" }).click();
  await expect(page.getByRole("status")).toHaveText("Available in the next slice");

  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/ai-native-phase-0b/stable-shell-employee-en-desktop.png",
  });
});

test("stable shell exposes manager operations without employee capture", async ({
  context,
  page,
}) => {
  await installWorkspaceSession(context, managerAccessToken);
  await page.goto("/en/manager/operations");

  await expect(page.getByRole("link", { name: "Manager operations" })).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Capture" })).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/ai-native-phase-0b/stable-shell-manager-en-desktop.png",
  });
});

test("stable shell keeps Arabic employee navigation usable at 390px", async ({ context, page }) => {
  await installWorkspaceSession(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/my-work");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("navigation", { name: "موجز العمل" })).toBeVisible();
  await expect(page.getByRole("button", { name: "المزيد" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/ai-native-phase-0b/stable-shell-employee-ar-mobile.png",
  });
});

test("stable shell keeps Arabic manager navigation role-correct at 390px", async ({
  context,
  page,
}) => {
  await installWorkspaceSession(context, managerAccessToken);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/manager/operations");

  await page.getByRole("button", { name: "المزيد" }).click();
  await expect(page.getByRole("link", { name: "عمليات المدير" })).toBeVisible();
  await expect(page.getByRole("button", { name: "إضافة" })).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/ai-native-phase-0b/stable-shell-manager-ar-mobile.png",
  });
});
