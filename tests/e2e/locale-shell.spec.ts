import { expect, test } from "@playwright/test";

test("redirects the root to the Arabic shell before rendering", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/ar$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("renders the supported English shell as LTR", async ({ page }) => {
  await page.goto("/en");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("rejects unsupported locales", async ({ page }) => {
  const response = await page.goto("/fr");

  expect(response?.status()).toBe(404);
});

test("does not fetch fonts from an external runtime origin", async ({ page }) => {
  const externalFontRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "font" &&
      new URL(request.url()).origin !== "http://127.0.0.1:3000"
    ) {
      externalFontRequests.push(request.url());
    }
  });

  await page.goto("/ar");
  await page.evaluate(() => document.fonts.ready);

  expect(externalFontRequests).toEqual([]);
});
