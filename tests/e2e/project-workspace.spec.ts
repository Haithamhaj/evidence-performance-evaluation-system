import { expect, test } from "@playwright/test";

import { installWorkspaceSession, projectId, workstreamId } from "./fixtures/workspace.js";

test.beforeEach(async ({ context }) => installWorkspaceSession(context));

test("renders the Arabic project workspace with operational-only readiness", async ({ page }) => {
  await page.goto("/ar/projects");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { level: 1, name: "مشاريعي ومسارات العمل" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "فتح المشروع" }).click();
  await expect(page).toHaveURL(`/ar/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: "الأشخاص الحاليون" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "مسارات العمل" })).toBeVisible();
  await expect(page.getByRole("link", { name: "فتح مسار العمل" })).toHaveAttribute(
    "href",
    `/ar/projects/${projectId}/workstreams/${workstreamId}`,
  );
  await expect(page.getByText("يحتاج إلى انتباه")).toBeVisible();
  await expect(page.getByText("private correction")).toHaveCount(0);
  await expect(page.getByText(/percentage|ranking|rating/iu)).toHaveCount(0);
});

test("preserves the project resource when switching to English", async ({ page }) => {
  await page.goto(`/ar/projects/${projectId}`);
  await page.getByRole("link", { name: "English" }).click();

  await expect(page).toHaveURL(`/en/projects/${projectId}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Current people" })).toBeVisible();
});

test("fits the project list in a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/projects");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
