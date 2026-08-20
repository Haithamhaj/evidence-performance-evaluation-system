import { expect, test } from "@playwright/test";

import { installWorkspaceSession, managerAccessToken } from "../fixtures/workspace.js";

const screenshotDirectory = "docs/product/screenshots/ai-native-phase-1";
const rollbackMode = process.env.AI_NATIVE_ACCEPTANCE_ROLLBACK === "true";

test("employee completes the bounded daily capture, receipt, Work, and source-review journey", async ({
  context,
  page,
  request,
}) => {
  test.skip(rollbackMode, "The rollback server intentionally disables the Phase 1 surfaces.");
  await request.post(`http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}/__e2e/context/reset`, {
    headers: { "x-e2e-control": "context-intelligence" },
  });
  await request.post(`http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}/__e2e/slice-4/reset`, {
    headers: { "x-e2e-control": "slice-4" },
  });
  await request.post(
    `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}/__e2e/slice-4/github-events`,
    {
      data: { matchedRuleIds: ["contract-rule-1"] },
      headers: { "x-e2e-control": "slice-4" },
    },
  );
  await installWorkspaceSession(context);
  await page.goto("/en/my-work");

  await expect(page.getByRole("heading", { level: 1, name: "Your daily brief" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Source review" })).toBeVisible();

  await page.getByRole("button", { exact: true, name: "Capture" }).click();
  const capture = page.getByRole("dialog", { name: "Capture privately" });
  await capture.getByLabel("Capture note").fill("Confirm the Phase 1 route decision");
  await capture.getByRole("button", { name: "Review and save privately" }).click();
  await expect(
    capture.getByText(/does not create a Task, Update, Evidence record/iu),
  ).toBeVisible();
  await capture.getByRole("button", { name: "Save privately" }).click();
  await expect(page.getByText("Saved to your private Inbox.", { exact: true })).toBeVisible();
  await capture.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "What Changed" }).click();
  const changed = page.getByRole("dialog", { name: "What Changed" });
  await expect(changed.getByText("Saved to your private Inbox")).toBeVisible();
  await expect(changed.getByText("Work")).toBeVisible();
  await changed.getByRole("button", { name: "Close" }).click();

  await page.getByRole("link", { name: "Work" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Work" })).toBeVisible();
  await page.getByPlaceholder("What needs to be done?").fill("Review Phase 1 acceptance evidence");
  await page.getByRole("button", { name: "Create task" }).click();
  const taskDetail = page.getByRole("dialog", { name: "Task details" });
  await expect(taskDetail.getByText("Review Phase 1 acceptance evidence")).toBeVisible();
  await expect(taskDetail.getByLabel("New status")).toHaveValue("ready");
  await taskDetail.getByRole("button", { name: "Change status" }).click();
  await expect(taskDetail.getByText("Ready")).toBeVisible();

  await page.goto("/en/my-work");
  const sourceReview = page.getByRole("region", { name: "Source review" });
  await expect(sourceReview.getByText("[Synthetic] Project decision")).toBeVisible();
  await sourceReview.getByRole("button", { name: /Required checks passed/u }).click();
  const sourceDecision = page.getByRole("dialog", { name: /Required checks passed/u });
  await expect(sourceDecision.getByLabel("Project")).toBeDisabled();
  await sourceDecision.getByRole("button", { name: "Confirm Project link" }).click();
  await sourceDecision.getByRole("button", { name: "Review as evidence" }).click();
  const evidence = page.getByRole("dialog", { name: "Review evidence" });
  await evidence.getByLabel("Contribution context").fill("Verified the acceptance result.");
  await evidence.getByRole("button", { name: "Create review draft" }).click();
  await expect(evidence.getByRole("button", { name: "Confirm evidence" })).toBeDisabled();
  await evidence.getByRole("button", { name: "Save my edits" }).click();
  await evidence.getByRole("button", { name: "Confirm evidence" }).click();
  await expect(page.getByRole("status")).toContainText("Evidence confirmed by you");
  await expect(page.getByRole("status")).toContainText(
    "No Project progress or employee evaluation changed.",
  );

  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/t094-employee-complete.png`,
  });
});

test("manager shell cannot browse or create employee-private source context", async ({
  context,
  page,
}) => {
  test.skip(rollbackMode, "The rollback server intentionally disables the Phase 1 surfaces.");
  await installWorkspaceSession(context, managerAccessToken);
  await page.goto("/en/my-work");

  await expect(page).toHaveURL(/\/en\/manager\/operations$/u);
  await expect(page.getByRole("link", { name: "Manager operations" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "What needs attention" })).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Capture" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Source review" })).toHaveCount(0);
  await expect(page.getByText("[Synthetic] Project decision")).toHaveCount(0);

  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/t094-manager-safe-shell.png`,
  });
});

test("Phase 1 rollback restores retained Today, Work, source, and explicit receipt paths", async ({
  context,
  page,
}) => {
  test.skip(!rollbackMode, "This proof runs against the explicit Phase 1 rollback configuration.");
  await installWorkspaceSession(context);
  await page.goto("/en/my-work");

  await expect(page.getByRole("heading", { level: 1, name: "My Work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Project pulse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quick capture" })).toBeVisible();
  await page.getByRole("button", { name: "What Changed" }).click();
  await expect(page.getByRole("button", { name: "Refresh changes" })).toBeVisible();

  await page.goto("/en/tasks");
  await expect(page.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Board" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calendar" })).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/t094-retained-routes.png`,
  });
});
