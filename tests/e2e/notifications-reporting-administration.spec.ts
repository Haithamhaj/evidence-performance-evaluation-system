import { expect, test } from "@playwright/test";

test("renders notification and administration checkpoints in both directions", async ({ page }) => {
  await page.goto("/ar/notifications");
  await expect(page.getByTestId("operations-notifications-checkpoint")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText(/لا تسجل الإشعارات نقاطاً/u)).toBeVisible();

  await page.goto("/en/admin/operations");
  await expect(page.getByTestId("operations-admin-checkpoint")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByText(/cannot evaluate employees/u)).toBeVisible();
});
