import { expect, test } from "@playwright/test";

test("isolates technical samples as LTR inside the Arabic page", async ({ page }) => {
  await page.goto("/ar");

  for (const kind of ["code", "url", "email", "model", "path", "hash"]) {
    const sample = page.locator(`[data-bidi-kind="${kind}"]`);
    await expect(sample).toHaveAttribute("dir", "ltr");
    await expect(sample).toHaveCSS("direction", "ltr");
  }
});

test("automatically isolates mixed user text without setting page direction", async ({ page }) => {
  await page.goto("/ar");

  const sample = page.locator('[data-bidi-kind="auto-isolate"]');
  await expect(sample).not.toHaveAttribute("dir", /.+/u);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
