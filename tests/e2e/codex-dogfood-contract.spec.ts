import { expect, test } from "@playwright/test";

import { installWorkspaceSession } from "./fixtures/workspace.js";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ context }) => installWorkspaceSession(context));

test("Codex reviews the real Project contract proposal in English", async ({ page }) => {
  await page.goto("/en/projects");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Evidence Performance System — Phase 2" })
    .getByRole("link", { name: "Open project" })
    .click();
  await page.getByRole("link", { name: "Open progress and daily work" }).click();

  await expect(page.getByText("AI draft — human review required")).toBeVisible();
  await expect(page.getByText("Required quality gate satisfied")).toBeVisible();
  await expect(page.getByLabel("Calculation rule")).toHaveValue("stage_gate");
  await expect(page.getByRole("button", { name: "Apply as contract draft" })).toBeVisible();
  await expect(page.getByText(/rating|productivity|ranking/iu)).toHaveCount(0);
});

test("Arabic mobile review preserves RTL and the protected activation boundary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/projects");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Evidence Performance System — Phase 2" })
    .getByRole("link", { name: "فتح المشروع" })
    .click();
  await page.getByRole("link", { name: "فتح التقدم والعمل اليومي" }).click();

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("مسودة ذكاء اصطناعي — المراجعة البشرية مطلوبة")).toBeVisible();
  await expect(page.getByText("Required quality gate satisfied")).toBeVisible();
  await expect(page.getByRole("button", { name: "تطبيقها كمسودة عقد" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});
