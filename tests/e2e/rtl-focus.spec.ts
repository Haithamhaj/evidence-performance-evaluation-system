import { expect, test } from "@playwright/test";

test("RTL keyboard focus follows logical DOM order", async ({ page }) => {
  await page.goto("/ar");

  const expectedFocusOrder = ["brand", "home", "my-work", "projects", "locale", "login"];
  for (const focusId of expectedFocusOrder) {
    await page.keyboard.press("Tab");
    await expect(page.locator(`[data-focus-id="${focusId}"]`)).toBeFocused();
  }
});

test("uses logical CSS properties for the shared shell", async ({ page }) => {
  await page.goto("/ar");

  const main = page.locator("main");
  await expect(main).toHaveCSS("padding-inline-start", "32px");
  await expect(main).toHaveCSS("padding-inline-end", "32px");
});
