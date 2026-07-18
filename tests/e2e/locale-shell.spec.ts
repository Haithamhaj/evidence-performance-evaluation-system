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

for (const path of ["/fr", "/AR"]) {
  test(`rejects unsupported locale ${path} with the Arabic default 404 shell`, async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") hydrationErrors.push(message.text());
    });

    const response = await page.goto(path);

    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("تعذر العثور على الصفحة المطلوبة.")).toBeVisible();
    expect(hydrationErrors.filter((message) => /hydration/iu.test(message))).toEqual([]);
  });
}

for (const expectation of [
  {
    path: "/ar/nope",
    lang: "ar",
    direction: "rtl",
    copy: "تعذر العثور على الصفحة المطلوبة.",
  },
  {
    path: "/en/nope",
    lang: "en",
    direction: "ltr",
    copy: "The requested page was not found.",
  },
] as const) {
  test(`localizes the ${expectation.path} 404 before paint`, async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") hydrationErrors.push(message.text());
    });

    const response = await page.goto(expectation.path);

    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", expectation.lang);
    await expect(page.locator("html")).toHaveAttribute("dir", expectation.direction);
    await expect(page.getByText(expectation.copy)).toBeVisible();
    expect(hydrationErrors.filter((message) => /hydration/iu.test(message))).toEqual([]);
  });
}

test("does not fetch fonts from an external runtime origin", async ({ page }) => {
  const expectedOrigin = `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? "3000"}`;
  const externalFontRequests: string[] = [];
  const localFontResponses = new Map<string, number>();
  page.on("request", (request) => {
    if (request.resourceType() === "font" && new URL(request.url()).origin !== expectedOrigin) {
      externalFontRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/fonts/") && pathname.endsWith(".woff2")) {
      localFontResponses.set(pathname, response.status());
    }
  });

  await page.goto("/ar");
  const fontState = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      arabic: document.fonts.check('16px "Noto Sans Arabic"'),
      latin: document.fonts.check('16px "Inter"'),
    };
  });

  expect(externalFontRequests).toEqual([]);
  expect(Object.fromEntries(localFontResponses)).toEqual({
    "/fonts/Inter-Variable.woff2": 200,
    "/fonts/NotoSansArabic-Variable.woff2": 200,
  });
  expect(fontState).toEqual({ arabic: true, latin: true });
});
