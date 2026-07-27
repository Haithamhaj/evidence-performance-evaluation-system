import { expect, test } from "@playwright/test";

import {
  installWorkspaceSession,
  managerAccessToken,
  otherEmployeeAccessToken,
  projectId,
} from "./fixtures/workspace.js";

const gmailTitle = "[Synthetic] Project decision";
const gmailSummary = "A deterministic local summary for owner-only review.";
const gmailSourceUrl = "https://mail.google.com/mail/u/0/#inbox/synthetic-gmail-project-decision";
const calendarTitle = "[Synthetic] Project review";
const calendarSummary = "A deterministic local calendar summary for owner-only review.";
const calendarSourceUrl =
  "https://calendar.google.com/calendar/event?eid=synthetic-calendar-project-review";
const screenshotDirectory = "docs/product/screenshots/ai-first-daily-workspace/slice-2";

test.beforeEach(async ({ context }) => installWorkspaceSession(context));

test("employee privately reviews, excludes, restores, links, and unlinks synthetic context", async ({
  page,
}) => {
  await ensureOwnerConnected(page);
  const taskWrites: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/daily-work/work-items")) {
      taskWrites.push(request.url());
    }
  });

  const tasksBefore = await readTaskWorkspace(page);
  await page.goto("/en/my-work");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Private workspace context" })).toBeVisible();
  await expect(page.getByText("Synthetic local data")).toBeVisible();
  await expect(page.getByText(gmailSummary)).toBeVisible();
  await expect(page.getByText(calendarSummary)).toBeVisible();

  await openSourceReview(page, gmailTitle);
  const review = page.getByRole("dialog");
  await expect(review.getByText("Private to you")).toBeVisible();
  await expect(review.getByText(gmailSummary)).toBeVisible();
  await expect(review.getByRole("link", { name: "Open source" })).toHaveAttribute(
    "href",
    gmailSourceUrl,
  );
  await page.screenshot({
    path: `${screenshotDirectory}/01-en-context-review-desktop.png`,
  });

  await review.getByRole("button", { name: "Exclude this source" }).click();
  await expect(review.getByRole("button", { name: "Restore this source" })).toBeVisible();
  await page.screenshot({
    path: `${screenshotDirectory}/02-en-context-excluded-desktop.png`,
  });
  await closeReview(page);
  await page.reload();
  await openSourceReview(page, gmailTitle);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Restore this source" }),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Restore this source" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Exclude this source" }),
  ).toBeVisible();

  await page.getByRole("dialog").getByLabel("Link to Project").selectOption(projectId);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /Unlink from/u }),
  ).toBeVisible();
  await closeReview(page);
  await page.reload();
  const linkedRow = page.getByRole("button", {
    name: new RegExp(escapePattern(gmailTitle), "u"),
  });
  await expect(linkedRow.getByText("Atlas Delivery", { exact: true })).toBeVisible();
  await openSourceReview(page, gmailTitle);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /Unlink from/u }),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshotDirectory}/03-en-context-project-linked-reload-desktop.png`,
  });

  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Unlink from/u })
    .click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /Unlink from/u })).toHaveCount(
    0,
  );
  await closeReview(page);
  await page.reload();
  const unlinkedRow = page.getByRole("button", {
    name: new RegExp(escapePattern(gmailTitle), "u"),
  });
  await expect(unlinkedRow.getByText("Atlas Delivery", { exact: true })).toHaveCount(0);
  await openSourceReview(page, gmailTitle);
  await expect(page.getByRole("dialog").getByRole("button", { name: /Unlink from/u })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: `${screenshotDirectory}/04-en-context-project-unlinked-reload-desktop.png`,
  });
  await closeReview(page);

  const tasksAfter = await readTaskWorkspace(page);
  expect(tasksAfter.items.map(({ id }) => id)).toEqual(tasksBefore.items.map(({ id }) => id));
  expect(taskWrites).toEqual([]);
  const sharedTaskProjection = JSON.stringify(tasksAfter);
  for (const privateValue of [
    gmailTitle,
    gmailSummary,
    gmailSourceUrl,
    calendarTitle,
    calendarSummary,
    calendarSourceUrl,
  ]) {
    expect(sharedTaskProjection).not.toContain(privateValue);
  }
});

test("manager and another employee receive no private source or link projection", async ({
  browser,
}) => {
  for (const accessToken of [managerAccessToken, otherEmployeeAccessToken]) {
    const context = await browser.newContext();
    await installWorkspaceSession(context, accessToken);
    const response = await context.request.get("/api/workspace/connected-work/items");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      mode: "synthetic",
      synthetic: true,
      connection: { status: "disconnected", lastSuccessfulSyncAt: null },
      items: [],
    });
    const projection = JSON.stringify(body);
    for (const privateValue of [
      gmailTitle,
      gmailSummary,
      gmailSourceUrl,
      calendarTitle,
      calendarSummary,
      calendarSourceUrl,
      "GOOGLE_GMAIL",
      "GOOGLE_CALENDAR",
      "providerSourceId",
      "projectId",
    ]) {
      expect(projection).not.toContain(privateValue);
    }
    await context.close();
  }
});

test("Arabic private review is RTL and behaves as a 390px bottom sheet", async ({ page }) => {
  await ensureOwnerConnected(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/my-work");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const calendarRow = page.getByRole("button", {
    name: new RegExp(escapePattern(calendarTitle), "u"),
  });
  await expect(calendarRow.locator("strong")).toHaveAttribute("dir", "auto");
  await expect(calendarRow.getByText(calendarSummary)).toHaveAttribute("dir", "auto");
  await openSourceReview(page, calendarTitle);
  const review = page.getByRole("dialog");
  await expect(review.getByRole("heading", { name: calendarTitle })).toHaveAttribute("dir", "auto");
  await expect(review.getByText("خاص بك فقط")).toBeVisible();
  await expect(review.getByText(calendarSummary)).toHaveAttribute("dir", "auto");
  await expect(review.getByRole("link", { name: "فتح المصدر" })).toHaveAttribute(
    "href",
    calendarSourceUrl,
  );
  const box = await review.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(Math.abs(box!.y + box!.height - 844)).toBeLessThanOrEqual(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: `${screenshotDirectory}/05-ar-context-review-mobile.png`,
  });
});

test("disconnect immediately removes the employee private review projection", async ({ page }) => {
  await ensureOwnerConnected(page);
  await page.goto("/en/settings/connections");
  await page.getByRole("button", { name: "Disconnect and delete private context" }).click();
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Google Workspace" })).toBeVisible();
  await page.screenshot({
    path: `${screenshotDirectory}/06-en-google-workspace-disconnected-desktop.png`,
  });

  const response = await page.request.get("/api/workspace/connected-work/items");
  expect(await response.json()).toEqual({
    mode: "synthetic",
    synthetic: true,
    connection: { status: "disconnected", lastSuccessfulSyncAt: null },
    items: [],
  });
  await page.goto("/en/my-work");
  await expect(page.getByText(gmailTitle)).toHaveCount(0);
  await expect(page.getByText(calendarTitle)).toHaveCount(0);
});

async function ensureOwnerConnected(page: import("@playwright/test").Page): Promise<void> {
  const current = await page.request.get("/api/workspace/connected-work/items");
  expect(current.status()).toBe(200);
  const currentBody = (await current.json()) as {
    readonly connection: { readonly status: "connected" | "disconnected" };
  };
  await page.goto("/en/settings/connections");
  if (currentBody.connection.status === "disconnected") {
    await page.getByRole("button", { name: "Connect Google Workspace" }).click();
  }
  await expect(
    page.getByRole("button", { name: "Disconnect and delete private context" }),
  ).toBeVisible();
}

async function openSourceReview(
  page: import("@playwright/test").Page,
  title: string,
): Promise<void> {
  await page.getByRole("button", { name: new RegExp(escapePattern(title), "u") }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: title })).toBeVisible();
}

async function closeReview(page: import("@playwright/test").Page): Promise<void> {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Close|إغلاق/u })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function readTaskWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/en/tasks?view=my&layout=list");
  await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
  const items = await page.locator("[data-task-id]").evaluateAll((entries) =>
    entries.map((entry) => ({
      id: entry.getAttribute("data-task-id") ?? "",
    })),
  );
  return { items, visibleText: await page.locator("main").innerText() };
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
