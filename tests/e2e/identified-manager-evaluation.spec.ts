import { expect, test } from "@playwright/test";

import {
  installWorkspaceSession,
  managerAccessToken,
  managerEvaluationCycleId,
} from "./fixtures/workspace.js";

test("assigned manager sees immediate named originals and leave-aware completion", async ({
  context,
  page,
}) => {
  await installWorkspaceSession(context, managerAccessToken);
  await page.goto(`/en/manager-feedback/${managerEvaluationCycleId}`);
  await expect(page.getByRole("heading", { name: "Identified manager feedback" })).toBeVisible();
  await expect(page.getByText("Sarah Ahmed")).toBeVisible();
  await expect(page.getByText("Priorities were clear during the delivery period.")).toBeVisible();
  await expect(page.getByText("Approved leave")).toBeVisible();
  await expect(page.getByText(/anonymous|confidential/iu)).toHaveCount(0);
});

test("Arabic keeps RTL and gates the unapproved manager rubric", async ({ context, page }) => {
  await installWorkspaceSession(context, managerAccessToken);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ar/manager-feedback/${managerEvaluationCycleId}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("manager-feedback-arabic-gate")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "محتوى معايير تقييم المدير بالعربية غير متاح" }),
  ).toBeVisible();
  await expect(page.getByTestId("manager-feedback-identified-view")).toHaveCount(0);
});
