import { expect, test } from "@playwright/test";

import {
  evaluationCycleId,
  installWorkspaceSession,
  managerAccessToken,
  otherEmployeeAccessToken,
} from "./fixtures/workspace.js";

const apiBaseUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}`;
const journeyPath = `/en/evaluations/${evaluationCycleId}`;
const screenshotDirectory = "docs/product/screenshots/engine/employee-evaluation";

test.beforeEach(async ({ context }) => {
  await installWorkspaceSession(context);
});

test("employee verifies the closed evaluation journey with facts before interpretation", async ({
  page,
}) => {
  await page.goto(journeyPath);

  await expect(page.getByRole("heading", { name: "Employee evaluation cycle" })).toBeVisible();
  await expect(page.getByText("Calibration — Non-Baseline.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evaluation Fact View" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Employee interpretation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comparison and discussion" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Final human manager decision" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acknowledgment or reservation" })).toBeVisible();
  await expect(
    page.getByText("Employee asked that delivery constraints remain on record."),
  ).toBeVisible();
  await expect(page.getByText("Closed and preserved immutably")).toBeVisible();

  const factsTop = await page
    .locator("#evaluation-facts-title")
    .evaluate((element) => element.getBoundingClientRect().top);
  const interpretationTop = await page
    .getByRole("heading", { name: "Employee interpretation" })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(factsTop).toBeLessThan(interpretationTop);
  await expect(page.getByText(/recommended rating|employee rank|productivity score/iu)).toHaveCount(
    0,
  );

  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/01-en-employee-closed-cycle.png`,
  });
});

test("assigned manager is separately authenticated while unrelated employees are denied", async ({
  context,
  page,
  request,
}) => {
  const endpoint = `${apiBaseUrl}/api/v1/employee-evaluation/cycles/${evaluationCycleId}/journey`;
  const managerResponse = await request.get(endpoint, {
    headers: { authorization: `Bearer ${managerAccessToken}` },
  });
  const deniedResponse = await request.get(endpoint, {
    headers: { authorization: `Bearer ${otherEmployeeAccessToken}` },
  });
  expect(managerResponse.status()).toBe(200);
  expect((await managerResponse.json()).audience).toBe("assigned_manager");
  expect(deniedResponse.status()).toBe(403);

  await installWorkspaceSession(context, managerAccessToken);
  await page.goto(journeyPath);
  await expect(
    page.getByText(
      "The manager initial assessment was submitted before the employee projection opened.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Final human manager decision" })).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/02-en-assigned-manager-closed-cycle.png`,
  });
});

test("Arabic uses an RTL shell and explicitly gates the unapproved rubric", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ar/evaluations/${evaluationCycleId}`);

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("evaluation-arabic-gate")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "محتوى معايير التقييم العربية غير متاح" }),
  ).toBeVisible();
  await expect(page.getByTestId("evaluation-journey")).toHaveCount(0);

  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/03-ar-rubric-unavailable-rtl.png`,
  });
});
