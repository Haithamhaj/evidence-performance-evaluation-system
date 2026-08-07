import { expect, test } from "@playwright/test";

import { installWorkspaceSession } from "./fixtures/workspace.js";

test("development technical surface preserves employee control and manual recovery", async ({
  context,
  page,
}) => {
  await installWorkspaceSession(context);
  await page.goto("/en/development");
  await expect(page.getByRole("heading", { name: "Coaching and development" })).toBeVisible();
  await expect(page.getByText(/Managers can support shared actions/)).toBeVisible();
  await expect(page.getByText(/create and review a development action manually/)).toBeVisible();
  await expect(page.getByText(/rating|ranking|performance score/i)).toHaveCount(0);
});

test("Arabic development surface keeps RTL without activating Arabic evaluation content", async ({
  context,
  page,
}) => {
  await installWorkspaceSession(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/development");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("coaching-development-checkpoint")).toBeVisible();
});
