import { expect, test } from "@playwright/test";

test("renders the continuity checkpoint in Arabic RTL and English LTR", async ({ page }) => {
  await page.goto("/ar/continuity");
  await expect(page.getByTestId("continuity-technical-checkpoint")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.goto("/en/continuity");
  await expect(page.getByTestId("continuity-technical-checkpoint")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
