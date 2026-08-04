import { expect, test } from "@playwright/test";

import {
  installWorkspaceSession,
  managerAccessToken,
  otherEmployeeAccessToken,
  projectId,
} from "./fixtures/workspace.js";

const apiBaseUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}`;
const ownerAccessToken = "e2e-access-token";
const ownerId = "44444444-4444-4444-8444-444444444444";
const contextProjectId = "c1111111-1111-4111-8111-111111111111";
const alternateProjectId = "d1111111-1111-4111-8111-111111111111";
const highConfidenceSourceTitle = "[Synthetic AI] Release decision";
const highConfidenceSourceSummary =
  "The Atlas delivery owner and approved Project term identify one Project.";
const uncertainSourceTitle = "[Synthetic AI] Follow-up with two possible Projects";
const rejectedSourceTitle = "[Synthetic AI] Personal reminder";
const taskSourceTitle = "[Synthetic AI] Acceptance follow-up";
const preparedTaskTitle = "Document the accepted release decision";
const confirmedTaskTitle = "Publish the employee-confirmed release decision";
const rawManualInput = "Manual fallback: preserve this exact source note while AI is unavailable.";
const screenshotDirectory = "docs/product/screenshots/ai-first-daily-workspace/slice-3";

test.beforeEach(async ({ context, request }) => {
  const reset = await request.post(`${apiBaseUrl}/__e2e/context/reset`, {
    headers: { "x-e2e-control": "context-intelligence" },
  });
  expect(reset.status()).toBe(204);
  await installWorkspaceSession(context);
});

test("employee explains, corrects, rejects, and alone confirms an official Task", async ({
  page,
  request,
}) => {
  const tasksBefore = await readOfficialTasks(request);
  const taskConfirmationWrites: string[] = [];
  page.on("request", (browserRequest) => {
    if (
      browserRequest.method() === "POST" &&
      browserRequest.url().endsWith("/api/daily-work/context/task-drafts/confirm")
    ) {
      taskConfirmationWrites.push(browserRequest.url());
    }
  });

  await page.goto("/en/my-work");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Smart review" })).toBeVisible();

  const highConfidenceCard = reviewCard(page, highConfidenceSourceTitle);
  await expect(highConfidenceCard.getByRole("heading", { name: "Atlas Delivery" })).toBeVisible();
  await expect(highConfidenceCard).toContainText("Likely linked because");
  await expect(highConfidenceCard).toContainText(
    "Two independent anchors agree: known Project participant and approved Project term.",
  );
  await highConfidenceCard.getByText("Inspect source context").click();
  await expect(highConfidenceCard.getByText(highConfidenceSourceSummary)).toBeVisible();
  await page.screenshot({
    path: `${screenshotDirectory}/01-en-explainable-link-desktop.png`,
    fullPage: true,
  });
  await highConfidenceCard.getByRole("button", { name: "Confirm link" }).click();
  await expect(reviewCard(page, highConfidenceSourceTitle)).toHaveCount(0);

  const uncertainCard = reviewCard(page, uncertainSourceTitle);
  await expect(
    uncertainCard.getByRole("heading", { name: "Project needs your review" }),
  ).toBeVisible();
  await expect(uncertainCard).toContainText(
    "One Project term matched, but a second independent anchor is missing.",
  );
  const rejectedCard = reviewCard(page, rejectedSourceTitle);
  await expect(rejectedCard).toContainText("No governed Project anchor was found.");
  await page.screenshot({
    path: `${screenshotDirectory}/02-en-uncertain-review-desktop.png`,
    fullPage: true,
  });
  await uncertainCard
    .getByLabel("Choose another Project")
    .selectOption({ label: "Evidence Performance System — Phase 2" });
  await expect(reviewCard(page, uncertainSourceTitle)).toHaveCount(0);
  await rejectedCard.getByRole("button", { name: "Not a Project link" }).click();
  await expect(reviewCard(page, rejectedSourceTitle)).toHaveCount(0);

  const sourcesAfterReview = await readOwnerSources(request);
  expect(sourceProject(sourcesAfterReview, highConfidenceSourceTitle)).toBe(contextProjectId);
  expect(sourceProject(sourcesAfterReview, uncertainSourceTitle)).toBe(alternateProjectId);
  expect(sourceProject(sourcesAfterReview, rejectedSourceTitle)).toBeNull();

  const taskCard = page.locator("article.smartReviewItem").filter({ hasText: preparedTaskTitle });
  await expect(taskCard.getByRole("heading", { name: preparedTaskTitle })).toBeVisible();
  expect(taskConfirmationWrites).toEqual([]);
  expect((await readOfficialTasks(request)).items.map(({ id }) => id)).toEqual(
    tasksBefore.items.map(({ id }) => id),
  );

  await taskCard.getByRole("button", { name: "Review Task draft" }).click();
  const draftSheet = page.getByRole("dialog", { name: "Review prepared Task" });
  await expect(draftSheet.getByText("What will become shared")).toBeVisible();
  await expect(draftSheet.getByText("Assign to you")).toBeVisible();
  await draftSheet.getByText("Inspect source context").click();
  await expect(draftSheet.getByText(taskSourceTitle)).toBeVisible();
  await draftSheet.getByLabel("Task title").fill(confirmedTaskTitle);
  await draftSheet
    .getByLabel("Task description")
    .fill("Record the approved decision and publish the agreed follow-up.");
  await page.screenshot({
    path: `${screenshotDirectory}/03-en-human-confirmation-desktop.png`,
    fullPage: true,
  });

  expect(taskConfirmationWrites).toEqual([]);
  expect((await readOfficialTasks(request)).items.map(({ id }) => id)).toEqual(
    tasksBefore.items.map(({ id }) => id),
  );
  await draftSheet.getByRole("button", { name: "Confirm Task" }).click();
  await expect(draftSheet).toHaveCount(0);
  expect(taskConfirmationWrites).toHaveLength(1);

  const tasksAfter = await readOfficialTasks(request);
  expect(tasksAfter.items).toHaveLength(tasksBefore.items.length + 1);
  const confirmed = tasksAfter.items.find(({ title }) => title === confirmedTaskTitle);
  expect(confirmed).toMatchObject({
    projectId: contextProjectId,
    assigneeId: ownerId,
    title: confirmedTaskTitle,
    description: "Record the approved decision and publish the agreed follow-up.",
  });
  expect(JSON.stringify(confirmed)).not.toContain(taskSourceTitle);
  await page.goto("/en/tasks?view=my&layout=list");
  await expect(
    page.getByRole("button", { name: new RegExp(confirmedTaskTitle, "u") }),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshotDirectory}/04-en-confirmed-task-desktop.png`,
    fullPage: true,
  });
});

test("AI unavailable leaves manual source browsing, linking, and Task completion usable", async ({
  page,
  request,
}) => {
  const disabled = await request.post(`${apiBaseUrl}/__e2e/context/ai-availability`, {
    data: { available: false },
    headers: { "x-e2e-control": "context-intelligence" },
  });
  expect(disabled.status()).toBe(204);

  await page.goto("/en/my-work");
  await expect(page.getByRole("alert").filter({ hasText: "Your prepared draft" })).toContainText(
    "Your prepared draft is still saved. Try again after you sign in.",
  );

  const manualSource = page.getByRole("button", {
    name: /\[Synthetic\] Project decision/u,
  });
  await expect(manualSource).toBeVisible();
  await manualSource.click();
  const sourceDialog = page.getByRole("dialog", { name: "[Synthetic] Project decision" });
  await expect(sourceDialog.getByText("Private to you")).toBeVisible();
  await sourceDialog.getByLabel("Link to Project").selectOption(projectId);
  await expect(sourceDialog.getByRole("button", { name: /Unlink from/u })).toBeVisible();
  await sourceDialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("textbox", { name: "Quick capture" }).fill(rawManualInput);
  await page.getByRole("button", { name: "Save" }).click();
  const capturedRow = page.locator("li").filter({ hasText: rawManualInput });
  await expect(capturedRow).toBeVisible();
  await capturedRow.getByRole("button", { name: "Turn into Task" }).click();
  const manualTaskSheet = page.getByRole("dialog", { name: "Create task" });
  await expect(manualTaskSheet.getByLabel("Task title")).toHaveValue(rawManualInput);
  await manualTaskSheet.getByLabel("Task title").fill("Manual Task completed without AI");
  await manualTaskSheet.getByRole("button", { name: "Create task" }).click();
  await expect(manualTaskSheet).toHaveCount(0);

  const tasks = await readOfficialTasks(request);
  expect(
    tasks.items.find(({ title }) => title === "Manual Task completed without AI"),
  ).toMatchObject({
    projectId,
    assigneeId: ownerId,
    description: rawManualInput,
  });
  expect(sourceProject(await readOwnerSources(request), "[Synthetic] Project decision")).toBe(
    projectId,
  );
  await page.screenshot({
    path: `${screenshotDirectory}/05-en-ai-unavailable-manual-path-desktop.png`,
    fullPage: true,
  });
});

test("manager and another employee receive no private Context Intelligence projection", async ({
  browser,
}) => {
  for (const accessToken of [managerAccessToken, otherEmployeeAccessToken]) {
    const context = await browser.newContext();
    await installWorkspaceSession(context, accessToken);
    const response = await context.request.get("/api/daily-work/context/review-queue");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ items: [], projects: [] });
    const projection = JSON.stringify(body);
    for (const privateValue of [
      highConfidenceSourceTitle,
      highConfidenceSourceSummary,
      uncertainSourceTitle,
      rejectedSourceTitle,
      taskSourceTitle,
      preparedTaskTitle,
      "sourceItemId",
      "employeeId",
      "routeKey",
    ]) {
      expect(projection).not.toContain(privateValue);
    }
    await context.close();
  }
});

test("Arabic smart review uses RTL and a 390px human-review sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/my-work");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const highConfidenceCard = reviewCard(page, highConfidenceSourceTitle);
  await expect(highConfidenceCard).toContainText("يرتبط على الأرجح لأن");
  await highConfidenceCard.getByText("فحص سياق المصدر").click();
  await expect(highConfidenceCard.getByText(highConfidenceSourceSummary)).toHaveAttribute(
    "dir",
    "auto",
  );

  await page
    .locator("article.smartReviewItem")
    .filter({ hasText: preparedTaskTitle })
    .getByRole("button", { name: "مراجعة مسودة المهمة" })
    .click();
  const sheet = page.getByRole("dialog", { name: "مراجعة المهمة المعدّة" });
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(Math.abs(box!.y + box!.height - 844)).toBeLessThanOrEqual(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const taskTitle = sheet.locator("input").first();
  await taskTitle.fill("Accepted release decision");
  await taskTitle.evaluate((input: HTMLInputElement) => {
    input.setSelectionRange(0, 0);
    input.scrollLeft = 0;
    input.blur();
  });
  await page.screenshot({
    path: `${screenshotDirectory}/06-ar-smart-review-mobile.png`,
  });
});

function reviewCard(page: import("@playwright/test").Page, sourceTitle: string) {
  return page.locator("article.smartReviewItem").filter({ hasText: sourceTitle });
}

async function readOfficialTasks(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get(`${apiBaseUrl}/api/v1/work-items?view=my&layout=list`, {
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as {
    readonly items: readonly {
      readonly id: string;
      readonly projectId: string;
      readonly assigneeId: string | null;
      readonly title: string;
      readonly description: string;
    }[];
  };
}

async function readOwnerSources(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get(`${apiBaseUrl}/api/v1/connected-work/items`, {
    headers: { authorization: `Bearer ${ownerAccessToken}` },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as {
    readonly items: readonly {
      readonly title: string;
      readonly projectId: string | null;
    }[];
  };
}

function sourceProject(
  response: Awaited<ReturnType<typeof readOwnerSources>>,
  sourceTitle: string,
): string | null {
  const item = response.items.find(({ title }) => title === sourceTitle);
  expect(item).toBeDefined();
  return item!.projectId;
}
