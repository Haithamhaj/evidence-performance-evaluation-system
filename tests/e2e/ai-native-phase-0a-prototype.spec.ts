import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/?locale=en&state=busy");
});

test("keyboard decision flow confirms a proposal and returns focus", async ({ page }) => {
  const decision = page.getByRole("region", { name: "Needs Your Decision" });
  const confirm = decision.getByRole("button", { name: "Confirm" });

  await confirm.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toContainText("Link confirmed");
  await expect(decision).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo confirmation" })).toBeFocused();
});

test("prepared draft opens, edits, confirms, and returns focus to its trigger", async ({
  page,
}) => {
  const review = page.getByRole("button", { name: "Review draft" });
  await review.click();

  const sheet = page.getByRole("dialog", { name: "Weekly project update draft" });
  await expect(sheet).toBeVisible();
  await sheet
    .getByLabel("Draft update")
    .fill("Authentication fallback validated with Arabic cases.");
  await sheet.getByRole("button", { name: "Confirm update" }).click();

  await expect(sheet).toHaveCount(0);
  await expect(review).toBeFocused();
  await expect(page.getByRole("status")).toContainText("Update confirmed");
});

test("stale state blocks the decision until refresh succeeds", async ({ page }) => {
  await page.getByRole("button", { name: "Preview states" }).click();
  await page.getByRole("menuitem", { name: "Stale source" }).click();

  await expect(page.getByText("This source may be out of date.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm" })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh source" }).click();
  await expect(page.getByText("Source refreshed just now.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm" })).toBeEnabled();
});

test("recoverable error keeps manual work available and retries locally", async ({ page }) => {
  await page.getByRole("button", { name: "Preview states" }).click();
  await page.getByRole("menuitem", { name: "Connection issue" }).click();

  await expect(page.getByText("GitHub context is temporarily unavailable.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue manually" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("status")).toContainText("Connection restored");
  await expect(page.getByText("GitHub context is temporarily unavailable.")).toHaveCount(0);
});

test("clear state stays calm and contains normal navigation", async ({ page }) => {
  await page.getByRole("button", { name: "Preview states" }).click();
  await page.getByRole("menuitem", { name: "Clear" }).click();

  await expect(page.getByRole("heading", { name: "You’re clear right now." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Work" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add something" })).toBeVisible();
});

test("universal capture creates a private Task draft without leaving Today", async ({ page }) => {
  await page.getByRole("button", { name: "Add" }).click();
  const dialog = page.getByRole("dialog", { name: "Capture work" });

  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Task" }).click();
  await dialog.getByLabel("What do you want to capture?").fill("Confirm client fallback window");
  await dialog.getByRole("button", { name: "Save private draft" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Private Task draft saved");
  await expect(page.getByText("Confirm client fallback window")).toBeVisible();
});

test("Arabic mobile layout is RTL, compact, and free of horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?locale=ar&state=busy");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "صباح الخير، Codex" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "التنقل الرئيسي" })).toBeVisible();
  await expect(page.getByRole("button", { name: "إضافة" })).toBeVisible();
  const changedReceipt = page.getByText(/تم دمج PR #182/u);
  await expect(changedReceipt).toBeHidden();
  await page.getByText("ما الذي تغيّر", { exact: true }).click();
  await expect(changedReceipt).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const iconsLoaded = await page
    .locator(".bottom-nav img")
    .evaluateAll((icons) =>
      icons.every(
        (icon) => icon instanceof HTMLImageElement && icon.complete && icon.naturalWidth > 0,
      ),
    );
  expect(iconsLoaded).toBe(true);
});

test("reduced motion is honored and prohibited evaluation language is absent", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/?locale=en&state=busy");

  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator("body")).not.toContainText(
    /productivity score|employee rating|readiness percentage|ranking|P0|P1|P2/iu,
  );
  await context.close();
});

test("role-only navigation remains hidden from an employee", async ({ page }) => {
  await expect(page.getByRole("link", { name: "Manager" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.goto("/?locale=en&state=busy&role=manager");
  await expect(page.getByRole("link", { name: "Manager" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("preview separates prepared-only and local agent-job states", async ({ page }) => {
  await page.getByRole("button", { name: "Preview states" }).click();
  await page.getByRole("menuitem", { name: "Prepared draft" }).click();
  await expect(page.getByRole("region", { name: "Prepared for You" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Needs Your Decision" })).toHaveCount(0);

  await page.getByRole("button", { name: "Preview states" }).click();
  await page.getByRole("menuitem", { name: "Assistant working" }).click();
  await expect(page.getByText("Preparing a source-backed update…")).toBeVisible();
  await expect(page.getByText("You can continue working while this finishes.")).toBeVisible();
});

test("captures the bounded D0 state matrix", async ({ page }) => {
  const directory = "docs/product/screenshots/ai-native-phase-0a";
  const states = ["normal", "busy", "clear", "decision", "prepared", "recovery"];
  await mkdir(directory, { recursive: true });

  for (const locale of ["en", "ar"]) {
    await page.setViewportSize({ width: 1440, height: 1024 });
    for (const state of states) {
      await page.goto(`/?locale=${locale}&state=${state}&role=employee`);
      await page.screenshot({
        fullPage: true,
        path: `${directory}/${locale}-${state}-desktop.png`,
      });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const state of states) {
    await page.goto(`/?locale=ar&state=${state}&role=employee`);
    await page.screenshot({ fullPage: true, path: `${directory}/ar-${state}-mobile.png` });
  }
});
