import { expect, test } from "@playwright/test";

import {
  evaluationCycleId,
  installWorkspaceSession,
  managerAccessToken,
  otherEmployeeAccessToken,
  ownerId,
} from "./fixtures/workspace.js";

const apiBaseUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}`;
const screenshotDirectory = "docs/product/screenshots/ai-first-daily-workspace/slice-6";
const factPath = `/evaluations/facts?cycle=${evaluationCycleId}&employee=${ownerId}`;

test.beforeEach(async ({ context }) => {
  await installWorkspaceSession(context);
});

test("employee reviews source facts before a clearly separated interpretation", async ({
  page,
}) => {
  await page.goto(`/en${factPath}`);

  await expect(page.getByRole("heading", { name: "Work Fact View" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source-supported work facts" })).toBeVisible();
  await expect(page.getByText("Release acceptance checks completed")).toBeVisible();
  await expect(page.getByText("Codex confirmed this GitHub suggestion")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open source" }).first()).toHaveAttribute(
    "href",
    /^https:\/\/github\.com\//u,
  );

  const sourceTop = await page
    .locator("#source-facts-heading")
    .evaluate((element) => element.getBoundingClientRect().top);
  const interpretationTop = await page
    .locator("#employee-interpretation-heading")
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(sourceTop).toBeLessThan(interpretationTop);
  await expect(page.getByText("This page does not make an assessment decision.")).toBeVisible();
  await expect(page.locator("form, input, textarea, select")).toHaveCount(0);

  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/01-en-employee-fact-view.png`,
  });
});

test("assigned manager receives the same neutral source view while another employee is denied", async ({
  context,
  page,
  request,
}) => {
  const endpoint = `${apiBaseUrl}/api/v1/evaluation-cycles/${evaluationCycleId}/employees/${ownerId}/facts`;
  const employeeResponse = await request.get(endpoint, {
    headers: { authorization: "Bearer e2e-access-token" },
  });
  const managerResponse = await request.get(endpoint, {
    headers: { authorization: `Bearer ${managerAccessToken}` },
  });
  const deniedResponse = await request.get(endpoint, {
    headers: { authorization: `Bearer ${otherEmployeeAccessToken}` },
  });
  expect(employeeResponse.status()).toBe(200);
  expect(managerResponse.status()).toBe(200);
  expect(await managerResponse.json()).toEqual(await employeeResponse.json());
  expect(deniedResponse.status()).toBe(403);

  await installWorkspaceSession(context, managerAccessToken);
  await page.goto(`/en${factPath}`);
  await expect(page.getByRole("heading", { name: "Work Fact View" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Employee interpretation" })).toBeVisible();
  await expect(page.getByText(/ranking|productivity score|recommended rating/iu)).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/02-en-manager-neutral-fact-view.png`,
  });
});

test("Arabic fact view is localized, RTL, and usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ar${factPath}`);

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "عرض حقائق العمل" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "حقائق العمل المدعومة بالمصادر" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "تفسير الموظف" })).toBeVisible();
  const overflowing = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth)
      .map((element) => ({
        className: element.className,
        right: element.getBoundingClientRect().right,
        tag: element.tagName,
      })),
  );
  expect(overflowing).toEqual([]);

  await page.screenshot({
    fullPage: true,
    path: `${screenshotDirectory}/03-ar-employee-fact-view-mobile.png`,
  });
});
