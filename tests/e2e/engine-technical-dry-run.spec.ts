import { expect, test } from "@playwright/test";

import {
  evaluationCycleId,
  installWorkspaceSession,
  managerAccessToken,
  managerEvaluationCycleId,
  projectId,
} from "./fixtures/workspace.js";

test("crosses the complete technical engine boundary without treating the verification UI as final UX", async ({
  context,
  page,
}) => {
  await installWorkspaceSession(context);

  await page.goto("/en/tasks?view=my&layout=list");
  await expect(page.getByRole("heading", { name: /Tasks/u })).toBeVisible();

  await page.goto(`/en/projects/${projectId}/research`);
  await expect(page.getByRole("heading", { name: "Research and experiments" })).toBeVisible();

  await page.goto(`/en/evaluations/${evaluationCycleId}`);
  await expect(page.getByRole("heading", { name: "Final human manager decision" })).toBeVisible();

  await installWorkspaceSession(context, managerAccessToken);
  await page.goto(`/en/manager-feedback/${managerEvaluationCycleId}`);
  await expect(page.getByRole("heading", { name: "Identified manager feedback" })).toBeVisible();

  await installWorkspaceSession(context);
  await page.goto("/en/development");
  await expect(page.getByRole("heading", { name: "Coaching and development" })).toBeVisible();

  await page.goto("/en/continuity");
  await expect(page.getByTestId("continuity-technical-checkpoint")).toBeVisible();

  await page.goto("/en/admin/operations");
  await expect(page.getByTestId("operations-admin-checkpoint")).toBeVisible();

  await page.goto(`/ar/evaluations/${evaluationCycleId}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("evaluation-arabic-gate")).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: "docs/product/screenshots/engine/security-recovery/engine-technical-dry-run-ar.png",
  });
});
