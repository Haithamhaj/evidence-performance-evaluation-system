import { expect, test } from "@playwright/test";

import { installWorkspaceSession } from "./fixtures/workspace.js";

test.beforeEach(async ({ context }) => installWorkspaceSession(context));

test("English Task draft survives an authentication interruption", async ({ context, page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "daily-work.task-draft:55555555-5555-4555-8555-555555555555",
      JSON.stringify({
        title: "Another employee's private draft",
        projectId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    window.localStorage.setItem(
      "daily-work.task-draft",
      JSON.stringify({
        title: "Legacy unscoped private draft",
        projectId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });
  await page.goto("/en/tasks");
  await expect(page.getByPlaceholder("What needs to be done?")).toHaveValue("");
  await page.getByPlaceholder("What needs to be done?").fill("Preserve this unsaved Task");
  await context.clearCookies();
  await installWorkspaceSession(context);
  await page.goto("/en/tasks?view=my&layout=list");
  await expect(page.getByPlaceholder("What needs to be done?")).toHaveValue(
    "Preserve this unsaved Task",
  );
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("link", { name: "Team tasks" }).click();
  await expect(page).toHaveURL(/\/en\/tasks\?view=team&layout=list$/u);
  await expect(page.getByRole("link", { name: "Team tasks" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.screenshot({
    path: "docs/product/screenshots/ai-first-daily-workspace/slice-1/02-en-tasks-desktop.png",
  });
});

test("Codex completes the Arabic daily capture-to-Task journey", async ({ page }) => {
  await page.goto("/ar/my-work");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "عملي اليوم" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "تسجيل سريع" })).toBeVisible();

  await page.getByPlaceholder("ما الذي تريد تذكره أو إنجازه؟").fill("تأكيد موعد مراجعة الرحلة");
  await page.getByRole("button", { name: "حفظ" }).click();
  const capture = page.getByText("تأكيد موعد مراجعة الرحلة", { exact: true });
  await expect(capture).toBeVisible();
  await capture.locator("..").getByRole("button", { name: "تحويل إلى مهمة" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("المشروع مطلوب")).not.toHaveValue("");
  await page.getByRole("dialog").getByRole("button", { name: "إنشاء مهمة" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/ar/tasks");
  const taskRow = page.getByRole("button", { name: /تأكيد موعد مراجعة الرحلة/u });
  await expect(taskRow).toBeVisible();
  await taskRow.click();
  const editPanel = page.getByRole("dialog");
  await expect(editPanel).toBeVisible();
  await editPanel.getByLabel("عنوان المهمة").fill("تأكيد موعد مراجعة رحلة الموظف");
  await editPanel.getByRole("button", { name: "حفظ التعديلات" }).click();
  await expect(editPanel.getByLabel("عنوان المهمة")).toHaveValue("تأكيد موعد مراجعة رحلة الموظف");
  await editPanel.getByRole("button", { name: "إغلاق" }).click();
  await expect(page.getByRole("button", { name: /تأكيد موعد مراجعة رحلة الموظف/u })).toBeVisible();
  await page.getByRole("button", { name: "لوحة" }).click();
  await expect(page.getByRole("button", { name: "لوحة" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "تقويم" }).click();
  await expect(page.getByRole("button", { name: "تقويم" })).toHaveAttribute("aria-pressed", "true");

  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/ai-first-daily-workspace/slice-1/01-ar-tasks-desktop.png",
  });
});

test("Arabic Today remains usable at 390px with bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/my-work");
  await expect(page.getByRole("navigation").getByRole("link", { name: "المهام" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: "docs/product/screenshots/ai-first-daily-workspace/slice-1/03-ar-today-mobile.png",
  });
});
