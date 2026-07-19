import { expect, test } from "@playwright/test";

import { installWorkspaceSession } from "./fixtures/workspace.js";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ context }) => installWorkspaceSession(context));

test("employee completes a Project-only update with draft-first clarification and a readable result", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/en/my-work");
  await page.getByRole("button", { name: "Add update" }).click();
  await expect(page.getByRole("dialog", { name: "Share a progress update" })).toBeVisible();
  await expect(page.getByLabel("Project")).toHaveValue(
    "11111111-1111-4111-8111-111111111111",
  );
  await expect(page.getByLabel("Workstream")).toHaveValue("");
  await expect(page.getByLabel("Work Item")).toHaveValue("");
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/daily-update-correction/01-project-selection-en-desktop.png",
  });

  await page
    .getByLabel("What changed?")
    .fill("Deployment passed the approved acceptance check.");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Current update draft")).toBeVisible();
  await expect(page.getByText("Next detail needed")).toBeVisible();
  await expect(page.getByText("Deployment update recorded.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What verifiable result was achieved?" }),
  ).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/daily-update-correction/02-draft-question-en-desktop.png",
  });

  await page.getByLabel("Your answer").fill("All 12 approved acceptance scenarios passed.");
  await page.getByRole("button", { name: "Answer and continue" }).click();
  await expect(page.getByText("Acceptance check completed.")).toBeVisible();
  await page
    .getByLabel("Your answer")
    .fill("The CLI log is available and client acceptance is the next closure document.");
  await page.getByRole("button", { name: "Answer and continue" }).click();

  await expect(page.getByRole("heading", { name: "Review your update" })).toBeVisible();
  await page.getByRole("button", { name: "Save my review" }).click();
  await page.getByRole("button", { name: "Add evidence" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  const evidenceDialog = page.getByRole("dialog", { name: "Review evidence" });
  await expect(evidenceDialog).toBeVisible();
  await evidenceDialog.getByLabel("Evidence source").selectOption("cli_snapshot");
  await evidenceDialog.getByLabel("Source content").fill("12 passed, 0 failed");
  await evidenceDialog
    .getByLabel("Supported claim")
    .fill("All 12 approved acceptance scenarios passed.");
  await evidenceDialog
    .getByLabel("Contribution context")
    .fill("Ran the approved scenarios and reviewed the CLI result.");
  await evidenceDialog.getByRole("heading", { name: "Review evidence" }).scrollIntoViewIfNeeded();
  await page.screenshot({
    fullPage: false,
    path: "docs/product/screenshots/phase-2-production/daily-update-correction/03-evidence-review-en-mobile.png",
  });
  await page.getByRole("button", { name: "Create review draft" }).click();
  await page.getByRole("button", { name: "Save my edits" }).click();
  await page.getByRole("button", { name: "Confirm evidence" }).click();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Confirm update" }).click();
  await expect(page.getByText("Update confirmed")).toBeVisible();
  await expect(page.getByText("Atlas Delivery")).toBeVisible();
  await expect(page.getByText("All 12 agreed acceptance scenarios passed.")).toBeVisible();
  await expect(page.getByText("Activity timeline")).toBeVisible();
  await expect(page.getByText(/rating|productivity|ranking/iu)).toHaveCount(0);
  await page.screenshot({
    fullPage: false,
    path: "docs/product/screenshots/phase-2-production/daily-update-correction/04-confirmed-result-timeline-en-desktop.png",
  });
});

test("Arabic mobile flow preserves RTL, Project-first scope, and the visible draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/my-work");
  await page.getByRole("button", { name: "إضافة تحديث" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const updateDialog = page.getByRole("dialog", { name: "شارك تحديث التقدم" });
  await expect(updateDialog.getByLabel("المشروع")).toBeVisible();
  await expect(updateDialog.getByLabel("مسار العمل")).toHaveValue("");
  await expect(
    updateDialog.getByRole("combobox", { name: "عنصر العمل", exact: true }),
  ).toHaveValue("");
  await page.screenshot({
    fullPage: false,
    path: "docs/product/screenshots/phase-2-production/daily-update-correction/05-project-selection-ar-mobile.png",
  });

  await page.getByLabel("ما الذي تغيّر؟").fill("اكتمل فحص النشر وفق شروط القبول.");
  await page.getByRole("button", { name: "متابعة" }).click();
  await expect(page.getByText("مسودة التحديث الحالية")).toBeVisible();
  await expect(page.getByText("تم تسجيل تحديث النشر.")).toBeVisible();
  await expect(page.getByLabel("إجابتك")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await updateDialog.getByText("التفصيل التالي المطلوب").scrollIntoViewIfNeeded();
  await page.screenshot({
    fullPage: false,
    path: "docs/product/screenshots/phase-2-production/daily-update-correction/06-draft-question-ar-mobile.png",
  });
});
