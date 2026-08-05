import { expect, test } from "@playwright/test";

import {
  installWorkspaceSession,
  managerAccessToken,
  projectId,
  workstreamId,
} from "./fixtures/workspace.js";

const apiBaseUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}`;
const dogfoodProjectId = "d1111111-1111-4111-8111-111111111111";
const screenshotDirectory = "docs/product/screenshots/ai-first-daily-workspace/slice-5";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context, request }) => {
  const reset = await request.post(`${apiBaseUrl}/__e2e/slice-5/reset`, {
    headers: { "x-e2e-control": "slice-5" },
  });
  expect(reset.status()).toBe(204);
  await installWorkspaceSession(context);
});

test("Project owner reviews, revises, submits, and activates the AI draft", async ({ page }) => {
  await page.goto(`/en/projects/${dogfoodProjectId}/settings/progress-contract`);

  await expect(page.getByText("AI draft — human review required")).toBeVisible();
  await expect(page.getByText("Required quality gate satisfied")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review measurable rules" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activate" })).toHaveCount(0);

  await page.getByRole("button", { name: "Review measurable rules" }).click();
  await page
    .locator('textarea[name="reason"]')
    .fill("Owner clarified the measurable closure rule.");
  await page.getByRole("button", { name: "Save and review" }).click();

  await expect(page.getByText("4 / 4")).toBeVisible();
  await page.locator('textarea[name="reason"]').fill("Create the governed contract draft.");
  await page.getByRole("button", { name: "Apply as contract draft" }).click();
  await expect(
    page.getByRole("button", { name: "Submit contract draft for approval" }),
  ).toBeVisible();

  await page.locator('textarea[name="reason"]').fill("Submit the human-revised rules.");
  await page.getByRole("button", { name: "Submit contract draft for approval" }).click();
  await expect(page.getByRole("button", { name: "Activate approved contract" })).toBeVisible();

  await page.locator('textarea[name="reason"]').fill("Approve the reviewed measurable rules.");
  await page.getByRole("button", { name: "Activate approved contract" }).click();
  await expect(page.getByRole("button", { name: "Active contract" })).toBeDisabled();
  await expect(page.getByText("These rules measure Project delivery only")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/01-en-owner-progress-contract.png`,
  });
});

test("Employee sees operational progress, a quick check-in, and non-scoring readiness", async ({
  page,
}) => {
  await page.goto(`/en/projects/${projectId}/daily-work`);
  await expect(page.getByRole("heading", { name: "Project pulse" })).toBeVisible();
  await expect(
    page.getByText("Five of eight approved, measurable outcomes are now confirmed."),
  ).toBeVisible();
  await expect(
    page.getByText("The last official Project progress remains unchanged"),
  ).toBeVisible();
  await expect(page.getByText("62.5%")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Project pulse" }).getByText("لقطات سطح المكتب والجوال"),
  ).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/02-en-employee-project-pulse.png`,
  });

  await page.goto("/en/my-work");
  await expect(page.getByRole("heading", { name: "Thursday check-in" })).toBeVisible();
  await page.getByRole("button", { name: "Add quick update" }).click();
  const composer = page.getByRole("dialog", { name: "Share a progress update" });
  await expect(composer.locator('select[name="projectId"]')).toHaveValue(projectId);
  await expect(composer.locator('select[name="workstreamId"]')).toHaveValue(workstreamId);
  await expect(composer.getByLabel("What changed?")).toHaveValue(
    "Work continues with no material change.",
  );
  await page.screenshot({
    path: `${screenshotDirectory}/03-en-check-in-update.png`,
  });

  await page.goto(`/en/projects/${projectId}/readiness`);
  await expect(page.getByRole("heading", { name: "Evaluation readiness" })).toBeVisible();
  await expect(
    page.getByText("A source-backed requirement does not yet have a confirmed source."),
  ).toBeVisible();
  await expect(page.getByText("It is not a performance rating, quota, or penalty.")).toBeVisible();
  await expect(page.getByText(/\b\d+(?:\.\d+)?%\b/u)).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/04-en-monthly-readiness.png`,
  });
});

test("Manager sees actionable queues without protected employee scoring fields", async ({
  context,
  page,
  request,
}) => {
  await installWorkspaceSession(context, managerAccessToken);
  const response = await request.get(`${apiBaseUrl}/api/v1/daily-work/manager/operations`, {
    headers: { authorization: `Bearer ${managerAccessToken}` },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(JSON.stringify(Object.keys(body))).not.toMatch(
    /employee|rank|readinessPercentage|productivity|predictedRating|completionRate/iu,
  );

  await page.goto("/en/manager/operations");
  await expect(page.getByRole("heading", { name: "What needs attention" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for approval" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blocked projects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Progress evidence to clarify" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ownership gaps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming commitments" })).toBeVisible();
  await expect(page.getByRole("button", { name: /add update|quick add/iu })).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/05-en-manager-operations.png`,
  });
});

test("Arabic manager operations remain compact, localized, and RTL on mobile", async ({
  context,
  page,
}) => {
  await installWorkspaceSession(context, managerAccessToken);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/manager/operations");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "ما يحتاج إلى الانتباه" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "بانتظار الموافقة" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: `${screenshotDirectory}/06-ar-manager-operations-mobile.png`,
  });
});
