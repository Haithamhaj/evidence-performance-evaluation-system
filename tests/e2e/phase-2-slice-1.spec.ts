import { expect, test } from "@playwright/test";

import { installWorkspaceSession, projectId } from "./fixtures/workspace.js";

test.beforeEach(async ({ context }) => installWorkspaceSession(context));

test("Arabic My Work prioritizes action and opens a visible detail sheet", async ({ page }) => {
  await page.goto("/ar/my-work");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "عملي اليوم" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "قائمة المراجعة" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /يحتاج تدخلي/u })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /اليوم/u })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /متأخر/u })).toBeVisible();
  await page.getByRole("button").filter({ hasText: "Delivery task 1" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "شروط القبول" })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/slice-1/my-work-ar-desktop.png",
  });
});

test("Project dashboard shows contract progress without employee scoring", async ({ page }) => {
  await page.goto(`/ar/projects/${projectId}/daily-work`);
  await expect(page.getByText("تقدم المشروع التشغيلي", { exact: true })).toBeVisible();
  await expect(page.getByText("62.5%")).toBeVisible();
  await expect(page.getByText(/ليس تقييم أداء الموظف/u)).toBeVisible();
  await expect(page.getByText(/ترتيب|إنتاجية|تقييم متوقع/u)).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/slice-1/project-progress-ar-desktop.png",
  });

  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(`/en/projects/${projectId}/daily-work`);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/slice-1/project-progress-en-desktop.png",
  });
});

test("My Work reflows at 390px and preserves bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/my-work");
  await expect(page.getByRole("navigation").getByRole("link", { name: "عملي" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/slice-1/my-work-ar-mobile.png",
  });
});
