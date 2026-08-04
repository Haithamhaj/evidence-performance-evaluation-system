import { Buffer } from "node:buffer";

import { expect, test } from "@playwright/test";

import { installWorkspaceSession } from "./fixtures/workspace.js";

const apiBaseUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}`;
const screenshotDirectory = "docs/product/screenshots/ai-first-daily-workspace/slice-4";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context, request }) => {
  const reset = await request.post(`${apiBaseUrl}/__e2e/slice-4/reset`, {
    headers: { "x-e2e-control": "slice-4" },
  });
  expect(reset.status()).toBe(204);
  await installWorkspaceSession(context);
});

test("employee completes one governed text, voice, file, code, and GitHub update lifecycle", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const beforeEvent = await request.get(`${apiBaseUrl}/__e2e/slice-4/state`, {
    headers: { "x-e2e-control": "slice-4" },
  });
  expect((await beforeEvent.json()).officialProjectProgressPercent).toBe(62.5);
  const githubEvent = await request.post(`${apiBaseUrl}/__e2e/slice-4/github-events`, {
    headers: { "x-e2e-control": "slice-4" },
    data: {
      commitCount: 18,
      changedFileCount: 42,
      matchedRuleIds: ["acceptance-check", "release-approval"],
    },
  });
  expect(await githubEvent.json()).toEqual({
    receivedCommitCount: 18,
    receivedChangedFileCount: 42,
    officialProjectProgressPercent: 62.5,
    ambiguousProgressReviewQueued: true,
  });

  await page.goto("/en/my-work");
  await page.getByRole("button", { name: "Add update" }).click();

  const composer = page.getByRole("dialog", { name: "Share a progress update" });
  await expect(composer).toBeVisible();
  await composer.getByRole("button", { name: "Review as evidence" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const evidence = page.getByRole("dialog", { name: "Review evidence" });
  await expect(evidence.getByText("only a suggested source")).toBeVisible();
  await evidence
    .getByLabel("Supported claim")
    .fill("The verified pull request completed the approved acceptance path.");
  await evidence
    .getByLabel("Contribution context")
    .fill("Implemented the path and reviewed the verified GitHub checks.");
  const box = await evidence.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(Math.abs(box!.y + box!.height - 844)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${screenshotDirectory}/02-en-evidence-review-mobile.png` });
  await evidence.getByRole("button", { name: "Create review draft" }).click();
  await expect(evidence.getByText("Automated GitHub fact")).toBeVisible();
  await expect(evidence.getByText("AI draft — employee review required")).toBeVisible();
  await evidence.getByRole("button", { name: "Save my edits" }).click();
  await evidence.getByRole("button", { name: "Confirm evidence" }).click();
  await expect(evidence).toHaveCount(0);

  const ownerDecision = await request.post(`${apiBaseUrl}/__e2e/slice-4/owner-decisions`, {
    headers: { "x-e2e-control": "slice-4" },
    data: {
      sourceRef: "github-progress-review:eb611111-1111-4111-8111-111111111111",
      satisfied: false,
    },
  });
  expect(await ownerDecision.json()).toEqual({
    officialProjectProgressPercent: 62.5,
    satisfied: false,
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await composer.getByLabel("Workstream").selectOption({ label: "API readiness" });
  await composer.getByLabel("Work Item").selectOption({ label: "Delivery task 2" });

  const voiceFile = Buffer.alloc(48);
  voiceFile.write("RIFF", 0, "ascii");
  voiceFile.write("WAVEfmt ", 8, "ascii");
  await composer.getByLabel("Upload audio").setInputFiles({
    name: "synthetic-acceptance.wav",
    mimeType: "audio/wav",
    buffer: voiceFile,
  });
  await expect(composer.getByLabel("Review transcript")).toHaveValue(
    "The automated GitHub checks passed and the closure evidence is attached.",
  );
  await composer.getByRole("button", { name: "Confirm transcript" }).click();
  await expect(composer.getByText("Transcript ready for your review")).toBeVisible();

  await composer.getByLabel("Upload file").setInputFiles({
    name: "acceptance-result.png",
    mimeType: "image/png",
    buffer: Buffer.from("synthetic acceptance screenshot", "utf8"),
  });
  await composer.getByLabel("Paste code").fill("expect(acceptedScenarios).toBe(12);");
  await composer
    .getByLabel("GitHub snapshot")
    .fill("PR #125 required checks passed at commit 5b8c560.");
  await composer
    .getByLabel("What changed?")
    .fill("Completed the approved source-integrity acceptance journey.");

  await page.screenshot({
    fullPage: false,
    path: `${screenshotDirectory}/01-en-universal-capture-desktop.png`,
  });

  await composer.getByRole("button", { name: "Continue" }).click();
  await expect(composer.getByText("Current update draft")).toBeVisible();
  await composer
    .getByLabel("Your answer")
    .fill("All 12 approved acceptance scenarios passed with no failed checks.");
  await composer.getByRole("button", { name: "Answer and continue" }).click();
  await composer
    .getByLabel("Your answer")
    .fill("The CLI result and screenshot support closure; product-owner review is next.");
  await composer.getByRole("button", { name: "Answer and continue" }).click();

  await expect(composer.getByRole("heading", { name: "Review your update" })).toBeVisible();
  await expect(composer.getByText("AI draft")).toBeVisible();
  await composer.getByRole("button", { name: "Save my review" }).click();
  await composer.getByRole("button", { name: "Confirm update" }).click();
  await expect(composer.getByText("Update confirmed")).toBeVisible();
  await expect(composer.getByText("All 12 agreed acceptance scenarios passed.")).toBeVisible();
  await expect(composer.getByText("Automated GitHub fact").first()).toBeVisible();
  await expect(composer.getByText("Employee confirmed").first()).toBeVisible();
  await expect(composer.getByText("Human decision").first()).toBeVisible();
  await expect(composer.getByText("Project owner kept official progress at 62.5%")).toBeVisible();
  await expect(composer.getByText(/rating|ranking|productivity score/iu)).toHaveCount(0);
  await page.screenshot({
    fullPage: false,
    path: `${screenshotDirectory}/03-en-result-source-timeline-desktop.png`,
  });
  await composer
    .getByText("Project owner kept official progress at 62.5%")
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    fullPage: false,
    path: `${screenshotDirectory}/05-en-github-evidence-decision-timeline.png`,
  });

  const stateResponse = await request.get(`${apiBaseUrl}/__e2e/slice-4/state`, {
    headers: { "x-e2e-control": "slice-4" },
  });
  expect(stateResponse.status()).toBe(200);
  await expect(stateResponse.json()).resolves.toEqual({
    capturedUpdateSourceKinds: ["voice_transcript", "image", "pasted_code", "github_snapshot"],
    officialProjectProgressPercent: 62.5,
    ambiguousProgressReviewQueued: false,
    employeePerformanceWrites: 0,
  });
});

test("Arabic mobile keeps the daily entry simple and RTL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar/my-work");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "إضافة تحديث", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "شارك تحديث التقدم" });
  await expect(composer.locator('select[name="projectId"]')).toHaveValue(
    "11111111-1111-4111-8111-111111111111",
  );
  await expect(composer.locator('select[name="workstreamId"]')).toHaveValue("");
  await expect(composer.locator('select[name="workItemId"]')).toHaveValue("");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: `${screenshotDirectory}/04-ar-universal-capture-mobile.png`,
  });
});
