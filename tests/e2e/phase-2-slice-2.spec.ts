import { expect, test } from "@playwright/test";

import { installWorkspaceSession } from "./fixtures/workspace.js";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ context }) => installWorkspaceSession(context));

test("Arabic employee completes multi-turn update, evidence review, confirmation, and Timeline", async ({
  page,
}) => {
  await page.goto("/ar/my-work");
  await page.getByRole("button", { name: "إضافة تحديث" }).first().click();
  await expect(page.getByRole("dialog", { name: "شارك تحديث التقدم" })).toBeVisible();
  await page.getByLabel("ما الذي تغيّر؟").fill("أنجزت العمل المطلوب.");
  await page.getByRole("button", { name: "متابعة" }).click();

  await expect(page.getByRole("heading", { name: "ما النتيجة القابلة للتحقق التي تحققت؟" }))
    .toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/slice-2/clarification-ar-desktop.png",
  });
  await page.getByLabel("إجابتك").fill("نجحت 12 من 12 حالة قبول.");
  await page.getByRole("button", { name: "إجابة ومتابعة" }).click();
  await expect(
    page.getByRole("heading", { name: "ما الدليل الذي يثبت هذه النتيجة وما الخطوة التالية؟" }),
  ).toBeVisible();
  await page.getByLabel("إجابتك").fill("سجل CLI مرفق، والخطوة التالية اعتماد الإغلاق.");
  await page.getByRole("button", { name: "إجابة ومتابعة" }).click();

  await expect(page.getByRole("heading", { name: "راجع تحديثك" })).toBeVisible();
  await expect(
    page.getByText("ارتفعت النتيجة من مسودة غير مكتملة إلى 12 حالة قبول ناجحة."),
  ).toBeVisible();
  await page.getByRole("button", { name: "حفظ مراجعتي" }).click();
  await page.getByRole("button", { name: "إضافة دليل" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("dialog", { name: "مراجعة الدليل" })).toBeVisible();
  await expect(page.getByLabel("الادعاء الذي يدعمه الدليل")).toHaveValue(
    "نجحت 12 من 12 حالة قبول متفق عليها.",
  );
  await expect(page.getByLabel("سياق المساهمة")).toHaveValue(
    "نفذت السيناريوهات وراجعت النتائج.",
  );
  await page.getByLabel("مصدر الدليل").selectOption("cli_snapshot");
  await page.getByLabel("محتوى المصدر").fill("12 passed, 0 failed");
  await page
    .getByLabel("الادعاء الذي يدعمه الدليل")
    .fill("نجحت سيناريوهات القبول المتفق عليها.");
  await page.getByLabel("سياق المساهمة").fill("نفذت السيناريوهات وراجعت سجل الاختبار.");
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/slice-2/evidence-entry-ar-mobile.png",
  });
  await page.getByRole("button", { name: "إنشاء مسودة للمراجعة" }).click();
  await expect(page.getByText(/مراجعتك وتأكيدك إلزاميان/u)).toBeVisible();
  await expect(page.getByLabel("سياق المساهمة")).toHaveValue(
    "نفذت السيناريوهات وراجعت سجل الاختبار.",
  );
  await page.getByRole("button", { name: "حفظ تعديلاتي" }).click();
  await page.getByRole("button", { name: "تأكيد الدليل" }).click();

  await expect(page.getByText("الأدلة المؤكدة: 1")).toBeVisible();
  await page.getByRole("button", { name: "تأكيد التحديث" }).click();
  await expect(page.getByText("تم تأكيد التحديث")).toBeVisible();
  await expect(page.getByText("نجحت سيناريوهات القبول المتفق عليها")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "اكتملت رحلة التحديث والأدلة" }),
  ).toBeVisible();
  await expect(page.getByText(/ترتيب|إنتاجية|تقييم متوقع/u)).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/slice-2/confirmation-timeline-ar-mobile.png",
  });
});

test("English composer preserves the compact daily journey", async ({ page }) => {
  await page.goto("/en/my-work");
  await page.getByRole("button", { name: "Add update" }).first().click();
  await expect(page.getByRole("dialog", { name: "Share a progress update" })).toBeVisible();
  await expect(page.getByLabel("What changed?")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/phase-2-production/slice-2/composer-en-desktop.png",
  });
});
